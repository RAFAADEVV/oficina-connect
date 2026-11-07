/** "abcd efgh-jklm" → "ABCD-EFGH-JKLM" (ou null se não tiver 12 caracteres). */
export function normalizeInviteCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length !== 12) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
}

/** Texto para enviar ao funcionário (WhatsApp ou outro). */
export function inviteMessage(organizationName: string, code: string, appUrl: string, email: string): string {
  return [
    `Olá! Foi convidado para a equipa da ${organizationName} no RevyAuto.`,
    `1. Crie conta em ${appUrl}/criar-conta com o email ${email}`,
    `2. Escolha "Tenho um código de convite" e escreva: ${code}`,
    'O código é válido durante 7 dias e só pode ser usado uma vez.',
  ].join('\n')
}
