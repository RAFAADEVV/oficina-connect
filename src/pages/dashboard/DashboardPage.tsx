import { Card, PageHeader, StatCard } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function DashboardPage() {
  usePageTitle('Dashboard')

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral dos clientes, oportunidades de contacto e resultados da oficina."
      />

      {/* Os valores ficam a "—" até existirem dados reais importados. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={null} icon="users" hint="Sem dados importados" />
        <StatCard label="Veículos" value={null} icon="car" hint="Sem dados importados" />
        <StatCard label="Oportunidades abertas" value={null} icon="target" hint="Sem dados importados" />
        <StatCard label="Contactos este mês" value={null} icon="dashboard" hint="Sem dados importados" />
      </div>

      <div className="mt-6">
        <Card title="Primeiros passos" description="O que vai ser possível fazer nesta plataforma.">
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">1</span>
              Importar clientes, veículos e histórico de serviços a partir de Excel ou CSV.
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">2</span>
              Ver que clientes poderão precisar de voltar à oficina.
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">3</span>
              Preparar mensagens de WhatsApp e registar o resultado de cada contacto.
            </li>
          </ol>
        </Card>
      </div>
    </>
  )
}
