import { supabase } from '../../lib/supabase'
import type { Database, Json, ServiceType } from '../../types/database'

export type ServiceRecord = Database['public']['Tables']['service_records']['Row']
export type ServicePart = Database['public']['Tables']['service_parts']['Row']

export interface ServiceInput {
  service_date: string
  service_type: ServiceType
  description: string
  mileage: number | null
  next_service_date: string | null
  next_service_mileage: number | null
  problem: string | null
  work_done: string | null
  checklist: string[]
  recommendations: string | null
}

export interface PartInput {
  /** Só ao editar: id de uma peça que já existia neste serviço */
  id?: string
  description: string
  reference: string | null
  quantity: number
}

export const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'revisao', label: 'Revisão' },
  { value: 'oleo', label: 'Óleo e filtros' },
  { value: 'reparacao', label: 'Reparação' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'travoes', label: 'Travões' },
  { value: 'outro', label: 'Outro' },
]

/** Tipos de serviço que contam como revisão para os lembretes. */
export const REVISION_TYPES: ServiceType[] = ['revisao', 'oleo']

/** Lista de verificação sugerida nas revisões. */
export const CHECKLIST_ITEMS = [
  'Óleo do motor',
  'Filtro de óleo',
  'Filtro de ar',
  'Filtro de habitáculo',
  'Filtro de combustível',
  'Velas',
  'Líquido de refrigeração',
  'Líquido de travões',
  'Travões verificados',
  'Pneus e pressões',
  'Luzes',
  'Bateria',
  'Escovas limpa-vidros',
  'Correia de distribuição verificada',
]

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

/** Grava o serviço e as peças de uma só vez (se algo falhar, nada fica gravado). */
export async function createService(vehicleId: string, input: ServiceInput, parts: PartInput[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_service_record', {
    p_vehicle_id: vehicleId,
    p_service: input as unknown as Json,
    p_parts: parts as unknown as Json,
  })
  if (error) throw error
  return data
}

export async function listServiceParts(serviceId: string): Promise<ServicePart[]> {
  const { data, error } = await supabase
    .from('service_parts')
    .select('*')
    .eq('service_record_id', serviceId)
    .order('position')
  if (error) throw error
  return data
}

/**
 * Corrige um serviço já registado e as suas peças, de uma só vez.
 * Peças com id são alteradas, as novas acrescentadas e as que faltam apagadas (ficam no registo de eliminações).
 */
export async function updateService(serviceId: string, input: ServiceInput, parts: PartInput[]): Promise<void> {
  const { error } = await supabase.rpc('update_service_record', {
    p_service_id: serviceId,
    p_service: input as unknown as Json,
    p_parts: parts as unknown as Json,
  })
  if (error) throw error
}

/** Apaga um serviço e as suas peças. Só o Dono pode (garantido pelo RLS). */
export async function deleteService(id: string): Promise<void> {
  const { error, count } = await supabase.from('service_records').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw { code: '42501' }
}

export interface ServiceReport {
  service: ServiceRecord
  parts: ServicePart[]
  vehicle: Database['public']['Tables']['vehicles']['Row']
  customer: Database['public']['Tables']['customers']['Row'] | null
  organization: Pick<Database['public']['Tables']['organizations']['Row'], 'name' | 'address' | 'phone' | 'email' | 'nif'>
}

/** Junta tudo o que o relatório de serviço precisa. O RLS garante que só vê dados da sua oficina. */
export async function getServiceReport(serviceId: string): Promise<ServiceReport> {
  const service = await supabase.from('service_records').select('*').eq('id', serviceId).single()
  if (service.error) throw service.error

  const [parts, vehicle, organization] = await Promise.all([
    supabase.from('service_parts').select('*').eq('service_record_id', serviceId).order('position'),
    supabase.from('vehicles').select('*').eq('id', service.data.vehicle_id).single(),
    supabase.from('organizations').select('name, address, phone, email, nif').eq('id', service.data.organization_id).single(),
  ])
  if (parts.error) throw parts.error
  if (vehicle.error) throw vehicle.error
  if (organization.error) throw organization.error

  let customer: ServiceReport['customer'] = null
  if (vehicle.data.customer_id) {
    const result = await supabase.from('customers').select('*').eq('id', vehicle.data.customer_id).maybeSingle()
    if (result.error) throw result.error
    customer = result.data
  }

  return { service: service.data, parts: parts.data, vehicle: vehicle.data, customer, organization: organization.data }
}
