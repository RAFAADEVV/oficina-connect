import { supabase } from '../../lib/supabase'
import type { Json } from '../../types/database'
import type { ImportRow } from './buildImport'

export const BATCH_SIZE = 500

export interface ImportTotals {
  customers_created: number
  customers_reused: number
  vehicles_created: number
  vehicles_reused: number
  services_created: number
  services_skipped: number
}

const emptyTotals = (): ImportTotals => ({
  customers_created: 0,
  customers_reused: 0,
  vehicles_created: 0,
  vehicles_reused: 0,
  services_created: 0,
  services_skipped: 0,
})

/**
 * Envia as linhas em lotes. Cada lote é gravado por inteiro ou não é gravado.
 * Se um lote falhar, os anteriores já ficaram gravados — por isso a função de importação
 * não duplica nada e pode ser repetida em segurança com o mesmo ficheiro.
 */
export async function runImport(
  organizationId: string,
  rows: ImportRow[],
  onProgress: (done: number, total: number) => void,
): Promise<ImportTotals> {
  const totals = emptyTotals()
  // Os "reutilizados" de um lote podem ter sido criados num lote anterior; contamos só os criados
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)
    const { data, error } = await supabase.rpc('import_records', {
      p_organization_id: organizationId,
      p_rows: batch as unknown as Json,
    })
    if (error) throw error
    const result = data as unknown as ImportTotals
    for (const key of Object.keys(totals) as (keyof ImportTotals)[]) totals[key] += result[key] ?? 0
    onProgress(Math.min(start + BATCH_SIZE, rows.length), rows.length)
  }
  return totals
}

export interface ImportLogInput {
  file_name: string
  rows_total: number
  rows_skipped: number
  customers_created: number
  vehicles_created: number
  services_created: number
}

export async function logImport(organizationId: string, input: ImportLogInput): Promise<void> {
  const { error } = await supabase.from('imports').insert({ ...input, organization_id: organizationId })
  if (error) throw error
}

export interface ImportLogEntry extends ImportLogInput {
  id: string
  created_at: string
}

export async function listImports(organizationId: string): Promise<ImportLogEntry[]> {
  const { data, error } = await supabase
    .from('imports')
    .select('id, file_name, rows_total, rows_skipped, customers_created, vehicles_created, services_created, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return data
}

/** Cria e descarrega o modelo CSV (separado por ";" e com acentos corretos no Excel). */
export function downloadTemplate(headers: string[]): void {
  const content = `﻿${headers.join(';')}\r\n`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-importacao-oficina-connect.csv'
  link.click()
  URL.revokeObjectURL(url)
}
