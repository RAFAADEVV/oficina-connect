import { describe, expect, it } from 'vitest'
import { exportFileName } from './exportFileName'

describe('exportFileName', () => {
  const day = new Date('2026-11-04T12:00:00Z')
  it('tira acentos e espaços do nome', () => {
    expect(exportFileName('Maria João Gonçalves', day)).toBe('dados-maria-joao-goncalves-2026-11-04.json')
  })
  it('usa "cliente" quando o nome não tem letras', () => {
    expect(exportFileName('***', day)).toBe('dados-cliente-2026-11-04.json')
  })
})
