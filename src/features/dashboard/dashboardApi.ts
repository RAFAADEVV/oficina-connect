import { supabase } from '../../lib/supabase'

export interface DashboardCounts {
  customers: number
  vehicles: number
  contactsThisMonth: number
  scheduledThisMonth: number
}

/** Início do mês atual (hora local), para contar contactos e agendamentos do mês. */
export function startOfMonthIso(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

/**
 * Contagens para o dashboard. Só conta (não descarrega) os registos.
 * O RLS garante que só entram dados da oficina do utilizador.
 */
export async function getDashboardCounts(organizationId: string): Promise<DashboardCounts> {
  const monthStart = startOfMonthIso()
  const count = { count: 'exact' as const, head: true }

  const [customers, vehicles, contacts, scheduled] = await Promise.all([
    supabase.from('customers').select('id', count).eq('organization_id', organizationId),
    supabase.from('vehicles').select('id', count).eq('organization_id', organizationId),
    supabase.from('contact_logs').select('id', count).eq('organization_id', organizationId).gte('created_at', monthStart),
    supabase
      .from('contact_logs')
      .select('id', count)
      .eq('organization_id', organizationId)
      .eq('outcome', 'agendado')
      .gte('updated_at', monthStart),
  ])

  const error = customers.error ?? vehicles.error ?? contacts.error ?? scheduled.error
  if (error) throw error

  return {
    customers: customers.count ?? 0,
    vehicles: vehicles.count ?? 0,
    contactsThisMonth: contacts.count ?? 0,
    scheduledThisMonth: scheduled.count ?? 0,
  }
}
