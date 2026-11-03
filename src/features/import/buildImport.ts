import { isValidNif, isValidPlate, normalizePhone, normalizePlate } from '../../lib/format'
import { validateEmail } from '../auth/validation'
import type { ColumnMapping, ImportField } from './fields'
import { cellToText, isReasonableServiceDate, parseDate, parseInteger, type Cell } from './parseValues'

/** Uma linha já validada, no formato que a função import_records espera. */
export interface ImportRow {
  full_name: string
  phone: string
  email: string | null
  nif: string | null
  address: string | null
  plate: string | null
  make: string | null
  model: string | null
  year: number | null
  mileage: number | null
  service_date: string | null
  service_description: string | null
  service_mileage: number | null
  /** Próxima revisão combinada (AAAA-MM-DD). O tipo de serviço é reconhecido pela base de dados a partir da descrição. */
  next_service_date: string | null
}

export interface RowIssue {
  /** Número da linha no ficheiro (como o utilizador a vê no Excel) */
  line: number
  level: 'error' | 'warning'
  message: string
}

export interface ImportPlan {
  rows: ImportRow[]
  issues: RowIssue[]
  /** Linhas com dados que vão ser ignoradas por erro */
  skipped: number
  /** Estimativas a partir do ficheiro (a base de dados pode reutilizar registos já existentes) */
  distinctCustomers: number
  distinctVehicles: number
  services: number
}

const currentYear = new Date().getFullYear()

function truncate(value: string, max: number): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

/**
 * Valida e normaliza as linhas do ficheiro segundo o mapeamento de colunas.
 * - Erros (linha ignorada): sem nome, telefone em falta ou inválido.
 * - Avisos (linha importada sem esse dado): email/NIF/matrícula/ano/km/data inválidos, etc.
 *
 * @param dataRows linhas de dados (sem o cabeçalho)
 * @param firstLine número da primeira linha de dados no ficheiro (normalmente 2)
 */
export function buildImport(dataRows: Cell[][], mapping: ColumnMapping, firstLine = 2): ImportPlan {
  const rows: ImportRow[] = []
  const issues: RowIssue[] = []
  const phones = new Set<string>()
  const plates = new Set<string>()
  let services = 0
  let skipped = 0

  const get = (row: Cell[], field: ImportField): Cell => {
    const index = mapping[field]
    return index === undefined ? null : row[index]
  }
  const text = (row: Cell[], field: ImportField) => cellToText(get(row, field))

  dataRows.forEach((row, i) => {
    const line = firstLine + i
    // Linhas completamente vazias são ignoradas sem aviso
    if (row.every((cell) => cellToText(cell) === '')) return

    const warn = (message: string) => issues.push({ line, level: 'warning', message })

    // --- Cliente (obrigatório) ---
    const fullName = truncate(text(row, 'full_name'), 200)
    const rawPhone = text(row, 'phone')
    const phone = rawPhone ? normalizePhone(rawPhone) : null

    if (!fullName || !phone) {
      skipped += 1
      issues.push({
        line,
        level: 'error',
        message: !fullName
          ? 'Sem nome do cliente — linha ignorada.'
          : rawPhone
            ? `Telefone inválido ("${rawPhone}") — linha ignorada.`
            : 'Sem telefone — linha ignorada.',
      })
      return
    }

    let email: string | null = truncate(text(row, 'email'), 254)
    if (email && validateEmail(email)) {
      warn(`Email inválido ("${email}") — não será importado.`)
      email = null
    }

    let nif: string | null = text(row, 'nif').replace(/\s/g, '') || null
    if (nif && /^PT/i.test(nif)) nif = nif.slice(2)
    if (nif && !isValidNif(nif)) {
      warn(`NIF inválido ("${nif}") — não será importado.`)
      nif = null
    }

    // --- Veículo (opcional) ---
    const rawPlate = text(row, 'plate')
    let plate: string | null = rawPlate ? normalizePlate(rawPlate) : null
    if (rawPlate && (!plate || !isValidPlate(plate))) {
      warn(`Matrícula inválida ("${rawPlate}") — veículo e serviço não serão importados.`)
      plate = null
    }

    let year: number | null = null
    let mileage: number | null = null
    if (plate) {
      const parsedYear = parseInteger(get(row, 'year'))
      if (parsedYear === 'invalid' || (parsedYear !== null && (parsedYear < 1900 || parsedYear > currentYear + 1))) {
        warn(`Ano inválido ("${text(row, 'year')}") — não será importado.`)
      } else {
        year = parsedYear
      }
      const parsedMileage = parseInteger(get(row, 'mileage'))
      if (parsedMileage === 'invalid' || (parsedMileage !== null && parsedMileage > 3_000_000)) {
        warn(`Quilómetros inválidos ("${text(row, 'mileage')}") — não serão importados.`)
      } else {
        mileage = parsedMileage
      }
    }

    // --- Serviço (opcional; precisa de veículo, data e descrição) ---
    let serviceDate: string | null = null
    let serviceDescription: string | null = null
    let serviceMileage: number | null = null
    let nextServiceDate: string | null = null
    const rawDate = text(row, 'service_date')
    const description = truncate(text(row, 'service_description'), 500)

    if (rawDate || description) {
      const parsed = parseDate(get(row, 'service_date'))
      if (!plate) {
        if (!rawPlate) warn('Serviço sem matrícula — o serviço não será importado.')
      } else if (!parsed || !isReasonableServiceDate(parsed)) {
        warn(rawDate ? `Data inválida ("${rawDate}") — o serviço não será importado.` : 'Serviço sem data — não será importado.')
      } else if (!description) {
        warn('Serviço sem descrição — não será importado.')
      } else {
        serviceDate = parsed
        serviceDescription = description
        const parsedServiceMileage = parseInteger(get(row, 'service_mileage'))
        serviceMileage = typeof parsedServiceMileage === 'number' && parsedServiceMileage <= 3_000_000 ? parsedServiceMileage : null
        const rawNext = text(row, 'next_service_date')
        if (rawNext) {
          const parsedNext = parseDate(get(row, 'next_service_date'))
          if (!parsedNext || parsedNext <= parsed || parsedNext >= '2100-01-01') {
            warn(`Próxima revisão inválida ("${rawNext}") — tem de ser depois da data do serviço; não será importada.`)
          } else {
            nextServiceDate = parsedNext
          }
        }
        services += 1
      }
    }

    phones.add(phone)
    if (plate) plates.add(plate)

    rows.push({
      full_name: fullName,
      phone,
      email,
      nif,
      address: truncate(text(row, 'address'), 300),
      plate,
      make: plate ? truncate(text(row, 'make'), 60) : null,
      model: plate ? truncate(text(row, 'model'), 80) : null,
      year,
      mileage,
      service_date: serviceDate,
      service_description: serviceDescription,
      service_mileage: serviceMileage,
      next_service_date: nextServiceDate,
    })
  })

  return {
    rows,
    issues,
    skipped,
    distinctCustomers: phones.size,
    distinctVehicles: plates.size,
    services,
  }
}
