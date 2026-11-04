import { supabase } from '../../lib/supabase'

/**
 * Autenticação em dois passos (TOTP): código de 6 dígitos de uma app como
 * Google Authenticator, Microsoft Authenticator ou 1Password.
 */

export interface TotpFactor {
  id: string
  friendlyName: string | null
  createdAt: string
}

export interface TotpEnrollment {
  factorId: string
  /** Imagem SVG do QR code (data URL) */
  qrCode: string
  /** Chave secreta para introduzir à mão, se não der para ler o QR code */
  secret: string
}

export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/** Fator TOTP já confirmado (ou null se o utilizador não tem MFA ativo). */
export async function getVerifiedTotp(): Promise<TotpFactor | null> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  const factor = data.totp.find((f) => f.status === 'verified')
  return factor ? { id: factor.id, friendlyName: factor.friendly_name ?? null, createdAt: factor.created_at } : null
}

/** Começa a ativação: remove tentativas antigas por concluir e cria um novo QR code. */
export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw listError
  for (const factor of list.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `RevyAuto ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Confirma um código (para terminar a ativação, ou ao entrar). */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}

/** Desativa a autenticação em dois passos. */
export async function removeTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
  // Atualiza a sessão para refletir a remoção
  await supabase.auth.refreshSession()
}
