import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInput = Omit<Database['public']['Tables']['customers']['Insert'], 'organization_id'>

export const PAGE_SIZE = 25

/**
 * Prepara o texto de pesquisa para ser usado num filtro do Supabase.
 * Remove caracteres com significado especial no filtro (vírgulas, parênteses, curingas…).
 */
export function sanitizeSearch(term: string): string {
  return term.replace(/[,()*%\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export interface CustomerListResult {
  customers: Customer[]
  total: number
}

/**
 * Lista clientes da oficina, com pesquisa por nome, telefone ou email.
 * O filtro por organization_id é redundante com o RLS, mas deixa a intenção explícita
 * e garante que, num utilizador com várias oficinas, só aparece a oficina atual.
 */
export async function listCustomers(
  organizationId: string,
  search: string,
  page: number,
): Promise<CustomerListResult> {
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('full_name')
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  const term = sanitizeSearch(search)
  if (term) {
    const digits = term.replace(/\D/g, '')
    const filters = [`full_name.ilike.*${term}*`, `email.ilike.*${term}*`]
    if (digits.length >= 3) filters.push(`phone.ilike.*${digits}*`)
    query = query.or(filters.join(','))
  }

  const { data, error, count } = await query
  if (error) throw error
  return { customers: data, total: count ?? 0 }
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCustomer(organizationId: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...input, organization_id: organizationId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase.from('customers').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Apaga um cliente. Só o Dono pode (garantido pelo RLS); os veículos ficam sem dono. */
export async function deleteCustomer(id: string): Promise<void> {
  const { error, count } = await supabase.from('customers').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw { code: '42501' }
}
