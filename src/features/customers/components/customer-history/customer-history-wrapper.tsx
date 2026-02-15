import {
  getCustomerProfile,
  getCustomerKPIs,
  getAccessHistory,
  getPaymentHistory,
  getSubscriptionHistory,
  getBodyAssessmentHistory,
  getAccessHeatmapData,
} from "@/features/customers/actions/customer-history-actions";
import { CustomerHistoryClient } from "@/features/customers/components/customer-history/customer-history-client";
import { notFound } from "next/navigation";

export default async function CustomerHistoryWrapper({ customerId }: { customerId: string }) {
  // Obtener todos los datos en paralelo
  const [profile, kpis, accessHistory, paymentHistory, subscriptionHistory, bodyAssessments, heatmapData] =
    await Promise.all([
      getCustomerProfile(customerId),
      getCustomerKPIs(customerId),
      getAccessHistory(customerId),
      getPaymentHistory(customerId),
      getSubscriptionHistory(customerId),
      getBodyAssessmentHistory(customerId),
      getAccessHeatmapData(customerId),
    ]);

  if (!profile) {
    notFound();
  }

  return (
    <CustomerHistoryClient
      profile={profile}
      kpis={kpis}
      accessHistory={accessHistory}
      paymentHistory={paymentHistory}
      subscriptionHistory={subscriptionHistory}
      bodyAssessments={bodyAssessments}
      heatmapData={heatmapData}
    />
  );
}
