/**
 * Normalização, validação e apresentação de dados portugueses
 * (telefones, matrículas, NIF, datas). Usado nos formulários e, mais tarde, na importação.
 */

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

/**
 * Converte um telefone para o formato guardado na base de dados.
 * - Números portugueses de 9 dígitos (9xx, 2xx, 3xx) ganham o prefixo +351.
 * - "00" no início é convertido em "+".
 * Devolve null se não for um telefone válido.
 *
 * Exemplos: "912 345 678" → "+351912345678" · "00351 912345678" → "+351912345678"
 */
export function normalizePhone(input: string): string | null {
  let value = input.trim().replace(/[\s().-]/g, '')
  if (value.startsWith('00')) value = `+${value.slice(2)}`
  if (/^[239]\d{8}$/.test(value)) value = `+351${value}`
  if (/^351[239]\d{8}$/.test(value)) value = `+${value}`
  return /^\+?\d{9,15}$/.test(value) ? value : null
}

/** "+351912345678" → "+351 912 345 678" */
export function formatPhone(phone: string): string {
  const pt = /^\+351(\d{3})(\d{3})(\d{3})$/.exec(phone)
  return pt ? `+351 ${pt[1]} ${pt[2]} ${pt[3]}` : phone
}

/** Número para links do WhatsApp (só dígitos, com indicativo). */
export function whatsappNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}

// ---------------------------------------------------------------------------
// Matrícula
// ---------------------------------------------------------------------------

/** "aa-00 bb" → "AA00BB" (igual ao que a base de dados guarda) */
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidPlate(plate: string): boolean {
  return /^[A-Z0-9]{2,12}$/.test(normalizePlate(plate))
}

/** "AA00BB" → "AA-00-BB" (matrículas portuguesas de 6 caracteres) */
export function formatPlate(plate: string): string {
  return /^[A-Z0-9]{6}$/.test(plate) ? `${plate.slice(0, 2)}-${plate.slice(2, 4)}-${plate.slice(4, 6)}` : plate
}

// ---------------------------------------------------------------------------
// NIF
// ---------------------------------------------------------------------------

/** Valida um NIF português (9 dígitos com dígito de controlo). */
export function isValidNif(input: string): boolean {
  const nif = input.replace(/\s/g, '')
  if (!/^[0-9]{9}$/.test(nif)) return false
  const sum = nif
    .slice(0, 8)
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (9 - index), 0)
  const remainder = sum % 11
  const check = remainder < 2 ? 0 : 11 - remainder
  return check === Number(nif[8])
}

/** Mensagem de erro do NIF, ou undefined se estiver vazio ou válido. */
export function nifError(input: string): string | undefined {
  const nif = input.replace(/\s/g, '')
  if (!nif) return undefined
  if (!/^[0-9]{9}$/.test(nif)) return 'O NIF tem 9 algarismos (pode escrever com ou sem espaços).'
  if (!isValidNif(nif)) return 'Este NIF não existe: confirme os algarismos (o último é de controlo).'
  return undefined
}

// ---------------------------------------------------------------------------
// Datas e números
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
const numberFormatter = new Intl.NumberFormat('pt-PT')

/** "2026-03-10" ou ISO completo → "10/03/2026" */
export function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

/** 85000 → "85 000" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Texto vazio → null (para campos opcionais) */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
