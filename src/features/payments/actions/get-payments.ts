'use server';

import { createClient } from '@/lib/supabase/server';
import { Payment } from '../components/payment-tables/columns';

export interface GetPaymentsParams {
  page: number;
  perPage: number;
  user_name?: string | null;
  method?: string | null;
  payment_date?: string | null;
  subscription_status?: string | null;
}

export interface GetPaymentsResponse {
  data: Payment[];
  total: number;
}

export async function getPayments({
  page,
  perPage,
  user_name,
  method,
  payment_date,
  subscription_status
}: GetPaymentsParams): Promise<GetPaymentsResponse> {
  const supabase = await createClient();

  // Determine if we need an inner join for subscriptions filtering
  const subscriptionJoinType = subscription_status ? 'subscriptions!inner' : 'subscriptions';

  // Query from the payments table with joins
  let query = supabase
    .from('payments')
    .select(`
      *,
      profiles!inner(full_name, avatar_url),
      ${subscriptionJoinType}(status, end_date, plans(name))
    `, { count: 'exact' });

  // Apply text filters
  if (user_name) {
    query = query.ilike('profiles.full_name', `%${user_name}%`);
  }

  // Apply subscription status filter
  if (subscription_status) {
    const statuses = subscription_status.split(',').filter(Boolean);
    if (statuses.length > 0) {
      query = query.in('subscriptions.status', statuses);
    }
  }

  // Apply method filter (multi-select)
  if (method) {
    const methods = method.split(',').filter(Boolean);
    if (methods.length > 0) {
      query = query.in('method', methods);
    }
  }

  // Apply date range filter
  if (payment_date) {
    const dates = payment_date.split(',').filter(Boolean);
    if (dates.length >= 1 && dates[0]) {
      const startTimestamp = parseInt(dates[0], 10);
      if (!isNaN(startTimestamp)) {
        const startDate = new Date(startTimestamp);
        query = query.gte('payment_date', startDate.toISOString());
      }
    }
    if (dates.length >= 2 && dates[1]) {
      const endTimestamp = parseInt(dates[1], 10);
      if (!isNaN(endTimestamp)) {
        const endDate = new Date(endTimestamp);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('payment_date', endDate.toISOString());
      }
    }
  }

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.order('payment_date', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching payments:', error);
    throw new Error('Error al cargar pagos');
  }

  const payments: Payment[] = (data || []).map((p: any) => {
    const profile = p.profiles;
    const subscription = p.subscriptions; 
    const plan = subscription?.plans;

    return {
      id: p.id,
      payment_date: p.payment_date,
      amount_paid: Number(p.amount_paid),
      method: p.method,
      user_id: p.user_id,
      user_name: profile?.full_name || 'Usuario eliminado',
      avatar_url: profile?.avatar_url,
      plan_name: plan?.name || 'Sin plan',
      subscription_status: subscription?.status,
      subscription_end_date: subscription?.end_date,
    };
  });

  return {
    data: payments,
    total: count || 0
  };
}
