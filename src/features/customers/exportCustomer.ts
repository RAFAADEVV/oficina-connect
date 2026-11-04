import { supabase } from '../../lib/supabase'

/**
 * RGPD (direito de acesso e portabilidade, art.º 15.º e 20.º):
 * junta tudo o que a oficina tem sobre um cliente num ficheiro JSON legível.
 *
 * Só lê através da API normal, por isso as regras RLS aplicam-se:
 * nunca inclui dados de outra oficina.
 */

/** Campos internos que não interessam ao cliente. */
const INTERNAL = new Set(['organization_id', 'created_by'])

function clean<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !INTERNAL.has(key)))
}

export interface CustomerExport {
  exportado_em: string
  oficina: string
  cliente: Record<string, unknown>
  veiculos: Record<string, unknown>[]
  servicos: Record<string, unknown>[]
  contactos: Record<string, unknown>[]
}

export async function buildCustomerExport(customerId: string, organizationName: string): Promise<CustomerExport> {
  const [customer, vehicles, contacts] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('vehicles').select('*').eq('customer_id', customerId).order('created_at'),
    supabase.from('contact_logs').select('*').eq('customer_id', customerId).order('created_at'),
  ])
  if (customer.error) throw customer.error
  if (vehicles.error) throw vehicles.error
  if (contacts.error) throw contacts.error

  const vehicleIds = vehicles.data.map((v) => v.id)
  let services: Record<string, unknown>[] = []
  if (vehicleIds.length > 0) {
    const records = await supabase
      .from('service_records')
      .select('*')
      .in('vehicle_id', vehicleIds)
      .order('service_date')
    if (records.error) throw records.error

    const serviceIds = records.data.map((s) => s.id)
    const parts =
      serviceIds.length > 0
        ? await supabase.from('service_parts').select('*').in('service_record_id', serviceIds).order('position')
        : { data: [], error: null }
    if (parts.error) throw parts.error

    services = records.data.map((service) => ({
      ...clean(service),
      pecas: parts.data.filter((p) => p.service_record_id === service.id).map(clean),
    }))
  }

  return {
    exportado_em: new Date().toISOString(),
    oficina: organizationName,
    cliente: clean(customer.data),
    veiculos: vehicles.data.map(clean),
    servicos: services,
    contactos: contacts.data.map(clean),
  }
}

/** Descarrega o ficheiro no navegador (nada é enviado para fora). */
export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
