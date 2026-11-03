import { formatDate, formatPlate, whatsappNumber } from '../../lib/format'
import type { ReminderStage } from '../../types/database'

export interface MessageData {
  customer_name: string
  plate: string
  make: string | null
  model: string | null
  due_date: string
  stage: ReminderStage
}

/** "Maria José Santos" → "Maria" */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

/** "o seu Renault Clio (AA-00-BB)" ou "o seu carro (AA-00-BB)" */
function carDescription(data: MessageData): string {
  const name = [data.make, data.model].filter(Boolean).join(' ')
  return `${name || 'carro'} (${formatPlate(data.plate)})`
}

/** Mensagem sugerida para cada etapa. O mecânico pode editá-la antes de enviar. */
export function buildReminderMessage(data: MessageData, organizationName: string): string {
  const greeting = `Olá ${firstName(data.customer_name)},`
  const car = carDescription(data)
  const date = formatDate(data.due_date)

  const body: Record<ReminderStage, string> = {
    mes: `daqui a cerca de um mês (${date}) está prevista a revisão do seu ${car}. Quer que lhe marquemos já uma data?`,
    semana: `a revisão do seu ${car} está prevista para ${date}. Ainda não tem marcação — quer agendar?`,
    atrasado: `a revisão do seu ${car} estava prevista para ${date}. Quer marcar uma data?`,
  }

  return `${greeting} ${body[data.stage]}\n\n${organizationName}`
}

/** Link que abre o WhatsApp (app ou web) com a mensagem já escrita. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`
}
