import { describe, expect, it } from 'vitest'
import { isValidNif, normalizePhone, normalizePlate } from '../../lib/format'
import { buildImport } from './buildImport'
import { detectMapping } from './fields'
import { parseDate, parseInteger } from './parseValues'
import { decodeText, splitHeader } from './readFile'

describe('parseDate', () => {
  it('lê os formatos portugueses (dia/mês/ano)', () => {
    expect(parseDate('10/03/2026')).toBe('2026-03-10')
    expect(parseDate('03/04/2026')).toBe('2026-04-03') // 3 de abril, não 4 de março
    expect(parseDate('10-03-2026')).toBe('2026-03-10')
    expect(parseDate('10.03.2026')).toBe('2026-03-10')
    expect(parseDate('10/03/26')).toBe('2026-03-10')
    expect(parseDate('1/3/2026')).toBe('2026-03-01')
  })

  it('lê datas ISO, com hora, datas e números de série do Excel', () => {
    expect(parseDate('2026-03-10')).toBe('2026-03-10')
    expect(parseDate('2026-03-10 14:30:00')).toBe('2026-03-10')
    expect(parseDate(new Date(Date.UTC(2026, 2, 10)))).toBe('2026-03-10')
    expect(parseDate(46091)).toBe('2026-03-10')
  })

  it('rejeita datas impossíveis ou vazias', () => {
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('13/13/2026')).toBeNull()
    expect(parseDate('amanhã')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate(42)).toBeNull()
  })
})

describe('parseInteger', () => {
  it('lê quilómetros escritos de várias formas', () => {
    expect(parseInteger('85.000')).toBe(85000)
    expect(parseInteger('85 000 km')).toBe(85000)
    expect(parseInteger('85000')).toBe(85000)
    expect(parseInteger(85000)).toBe(85000)
    expect(parseInteger('')).toBeNull()
    expect(parseInteger('muitos')).toBe('invalid')
  })
})

describe('normalização', () => {
  it('telefones portugueses ganham +351', () => {
    expect(normalizePhone('912 345 678')).toBe('+351912345678')
    expect(normalizePhone('00351 912345678')).toBe('+351912345678')
    expect(normalizePhone('351912345678')).toBe('+351912345678')
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123')
    expect(normalizePhone('123')).toBeNull()
  })

  it('matrículas sem separadores e em maiúsculas', () => {
    expect(normalizePlate('aa-00 bb')).toBe('AA00BB')
  })

  it('valida o dígito de controlo do NIF', () => {
    expect(isValidNif('123456789')).toBe(true)
    expect(isValidNif('123456780')).toBe(false)
  })
})

describe('detectMapping', () => {
  it('reconhece cabeçalhos comuns, com e sem acentos', () => {
    const mapping = detectMapping(['Nome do Cliente', 'Telemóvel', 'Matrícula', 'Marca', 'Data Serviço', 'Descrição', 'Km', 'Km do serviço'])
    expect(mapping).toEqual({
      full_name: 0,
      phone: 1,
      plate: 2,
      make: 3,
      service_date: 4,
      service_description: 5,
      mileage: 6,
      service_mileage: 7,
    })
  })

  it('não usa a mesma coluna duas vezes', () => {
    const mapping = detectMapping(['Nome', 'Nome'])
    expect(mapping.full_name).toBe(0)
    expect(Object.values(mapping)).toEqual([0])
  })
})

describe('leitura de CSV', () => {
  it('lê ficheiros gravados pelo Excel português (Windows-1252)', () => {
    const bytes = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]) // "João" em Windows-1252
    expect(decodeText(bytes.buffer)).toBe('João')
  })

  it('lê UTF-8 e remove o BOM', () => {
    const bytes = new TextEncoder().encode('﻿Matrícula')
    expect(decodeText(bytes.buffer as ArrayBuffer)).toBe('Matrícula')
  })

  it('ignora linhas vazias no início e no fim', () => {
    const data = splitHeader([[null, null], ['Nome', 'Telefone'], ['Ana', '912345678'], ['', '']])
    expect(data.headers).toEqual(['Nome', 'Telefone'])
    expect(data.rows).toHaveLength(1)
    expect(data.firstDataLine).toBe(3)
  })
})

describe('buildImport', () => {
  const mapping = detectMapping(['Nome', 'Telefone', 'Email', 'NIF', 'Matrícula', 'Ano', 'Data', 'Serviço'])

  it('aceita linhas válidas e conta clientes e veículos distintos', () => {
    const plan = buildImport(
      [
        ['Maria Santos', '912 345 678', 'maria@exemplo.pt', '123456789', 'aa-00-bb', 2015, '10/03/2026', 'Revisão'],
        ['Maria Santos', '912345678', '', '', 'CC-11-DD', '', '02/11/2025', 'Pneus'],
        ['João Costa', '933 333 333', '', '', '', '', '', ''],
      ],
      mapping,
    )
    expect(plan.rows).toHaveLength(3)
    expect(plan.issues).toEqual([])
    expect(plan.distinctCustomers).toBe(2)
    expect(plan.distinctVehicles).toBe(2)
    expect(plan.services).toBe(2)
    expect(plan.rows[0]).toMatchObject({ phone: '+351912345678', plate: 'AA00BB', year: 2015, service_date: '2026-03-10' })
  })

  it('ignora linhas sem nome ou com telefone inválido, indicando a linha do ficheiro', () => {
    const plan = buildImport(
      [
        ['', '912345678', '', '', '', '', '', ''],
        ['Rui', 'abc', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
      ],
      mapping,
    )
    expect(plan.rows).toHaveLength(0)
    expect(plan.skipped).toBe(2)
    expect(plan.issues.map((i) => [i.line, i.level])).toEqual([
      [2, 'error'],
      [3, 'error'],
    ])
  })

  it('lê a próxima revisão e rejeita datas anteriores ao serviço', () => {
    const withNext = detectMapping(['Nome', 'Telefone', 'Matrícula', 'Data', 'Serviço', 'Próxima revisão'])
    const plan = buildImport(
      [
        ['Ana', '912345678', 'AA00BB', '10/03/2026', 'Revisão', '10/03/2027'],
        ['Rui', '913333333', 'CC11DD', '10/03/2026', 'Revisão', '01/01/2026'],
      ],
      withNext,
    )
    expect(withNext.next_service_date).toBe(5)
    expect(plan.rows.map((r) => r.next_service_date)).toEqual(['2027-03-10', null])
    expect(plan.issues).toHaveLength(1)
  })

  it('importa o cliente mas descarta dados inválidos com aviso', () => {
    const plan = buildImport([['Ana', '912345678', 'ana@', '111111111', 'AA00BB', 1700, '31/02/2026', 'Revisão']], mapping)
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0]).toMatchObject({ email: null, nif: null, year: null, service_date: null })
    expect(plan.issues.filter((i) => i.level === 'warning')).toHaveLength(4)
  })
})
