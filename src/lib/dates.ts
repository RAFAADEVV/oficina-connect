/** Datas no formato "AAAA-MM-DD", sempre segundo o calendário de Portugal. */

/** Data de hoje em Portugal (evita mudar de dia por causa do fuso horário do computador). */
export function todayIso(timeZone = 'Europe/Lisbon'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Soma meses a uma data, ajustando o fim do mês (31/01 + 1 mês → 28/02). */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/** Diferença em dias entre duas datas (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

const monthYear = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "2027-03-10" → "março de 2027" */
export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(`${iso}T00:00:00Z`))
}
