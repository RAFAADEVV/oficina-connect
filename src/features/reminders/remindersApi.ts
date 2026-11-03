import { todayIso } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { ContactOutcome, Database, DueSource, ReminderStage } from '../../types/database'

export type Reminder = Database['public']['Functions']['get_service_reminders']['Returns'][number]

export const STAGE_LABELS: Record<ReminderStage, string> = {
  atrasado: 'Atrasados',
  semana: 'Falta 1 semana',
  mes: 'Falta 1 mês',
}

export const STAGE_ORDER: ReminderStage[] = ['atrasado', 'semana', 'mes']

export const SOURCE_LABELS: Record<DueSource, string> = {
  combinado: 'combinada com o cliente',
  combinado_km: 'estimada pelos km combinados',
  habito: 'pelo hábito do cliente',
  padrao: 'intervalo padrão da oficina',
}

export const OUTCOME_LABELS: Record<ContactOutcome, string> = {
  enviado: 'Notificação enviada',
  agendado: 'Agendou',
  sem_resposta: 'Sem resposta',
  ja_fez: 'Já fez noutro sítio',
  nao_quer: 'Não quer ser contactado',
}

/**
 * Um lembrete está "contactado" se já houve contacto nesta etapa (1 mês, 1 semana ou atrasado)
 * e o cliente ainda não deu uma resposta final. Na etapa seguinte volta a "por contactar".
 */
export function isContacted(reminder: Reminder): boolean {
  return reminder.contact_stage === reminder.stage && reminder.contact_outcome !== null
}

const CHANGED_EVENT = 'oficina-connect:lembretes'

/** Avisa o resto da app (ex.: contador no menu) de que os lembretes mudaram. */
function notifyRemindersChanged(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

export function onRemindersChanged(listener: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, listener)
  return () => window.removeEventListener(CHANGED_EVENT, listener)
}

export async function listReminders(organizationId: string): Promise<Reminder[]> {
  const { data, error } = await supabase.rpc('get_service_reminders', {
    p_organization_id: organizationId,
    p_today: todayIso(),
  })
  if (error) throw error
  return data ?? []
}

export async function logContact(organizationId: string, reminder: Reminder): Promise<void> {
  const { error } = await supabase.from('contact_logs').insert({
    organization_id: organizationId,
    customer_id: reminder.customer_id,
    vehicle_id: reminder.vehicle_id,
    due_date: reminder.due_date,
    stage: reminder.stage,
    channel: 'whatsapp',
    outcome: 'enviado',
  })
  if (error) throw error
  notifyRemindersChanged()
}

export async function setContactOutcome(contactId: string, outcome: ContactOutcome): Promise<void> {
  const { error } = await supabase.from('contact_logs').update({ outcome }).eq('id', contactId)
  if (error) throw error
  notifyRemindersChanged()
}

/** RGPD: o cliente pediu para não ser contactado. */
export async function markCustomerOptOut(customerId: string): Promise<void> {
  const { error } = await supabase.from('customers').update({ contact_opt_out: true }).eq('id', customerId)
  if (error) throw error
}
