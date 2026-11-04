import { describe, expect, it } from 'vitest'
import { inviteMessage, normalizeInviteCode } from './inviteCode'

describe('normalizeInviteCode', () => {
  it('aceita o código com ou sem traços, em minúsculas ou com espaços', () => {
    expect(normalizeInviteCode('abcd-efgh-jkmn')).toBe('ABCD-EFGH-JKMN')
    expect(normalizeInviteCode(' ABCD EFGH JKMN ')).toBe('ABCD-EFGH-JKMN')
    expect(normalizeInviteCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN')
  })

  it('recusa códigos com tamanho errado', () => {
    expect(normalizeInviteCode('')).toBeNull()
    expect(normalizeInviteCode('ABCD-EFGH')).toBeNull()
    expect(normalizeInviteCode('ABCD-EFGH-JKMN-P')).toBeNull()
  })
})

describe('inviteMessage', () => {
  it('inclui o nome da oficina, o endereço e o código', () => {
    const text = inviteMessage('Auto Silva', 'ABCD-EFGH-JKMN', 'https://app.revyauto.pt')
    expect(text).toContain('Auto Silva')
    expect(text).toContain('https://app.revyauto.pt/criar-conta')
    expect(text).toContain('ABCD-EFGH-JKMN')
  })
})
