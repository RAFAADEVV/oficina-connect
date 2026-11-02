/**
 * Conversão dos valores das células (texto, números ou datas do Excel)
 * para os formatos que a base de dados espera.
 */

export type Cell = string | number | boolean | Date | null | undefined

/** Converte qualquer célula em texto limpo ("" se vazia). */
export function cellToText(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return toIsoDate(cell) ?? ''
  if (typeof cell === 'number') {
    // Evita "912345678.0" ou notação científica em números grandes (telefones, NIF)
    return Number.isInteger(cell) ? cell.toFixed(0) : String(cell)
  }
  return String(cell).replace(/\s+/g, ' ').trim()
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function toIsoDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null
  // As datas do Excel chegam em UTC; usamos os componentes UTC para não mudar de dia
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejeita datas impossíveis como 31/02
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return toIsoDate(date)
}

/**
 * Lê uma data em vários formatos e devolve "AAAA-MM-DD", ou null se não for válida.
 * Aceita: datas do Excel, número de série do Excel, 10/03/2026, 10-03-2026, 10.03.2026,
 * 10/03/26, 2026-03-10 e "2026-03-10 14:30".
 * Em Portugal, 03/04/2026 é sempre lido como 3 de abril (dia/mês/ano).
 */
export function parseDate(cell: Cell): string | null {
  if (cell === null || cell === undefined || cell === '') return null
  if (cell instanceof Date) return toIsoDate(cell)

  if (typeof cell === 'number') {
    // Número de série do Excel (dias desde 30/12/1899). 25569 = 01/01/1970.
    if (cell >= 20000 && cell <= 80000) {
      return toIsoDate(new Date(Math.round((cell - 25569) * 86400 * 1000)))
    }
    return null
  }

  const text = String(cell).trim()

  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(text)
  if (match) return buildIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))

  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/.exec(text)
  if (match) {
    let year = Number(match[3])
    if (match[3].length === 2) year += year > 50 ? 1900 : 2000
    return buildIsoDate(year, Number(match[2]), Number(match[1]))
  }

  return null
}

/** Datas fora deste intervalo são consideradas erro de preenchimento. */
export function isReasonableServiceDate(iso: string): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return iso >= '1980-01-01' && iso <= toIsoDate(tomorrow)!
}

/**
 * Lê um número inteiro: "85.000", "85 000 km", "85000", 85000 → 85000.
 * Devolve null se vazio e 'invalid' se não for um número.
 */
export function parseInteger(cell: Cell): number | null | 'invalid' {
  if (cell === null || cell === undefined || cell === '') return null
  if (typeof cell === 'number') return Number.isFinite(cell) ? Math.round(cell) : 'invalid'
  const text = String(cell)
    .toLowerCase()
    .replace(/km|kms|quil[oó]metros/g, '')
    .replace(/[\s.]/g, '')
    .replace(/,\d+$/, '')
  if (!text) return null
  return /^\d+$/.test(text) ? Number(text) : 'invalid'
}
