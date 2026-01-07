import { createClient } from '@/lib/supabase/server';
import { CustomerTable } from './customer-tables/customer-table';
import { Customer } from './customer-tables/columns';
import { searchParamsCache } from '@/lib/searchparams';

type CustomerListingPageProps = {};

export default async function CustomerListingPage({}: CustomerListingPageProps) {
  const page = searchParamsCache.get('page');
  const pageLimit = searchParamsCache.get('perPage');
  const fullName = searchParamsCache.get('full_name');
  const planName = searchParamsCache.get('plan_name');
  const role = searchParamsCache.get('role') || 'client';
  
  const filters = {
    page,
    limit: pageLimit,
    role,
    ...(fullName && { full_name: fullName }),
    ...(planName && { plan_name: planName }),
  };

  const supabase = await createClient();

  // Actualizar automáticamente suscripciones vencidas en la BD
  // Esto marca como 'expired' cualquier suscripción cuya end_date haya pasado
  await supabase
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('end_date', new Date().toISOString().split('T')[0]);
  
  // Obtener la lista de planes para el filtro
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name')
    .order('name');

  // Crear opciones para el filtro multiSelect
  const planOptions = (plans || []).map(plan => ({
    label: plan.name,
    value: plan.name,
  }));
  
  // Query para clientes
  let query = supabase
    .from('customer_overview')
    .select('*', { count: 'exact' });
    
  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  if (filters.full_name) {
    query = query.ilike('full_name', `%${filters.full_name}%`);
  }

  // Filtro por plan (puede ser múltiple, separado por comas)
  if (filters.plan_name) {
    const planNames = filters.plan_name.split(',');
    query = query.in('plan_name', planNames);
  }

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  
  query = query.order('subscription_status', { ascending: true })
         .range(from, to);

  const { data: customers, error, count } = await query;
  
  if (error) {
    console.error('Error fetching customers (view):', error);
  }

  const totalitems = count || 0;
  
  return (
    <CustomerTable
      data={(customers as Customer[]) || []}
      totalItems={totalitems}
      planOptions={planOptions}
    />
  );
}
