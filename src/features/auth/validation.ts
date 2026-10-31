/** Validações dos formulários de conta (a base de dados e o Supabase validam também). */

export const MIN_PASSWORD_LENGTH = 8

export function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Indique o seu email.'
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Indique um email válido.'
  }
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Indique uma password.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A password deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (password.length > 72) return 'A password não pode ter mais de 72 caracteres.'
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'A password deve ter letras e números.'
  }
  return undefined
}

export function validateName(name: string, label: string): string | undefined {
  const value = name.trim()
  if (value.length < 2) return `Indique ${label} (pelo menos 2 caracteres).`
  if (value.length > 120) return `${label[0].toUpperCase()}${label.slice(1)} não pode ter mais de 120 caracteres.`
  return undefined
}

/** Endereço base da app (ex.: http://localhost:5173), usado nos links enviados por email. */
export function appUrl(path = '/'): string {
  return `${window.location.origin}${path}`
}
