'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  IconArrowLeft,
  IconCoin,
  IconCalendarStats,
  IconBarbell,
  IconScale,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconCreditCard,
  IconFileCertificate,
  IconRun,
  IconActivity
} from '@tabler/icons-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  CustomerProfile,
  CustomerHistoryKPIs,
  AccessLogEntry,
  PaymentEntry,
  SubscriptionEntry,
  BodyAssessmentEntry
} from '../../actions/customer-history-actions';

// Import sub-components
import { 
  AccessHistoryTab, 
  PaymentHistoryTab, 
  SubscriptionHistoryTab, 
  BodyAssessmentTab 
} from './tabs';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface CustomerHistoryClientProps {
  profile: CustomerProfile;
  kpis: CustomerHistoryKPIs;
  accessHistory: AccessLogEntry[];
  paymentHistory: PaymentEntry[];
  subscriptionHistory: SubscriptionEntry[];
  bodyAssessments: BodyAssessmentEntry[];
  heatmapData: Record<string, number>;
}

export function CustomerHistoryClient({
  profile,
  kpis,
  accessHistory,
  paymentHistory,
  subscriptionHistory,
  bodyAssessments,
  heatmapData
}: CustomerHistoryClientProps) {
  const [activeSection, setActiveSection] = useState('subscriptions');

  const initials = profile.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '??';

  const memberSinceFormatted = kpis.memberSince 
    ? formatDistanceToNow(new Date(kpis.memberSince), { locale: es, addSuffix: true })
    : 'N/A';

  const lastAssessment = bodyAssessments.length > 0 ? bodyAssessments[0] : null;
  const lastAssessmentSafe = lastAssessment ? {
    weight_kg: lastAssessment.weight_kg ?? 0,
    height_cm: lastAssessment.height_cm ?? 0,
    body_type: lastAssessment.body_type ?? 'mesomorph'
  } : null;

  const scrollToSection = (id: string) => {
    // Buscar específicamente el viewport dentro de nuestro contenedor de historial
    const container = document.getElementById('customer-content-scroll');
    const viewport = container?.querySelector('[data-radix-scroll-area-viewport]');
    const element = document.getElementById(id);
    
    if (element && viewport) {
        const viewportRect = viewport.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Calcular la posición relativa: distancia del elemento al tope del viewport + lo que ya se ha scrolleado
        const relativeTop = elementRect.top - viewportRect.top;
        const targetScroll = viewport.scrollTop + relativeTop - 12; // 12px de padding superior
        
        viewport.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
        
        setActiveSection(id);
    }
  };

  // ScrollSpy simpler implementation could go here, but omitted for brevity/performance
  
  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur z-20 shadow-sm">
        {/* Profile Header */}
        <div className="flex items-center gap-4 p-4 lg:p-6 pb-2">
            <Link href="/dashboard/customers" className="lg:hidden">
            <Button variant="ghost" size="icon">
                <IconArrowLeft className="h-5 w-5" />
            </Button>
            </Link>
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                    <AvatarImage src={profile.avatar_url || ''} alt={profile.full_name} />
                    <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold truncate">{profile.full_name}</h1>
                        <Badge variant="secondary" className="hidden sm:inline-flex align-middle ml-2">
                            Activo
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                         <span>{profile.email}</span>
                         <span className="hidden sm:inline">•</span>
                         <span className="hidden sm:inline">{profile.phone}</span>
                         <span className="inline sm:hidden">•</span>
                         <span className="inline sm:hidden text-xs">Miembro {memberSinceFormatted}</span>
                    </div>
                </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
                <Badge variant="outline" className="text-sm px-3 py-1">
                    Miembro {memberSinceFormatted}
                </Badge>
                {/* Actions placeholder */}
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <IconActivity className="w-5 h-5"/>
                </Button>
            </div>
        </div>

        {/* Navigation Tabs (Fixed below profile) */}
        <div className="flex items-center gap-1 px-4 lg:px-6 pb-0 overflow-x-auto no-scrollbar">
            <NavTab 
                active={activeSection === 'overview'} 
                onClick={() => scrollToSection('overview')}
                label="Resumen"
            />
            <NavTab 
                active={activeSection === 'subscriptions'} 
                onClick={() => scrollToSection('subscriptions')}
                label="Suscripciones"
            />
            <NavTab 
                active={activeSection === 'payments'} 
                onClick={() => scrollToSection('payments')}
                label="Pagos"
            />
            <NavTab 
                active={activeSection === 'access'} 
                onClick={() => scrollToSection('access')}
                label="Registros de Acceso"
            />
            <NavTab 
                active={activeSection === 'body'} 
                onClick={() => scrollToSection('body')}
                label="Evolución Física"
            />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="flex-1 bg-background/50 h-full" id="customer-content-scroll">
        <div className="p-4 lg:p-8 space-y-10">
        
        {/* Overview Section (KPIs) */}
        <section id="overview" className="scroll-mt-2 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                title="Total Gastado (LTV)"
                value={`Q${kpis.totalSpent.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                icon={<IconCoin className="h-5 w-5 text-emerald-500" />}
                description="Valor de vida del cliente"
                />
                <KPICard
                title="Total de Visitas"
                value={kpis.totalVisits.toString()}
                icon={<IconCalendarStats className="h-5 w-5 text-blue-500" />}
                description="Ingresos registrados"
                />
                <KPICard
                title="Peso Actual"
                value={kpis.currentWeight ? `${kpis.currentWeight} kg` : 'N/A'}
                icon={<IconScale className="h-5 w-5 text-purple-500" />}
                description={kpis.initialWeight ? `Inicial: ${kpis.initialWeight} kg` : 'Sin registro inicial'}
                />
                <KPICard
                title="Cambio de Peso"
                value={kpis.weightChange !== null && kpis.weightChange !== undefined ? `${kpis.weightChange > 0 ? '+' : ''}${kpis.weightChange.toFixed(1)} kg` : 'N/A'}
                icon={
                    kpis.weightChange !== null && kpis.weightChange !== undefined ? (
                    kpis.weightChange > 0 ? <IconTrendingUp className="h-5 w-5 text-red-500" /> :
                    kpis.weightChange < 0 ? <IconTrendingDown className="h-5 w-5 text-green-500" /> :
                    <IconMinus className="h-5 w-5 text-gray-500" />
                    ) : <IconBarbell className="h-5 w-5 text-gray-400" />
                }
                description="Desde primera medición"
                />
            </div>
        </section>

        <section id="subscriptions" className="scroll-mt-4">
            <SectionHeader icon={<IconFileCertificate />} title="Historial de Suscripciones" />
            <SubscriptionHistoryTab 
                subscriptionHistory={subscriptionHistory}
                customerId={profile.id}
                customerName={profile.full_name || 'Cliente'}
                lastAssessment={lastAssessmentSafe}
            />
        </section>

        <section id="payments" className="scroll-mt-4">
            <SectionHeader icon={<IconCreditCard />} title="Historial de Pagos" />
            <PaymentHistoryTab paymentHistory={paymentHistory} />
        </section>

        <section id="access" className="scroll-mt-4">
            <SectionHeader icon={<IconRun />} title="Registros de Acceso" />
            <AccessHistoryTab 
                accessHistory={accessHistory} 
                heatmapData={heatmapData} 
            />
        </section>

        <section id="body" className="scroll-mt-4">
            <SectionHeader icon={<IconActivity />} title="Evolución Física" />
            <BodyAssessmentTab bodyAssessments={bodyAssessments} />
        </section>

          <div className="h-20" /> {/* Extra space at bottom */}
        </div>
      </ScrollArea>
    </div>
  );
}

// Subcomponents

function SectionHeader({ icon, title }: { icon: React.ReactNode, title: string }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                {icon}
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
        </div>
    )
}

function NavTab({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                active 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
        >
            {label}
        </button>
    )
}

// Componente de tarjeta KPI
function KPICard({ 
  title, 
  value, 
  icon, 
  description 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  description: string;
}) {
  return (
    <Card className="border-none shadow-sm bg-card/50 hover:bg-card transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
