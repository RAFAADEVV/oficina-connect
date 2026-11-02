import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { PAGE_SIZE, sanitizeSearch } from '../customers/customersApi'

export type Vehicle = Database['public']['Tables']['vehicles']['Row']
export type VehicleInput = Omit<Database['public']['Tables']['vehicles']['Insert'], 'organization_id'>

export interface VehicleWithOwner extends Vehicle {
  ownerName: string | null
}

export interface VehicleListResult {
  vehicles: VehicleWithOwner[]
  total: number
}

/** Vai buscar os nomes dos donos de uma lista de veículos (uma única consulta). */
async function attachOwners(vehicles: Vehicle[]): Promise<VehicleWithOwner[]> {
  const ids = [...new Set(vehicles.map((v) => v.customer_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return vehicles.map((v) => ({ ...v, ownerName: null }))

  const { data, error } = await supabase.from('customers').select('id, full_name').in('id', ids)
  if (error) throw error
  const names = new Map(data.map((c) => [c.id, c.full_name]))
  return vehicles.map((v) => ({ ...v, ownerName: v.customer_id ? (names.get(v.customer_id) ?? null) : null }))
}

/** Lista veículos da oficina, com pesquisa por matrícula, marca ou modelo. */
export async function listVehicles(
  organizationId: string,
  search: string,
  page: number,
): Promise<VehicleListResult> {
  let query = supabase
    .from('vehicles')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('plate')
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  const term = sanitizeSearch(search)
  if (term) {
    const plate = term.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const filters = [`make.ilike.*${term}*`, `model.ilike.*${term}*`]
    if (plate) filters.push(`plate.ilike.*${plate}*`)
    query = query.or(filters.join(','))
  }

  const { data, error, count } = await query
  if (error) throw error
  return { vehicles: await attachOwners(data), total: count ?? 0 }
}

export async function listCustomerVehicles(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .order('plate')
  if (error) throw error
  return data
}

export async function createVehicle(organizationId: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...input, organization_id: organizationId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await supabase.from('vehicles').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Apaga um veículo e o seu histórico de serviços. Só o Dono pode (garantido pelo RLS). */
export async function deleteVehicle(id: string): Promise<void> {
  const { error, count } = await supabase.from('vehicles').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw { code: '42501' }
}

export { PAGE_SIZE }
