import { describe, expect, it } from 'vitest'
import { addMonths, daysBetween } from '../../lib/dates'
import { buildReminderMessage, whatsappLink } from './message'

describe('buildReminderMessage', () => {
  const base = { customer_name: 'Maria José Santos', plate: 'AA00BB', make: 'Renault', model: 'Clio', due_date: '2027-03-10' }

  it('escreve a mensagem de 1 mês antes com o primeiro nome e o carro', () => {
    expect(buildReminderMessage({ ...base, stage: 'mes' }, 'Auto Silva')).toBe(
      'Olá Maria, daqui a cerca de um mês (10/03/2027) está prevista a revisão do seu Renault Clio (AA-00-BB). Quer que lhe marquemos já uma data?\n\nAuto Silva',
    )
  })

  it('usa "carro" quando não há marca nem modelo', () => {
    expect(buildReminderMessage({ ...base, make: null, model: null, stage: 'atrasado' }, 'Auto Silva')).toContain(
      'do seu carro (AA-00-BB) estava prevista para 10/03/2027',
    )
  })
})

describe('whatsappLink', () => {
  it('usa só dígitos no número e codifica o texto', () => {
    expect(whatsappLink('+351912345678', 'Olá Maria')).toBe('https://wa.me/351912345678?text=Ol%C3%A1%20Maria')
  })
})

describe('datas', () => {
  it('soma meses ajustando o fim do mês', () => {
    expect(addMonths('2026-03-10', 12)).toBe('2027-03-10')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
  })

  it('calcula a diferença em dias', () => {
    expect(daysBetween('2026-06-01', '2026-06-20')).toBe(19)
    expect(daysBetween('2026-06-20', '2026-06-01')).toBe(-19)
  })
})
