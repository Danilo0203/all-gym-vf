'use client';

import { useSearchParams } from 'next/navigation';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfYear, endOfYear, format } from 'date-fns';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardPeriodSelector } from './period-selector';
import { KPICards } from './kpi-cards';
import { RevenueChart } from './revenue-chart';
import { PlanDistributionChart } from './plan-distribution-chart';
import { SubscriptionsFlowChart } from './subscriptions-flow-chart';
import { PaymentMethodChart } from './payment-method-chart';
import { RecentPaymentsTable } from './recent-payments-table';
import { ExpiringSubscriptionsTable } from './expiring-subscriptions-table';
import { InactiveCustomersTable } from './inactive-customers-table';
import {
  useDashboardKPIs,
  useRevenueByMonth,
  usePlanDistribution,
  useSubscriptionsFlow,
  usePaymentMethodDistribution,
  useRecentPayments,
  useExpiringSubscriptions,
  useInactiveCustomers
} from '../hooks/use-dashboard-queries';
import { DashboardDateRange } from '../actions/panel-actions';

// ====================
// SKELETONS (Copied/Adapted for reuse)
// ====================

function KPICardsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className='@container/card'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-9 w-9 rounded-lg' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-8 w-32 mt-2' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-3 w-20' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-3 w-60' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[200px] w-full' />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-3 w-60' />
      </CardHeader>
      <CardContent className='space-y-3'>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className='flex items-center gap-3'>
            <Skeleton className='h-9 w-9 rounded-full' />
            <div className='flex-1'>
              <Skeleton className='h-4 w-32 mb-1' />
              <Skeleton className='h-3 w-20' />
            </div>
            <Skeleton className='h-6 w-16' />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ====================
// HELPERS
// ====================

function getDateRangeFromPeriod(period?: string, from?: string, to?: string): DashboardDateRange {
  const now = new Date();
  
  if (period === 'custom' && from && to) {
    return { from, to };
  }
  
  switch (period) {
    case 'week':
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'last_month':
      return {
        from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
        to: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      };
    case 'year':
      return {
        from: format(startOfYear(now), 'yyyy-MM-dd'),
        to: format(endOfYear(now), 'yyyy-MM-dd'),
      };
    case 'month':
    default:
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
  }
}

function getPeriodLabel(period?: string): string {
  switch (period) {
    case 'week':
      return 'esta semana';
    case 'last_month':
      return 'el mes pasado';
    case 'year':
      return 'este año';
    case 'custom':
      return 'el período seleccionado';
    case 'month':
    default:
      return 'este mes';
  }
}

// ====================
// COMPONENT
// ====================

export default function DashboardView() {
  const searchParams = useSearchParams();
  const period = searchParams.get('period') || 'month';
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  const dateRange = getDateRangeFromPeriod(period, from, to);
  const periodLabel = getPeriodLabel(period);

  // Queries
  const kpisQuery = useDashboardKPIs(dateRange);
  const revenueQuery = useRevenueByMonth();
  const planDistQuery = usePlanDistribution();
  const subsFlowQuery = useSubscriptionsFlow();
  const paymentMethodQuery = usePaymentMethodDistribution(dateRange);
  const recentPaymentsQuery = useRecentPayments();
  const expiringSubsQuery = useExpiringSubscriptions();
  const inactiveCustomersQuery = useInactiveCustomers();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-6 p-1'>
        {/* Header */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Estado del Negocio 📊
            </h1>
            <p className='text-muted-foreground'>
              ¿Cómo va el gimnasio {periodLabel}? Aquí tienes todos los indicadores clave.
            </p>
          </div>
          
          <DashboardPeriodSelector onLoadingChange={() => {}} />
        </div>

        {/* KPI Cards Row */}
        {kpisQuery.isLoading ? (
          <KPICardsSkeleton />
        ) : (
          <KPICards data={kpisQuery.data || {
            totalRevenue: 0,
            revenueChange: 0,
            activeMembers: 0,
            inactiveMembers: 0,
            churnRate: 0,
            avgTicket: 0,
            cashAmount: 0,
            cardAmount: 0,
            transferAmount: 0
          }} />
        )}

        {/* Main Grid - Bento Style */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          {/* Revenue Chart - Large */}
          <div className='lg:col-span-4'>
            {revenueQuery.isLoading ? (
              <ChartSkeleton className='h-full' />
            ) : (
              <RevenueChart data={revenueQuery.data || []} />
            )}
          </div>

          {/* Recent Payments */}
          <div className='lg:col-span-3'>
            {recentPaymentsQuery.isLoading ? (
              <TableSkeleton />
            ) : (
              <RecentPaymentsTable data={recentPaymentsQuery.data || []} />
            )}
          </div>
        </div>

        {/* Second Row */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {/* Plan Distribution */}
          {planDistQuery.isLoading ? (
            <ChartSkeleton />
          ) : (
            <PlanDistributionChart data={planDistQuery.data || []} />
          )}

          {/* Payment Methods */}
          {paymentMethodQuery.isLoading ? (
            <ChartSkeleton />
          ) : (
            <PaymentMethodChart data={paymentMethodQuery.data || []} />
          )}

          {/* Subscriptions Flow */}
          <div className='md:col-span-2'>
            {subsFlowQuery.isLoading ? (
              <ChartSkeleton className='h-full' />
            ) : (
              <SubscriptionsFlowChart data={subsFlowQuery.data || []} />
            )}
          </div>
        </div>

        {/* Alerts Row - Expiring & Inactive */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          {/* Expiring Subscriptions */}
          {expiringSubsQuery.isLoading ? (
            <TableSkeleton />
          ) : (
            <ExpiringSubscriptionsTable data={expiringSubsQuery.data || []} />
          )}

          {/* Inactive Customers */}
          {inactiveCustomersQuery.isLoading ? (
            <TableSkeleton />
          ) : (
            <InactiveCustomersTable data={inactiveCustomersQuery.data || []} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
