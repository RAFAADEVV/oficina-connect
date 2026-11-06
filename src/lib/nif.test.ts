import { describe, expect, it } from 'vitest'
import { nifError } from './format'

describe('nifError', () => {
  it('aceita um NIF válido, com ou sem espaços', () => {
    expect(nifError('503504564')).toBeUndefined()
    expect(nifError('503 504 564')).toBeUndefined()
    expect(nifError('')).toBeUndefined()
  })
  it('explica quando faltam algarismos', () => {
    expect(nifError('5035045')).toMatch(/9 algarismos/)
  })
  it('explica quando o número não existe (dígito de controlo errado)', () => {
    expect(nifError('555 555 555')).toMatch(/não existe/)
  })
})
