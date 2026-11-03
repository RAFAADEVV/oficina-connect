import { supabase } from '../../lib/supabase'
import type { Database, ServiceType } from '../../types/database'

export type ServiceRecord = Database['public']['Tables']['service_records']['Row']
export type ServiceInput = Omit<Database['public']['Tables']['service_records']['Insert'], 'organization_id' | 'vehicle_id'>

export const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'revisao', label: 'Revisão' },
  { value: 'oleo', label: 'Óleo e filtros' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'travoes', label: 'Travões' },
  { value: 'outro', label: 'Outro' },
]

/** Tipos de serviço que contam como revisão para os lembretes. */
export const REVISION_TYPES: ServiceType[] = ['revisao', 'oleo']

export function serviceTypeLabel(type: ServiceType): string {
  return SERVICE_TYPES.find((t) => t.value === type)?.label ?? 'Outro'
}

export async function listVehicleServices(vehicleId: string): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from('service_records')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createService(organizationId: string, vehicleId: string, input: ServiceInput): Promise<ServiceRecord> {
  const { data, error } = await supabase
    .from('service_records')
    .insert({ ...input, organization_id: organizationId, vehicle_id: vehicleId })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Apaga um serviço. Só o Dono pode (garantido pelo RLS). */
export async function deleteService(id: string): Promise<void> {
  const { error, count } = await supabase.from('service_records').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw { code: '42501' }
}
