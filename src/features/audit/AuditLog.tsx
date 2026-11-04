import { Alert, Spinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAsyncData } from '../../lib/useAsyncData'

const TABLE_LABELS: Record<string, string> = {
  customers: 'Cliente apagado',
  vehicles: 'Veículo apagado',
  service_records: 'Serviço apagado',
  service_parts: 'Peça apagada',
}

interface AuditEvent {
  id: number
  table_name: string
  record_id: string
  actor_id: string | null
  created_at: string
}

async function listAuditEvents(organizationId: string): Promise<{ events: AuditEvent[]; names: Map<string, string> }> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, table_name, record_id, actor_id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error

  const actorIds = [...new Set(data.map((e) => e.actor_id).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (actorIds.length > 0) {
    const profiles = await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    if (profiles.error) throw profiles.error
    for (const p of profiles.data) names.set(p.id, p.full_name ?? 'Utilizador')
  }
  return { events: data, names }
}

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

/** Últimas eliminações na oficina (só o Dono vê; garantido pela base de dados). */
export function AuditLog({ organizationId }: { organizationId: string }) {
  const { data, error, isLoading } = useAsyncData(`auditoria:${organizationId}`, () => listAuditEvents(organizationId))

  if (error) return <Alert variant="error">{error}</Alert>
  if (isLoading && !data) return <Spinner className="size-5 text-slate-400" />
  if (!data || data.events.length === 0) return <p className="text-sm text-slate-500">Nenhuma eliminação registada.</p>

  return (
    <ul className="-my-2 divide-y divide-slate-100 text-sm">
      {data.events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
          <span className="text-slate-900">
            {TABLE_LABELS[event.table_name] ?? 'Registo apagado'}
            <span className="ml-2 font-mono text-xs text-slate-400">{event.record_id.slice(0, 8)}</span>
          </span>
          <span className="text-xs text-slate-500">
            {event.actor_id ? (data.names.get(event.actor_id) ?? 'Utilizador') : 'Sistema'} ·{' '}
            {dateTime.format(new Date(event.created_at))}
          </span>
        </li>
      ))}
    </ul>
  )
}
