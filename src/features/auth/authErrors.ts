/**
 * Converte erros do Supabase em mensagens claras em português.
 * Nunca mostra ao utilizador detalhes técnicos nem regista dados pessoais.
 */

interface ErrorLike {
  code?: string
  message?: string
  status?: number
}

const messages: Record<string, string> = {
  invalid_credentials: 'Email ou password incorretos.',
  email_not_confirmed: 'Ainda não confirmou o seu email. Verifique a sua caixa de correio (e o spam).',
  user_already_exists: 'Já existe uma conta com este email.',
  email_exists: 'Já existe uma conta com este email.',
  weak_password: 'A password é demasiado fraca. Use pelo menos 8 caracteres, com letras e números.',
  same_password: 'A nova password tem de ser diferente da anterior.',
  email_address_invalid: 'O endereço de email não é válido.',
  over_email_send_rate_limit: 'Foram enviados demasiados emails. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Demasiadas tentativas. Aguarde alguns minutos e tente de novo.',
  signup_disabled: 'O registo de novas contas está desativado.',
  session_not_found: 'A sua sessão expirou. Entre novamente.',
  otp_expired: 'O link expirou ou já foi usado. Peça um novo.',
}

export function getErrorMessage(error: unknown): string {
  const err = (error ?? {}) as ErrorLike

  if (err.code && messages[err.code]) {
    return messages[err.code]
  }

  // Alternativa para versões do servidor que não enviam o código do erro
  const text = err.message?.toLowerCase() ?? ''
  if (text.includes('invalid login credentials')) return messages.invalid_credentials
  if (text.includes('email not confirmed')) return messages.email_not_confirmed
  if (text.includes('already registered')) return messages.user_already_exists

  // Erros de rede (sem internet, servidor indisponível)
  if (error instanceof TypeError || err.message?.toLowerCase().includes('fetch')) {
    return 'Não foi possível ligar ao servidor. Verifique a sua ligação à internet.'
  }

  // Mensagens das nossas funções SQL (já estão em português)
  if (err.code === '22023' && err.message) {
    return err.message
  }

  if (import.meta.env.DEV) {
    // Só em desenvolvimento, e sem dados pessoais: código e estado do erro
    console.warn('Erro não mapeado:', err.code ?? 'sem código', err.status ?? '')
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}
