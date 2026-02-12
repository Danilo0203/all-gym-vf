import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { 
  getCustomerProfile, 
  getCustomerKPIs,
  getAccessHistory,
  getPaymentHistory,
  getSubscriptionHistory,
  getBodyAssessmentHistory,
  getAccessHeatmapData
} from '@/features/customers/actions/customer-history-actions';
import { CustomerHistoryClient } from '@/features/customers/components/customer-history/customer-history-client';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerHistoryPageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerHistoryPage({ params }: CustomerHistoryPageProps) {
  const { customerId } = await params;

  // Obtener todos los datos en paralelo
  const [
    profile,
    kpis,
    accessHistory,
    paymentHistory,
    subscriptionHistory,
    bodyAssessments,
    heatmapData
  ] = await Promise.all([
    getCustomerProfile(customerId),
    getCustomerKPIs(customerId),
    getAccessHistory(customerId),
    getPaymentHistory(customerId),
    getSubscriptionHistory(customerId),
    getBodyAssessmentHistory(customerId),
    getAccessHeatmapData(customerId)
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6 flex-1 min-h-0">
      <Suspense fallback={<HistoryLoadingSkeleton />}>
        <CustomerHistoryClient
          profile={profile}
          kpis={kpis}
          accessHistory={accessHistory}
          paymentHistory={paymentHistory}
          subscriptionHistory={subscriptionHistory}
          bodyAssessments={bodyAssessments}
          heatmapData={heatmapData}
        />
      </Suspense>
    </div>
  );
}

function HistoryLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
