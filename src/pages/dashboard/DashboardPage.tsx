import { Link, useNavigate } from 'react-router'
import { Alert, Button, Card, PageHeader, Spinner, StatCard } from '../../components/ui'
import { getDashboardCounts } from '../../features/dashboard/dashboardApi'
import { useOrganization } from '../../features/organization/useOrganization'
import { isContacted, listReminders, STAGE_LABELS, STAGE_ORDER } from '../../features/reminders/remindersApi'
import { cn } from '../../lib/cn'
import { formatDate, formatPlate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'
import type { ReminderStage } from '../../types/database'

const STAGE_DOT: Record<ReminderStage, string> = {
  atrasado: 'bg-red-500',
  semana: 'bg-amber-500',
  mes: 'bg-brand-500',
}

const STEPS = [
  {
    text: 'Importar clientes, veículos e histórico de serviços a partir de Excel ou CSV.',
    action: { label: 'Importar ficheiro', to: '/clientes/importar' },
  },
  {
    text: 'Registar os serviços e combinar a próxima revisão com cada cliente.',
    action: { label: 'Ver clientes', to: '/clientes' },
  },
  {
    text: 'Enviar notificações por WhatsApp 1 mês e 1 semana antes da revisão.',
    action: { label: 'Ver oportunidades', to: '/oportunidades' },
  },
]

export function DashboardPage() {
  usePageTitle('Dashboard')
  const navigate = useNavigate()
  const { organization } = useOrganization()
  const orgId = organization?.id ?? null

  const counts = useAsyncData(orgId ? `dashboard:${orgId}` : null, () => getDashboardCounts(orgId!))
  const reminders = useAsyncData(orgId ? `dashboard-lembretes:${orgId}` : null, () => listReminders(orgId!))

  const pending = (reminders.data ?? [])
    .filter((r) => !isContacted(r))
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.due_date.localeCompare(b.due_date))
  const isEmpty = counts.data?.customers === 0

  const value = (n: number | undefined) => (n === undefined ? null : n)

  return (
    <>
      <PageHeader title="Dashboard" />

      {(counts.error || reminders.error) && (
        <Alert variant="error" className="mb-4">
          {counts.error ?? reminders.error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clientes"
          value={value(counts.data?.customers)}
          icon="users"
          hint={counts.data ? `${counts.data.vehicles} ${counts.data.vehicles === 1 ? 'veículo' : 'veículos'}` : undefined}
        />
        <StatCard label="Por contactar" value={reminders.data ? pending.length : null} icon="target" hint="Lembretes de revisão pendentes" />
        <StatCard label="Contactos este mês" value={value(counts.data?.contactsThisMonth)} icon="phone" hint="Notificações enviadas" />
        <StatCard label="Agendados este mês" value={value(counts.data?.scheduledThisMonth)} icon="check" hint="Clientes que marcaram revisão" />
      </div>

      <div className="mt-6">
        {isEmpty ? (
          <Card title="Primeiros passos">
            <ol className="space-y-4 text-sm text-slate-600">
              {STEPS.map((step, index) => (
                <li key={step.text} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="flex items-center gap-3 sm:flex-1">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                      {index + 1}
                    </span>
                    {step.text}
                  </span>
                  <Button size="sm" variant={index === 0 ? 'primary' : 'secondary'} onClick={() => navigate(step.action.to)}>
                    {step.action.label}
                  </Button>
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <Card
            title="Próximos a contactar"
            actions={
              pending.length > 0 && (
                <Link to="/oportunidades" className="text-sm font-medium text-brand-700 hover:underline">
                  Ver todos
                </Link>
              )
            }
          >
            {!reminders.data && <Spinner className="size-5 text-slate-400" />}
            {reminders.data && pending.length === 0 && (
              <p className="text-sm text-slate-500">Ninguém para contactar de momento.</p>
            )}
            {pending.length > 0 && (
              <ul className="-my-2.5 divide-y divide-slate-100">
                {pending.slice(0, 6).map((r) => (
                  <li key={r.vehicle_id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className={cn('size-2 shrink-0 rounded-full', STAGE_DOT[r.stage])} aria-hidden="true" />
                    <Link to={`/clientes/${r.customer_id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline">
                      {r.customer_name}
                    </Link>
                    <span className="hidden font-mono text-xs text-slate-500 sm:inline">{formatPlate(r.plate)}</span>
                    <span className="w-24 text-right text-slate-500">{formatDate(r.due_date)}</span>
                    <span className="hidden w-28 text-right text-xs text-slate-500 md:inline">{STAGE_LABELS[r.stage]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
