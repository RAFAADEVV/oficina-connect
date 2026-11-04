import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Icon, PageHeader, Spinner } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { useOrganization } from '../../features/organization/useOrganization'
import { SendReminderDialog } from '../../features/reminders/SendReminderDialog'
import {
  isContacted,
  listReminders,
  logContact,
  markCustomerOptOut,
  OUTCOME_LABELS,
  setContactOutcome,
  SOURCE_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  type Reminder,
} from '../../features/reminders/remindersApi'
import { cn } from '../../lib/cn'
import { formatDate, formatNumber, formatPlate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'
import type { ContactOutcome, ReminderStage } from '../../types/database'

type Tab = 'pending' | 'contacted'

const STAGE_STYLES: Record<ReminderStage, string> = {
  atrasado: 'bg-red-50 text-red-700 ring-red-200',
  semana: 'bg-amber-50 text-amber-700 ring-amber-200',
  mes: 'bg-slate-100 text-slate-700 ring-slate-300',
}

const RESULT_OPTIONS: ContactOutcome[] = ['agendado', 'sem_resposta', 'ja_fez', 'nao_quer']

function carName(reminder: Reminder): string {
  return [reminder.make, reminder.model].filter(Boolean).join(' ')
}

export function OportunidadesPage() {
  usePageTitle('Oportunidades')
  const { organization } = useOrganization()
  const orgId = organization?.id ?? null

  const reminders = useAsyncData(orgId ? `lembretes:${orgId}` : null, () => listReminders(orgId!))
  const [tab, setTab] = useState<Tab>('pending')
  const [sending, setSending] = useState<Reminder | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const all = reminders.data ?? []
  const pending = all.filter((r) => !isContacted(r))
  const contacted = all.filter(isContacted)

  async function chooseOutcome(reminder: Reminder, outcome: ContactOutcome) {
    if (!reminder.contact_id) return
    setBusyId(reminder.vehicle_id)
    setActionError(null)
    try {
      await setContactOutcome(reminder.contact_id, outcome)
      if (outcome === 'nao_quer') await markCustomerOptOut(reminder.customer_id)
      reminders.reload()
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function renderReminder(reminder: Reminder) {
    const car = carName(reminder)
    return (
      <li key={reminder.vehicle_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/clientes/${reminder.customer_id}`} className="font-medium text-slate-900 hover:underline">
              {reminder.customer_name}
            </Link>
            <span className="rounded-md border border-slate-300 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
              {formatPlate(reminder.plate)}
            </span>
            {car && <span className="text-sm text-slate-600">{car}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Revisão prevista: <strong className="font-medium text-slate-900">{formatDate(reminder.due_date)}</strong>
            {reminder.due_mileage !== null && <> ou aos {formatNumber(reminder.due_mileage)} km</>}
            <span className="text-slate-400"> · {SOURCE_LABELS[reminder.due_source]}</span>
          </p>
          {isContacted(reminder) && reminder.contacted_at && (
            <p className="mt-1 text-xs text-slate-500">
              {OUTCOME_LABELS[reminder.contact_outcome ?? 'enviado']} · {formatDate(reminder.contacted_at)}
            </p>
          )}
        </div>

        {isContacted(reminder) ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Resultado do contacto com ${reminder.customer_name}`}>
            {RESULT_OPTIONS.map((outcome) => (
              <Button
                key={outcome}
                size="sm"
                variant={reminder.contact_outcome === outcome ? 'primary' : 'secondary'}
                disabled={busyId === reminder.vehicle_id}
                onClick={() => void chooseOutcome(reminder, outcome)}
              >
                {OUTCOME_LABELS[outcome]}
              </Button>
            ))}
          </div>
        ) : (
          <Button variant="whatsapp" onClick={() => setSending(reminder)} className="shrink-0">
            <Icon name="phone" className="size-4" />
            Enviar notificação
          </Button>
        )}
      </li>
    )
  }

  const list = tab === 'pending' ? pending : contacted

  return (
    <>
      <PageHeader title="Oportunidades" />

      {(reminders.error || actionError) && (
        <Alert variant="error" className="mb-4">
          {reminders.error ?? actionError}{' '}
          {reminders.error && (
            <button type="button" onClick={reminders.reload} className="font-medium underline">
              Tentar novamente
            </button>
          )}
        </Alert>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {(
          [
            ['pending', 'Por contactar', pending.length],
            ['contacted', 'Contactados', contacted.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {label}
            <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs', tab === id ? 'bg-brand-50' : 'bg-slate-100')}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {reminders.isLoading && !reminders.data && (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner className="size-6" />
        </div>
      )}

      {reminders.data && list.length === 0 && (
        <EmptyState
          icon="target"
          title={tab === 'pending' ? 'Ninguém para contactar de momento' : 'Ainda não há contactos feitos'}
        />
      )}

      {reminders.data && list.length > 0 && (
        <div className="space-y-6">
          {STAGE_ORDER.map((stage) => {
            const items = list.filter((r) => r.stage === stage)
            if (items.length === 0) return null
            return (
              <section key={stage}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs ring-1', STAGE_STYLES[stage])}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-slate-400">{items.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {items.map(renderReminder)}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {organization && (
        <SendReminderDialog
          reminder={sending}
          organizationName={organization.name}
          onClose={() => setSending(null)}
          onSend={async (reminder) => {
            await logContact(organization.id, reminder)
            setSending(null)
            reminders.reload()
          }}
        />
      )}
    </>
  )
}
