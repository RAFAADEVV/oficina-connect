import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type OrganizationDetails = Pick<
  Database['public']['Tables']['organizations']['Row'],
  'id' | 'name' | 'address' | 'phone' | 'email' | 'nif' | 'service_interval_months'
>
export type OrganizationUpdate = Omit<OrganizationDetails, 'id'>

const COLUMNS = 'id, name, address, phone, email, nif, service_interval_months'

export async function getOrganizationDetails(id: string): Promise<OrganizationDetails> {
  const { data, error } = await supabase.from('organizations').select(COLUMNS).eq('id', id).single()
  if (error) throw error
  return data
}

/** Atualiza os dados da oficina. Só o Dono pode (garantido pelo RLS). */
export async function updateOrganization(id: string, input: OrganizationUpdate): Promise<OrganizationDetails> {
  const { data, error } = await supabase.from('organizations').update(input).eq('id', id).select(COLUMNS).single()
  if (error) throw error
  return data
}
