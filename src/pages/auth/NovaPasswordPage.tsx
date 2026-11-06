import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, FullPageLoader, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { getVerifiedTotp, isValidCode, verifyTotp } from '../../features/auth/mfa'
import { useAuth } from '../../features/auth/useAuth'
import { MIN_PASSWORD_LENGTH, validatePassword } from '../../features/auth/validation'
import { supabase } from '../../lib/supabase'
import { usePageTitle } from '../../lib/usePageTitle'

/**
 * Página aberta a partir do link de recuperação enviado por email.
 * Com a autenticação em dois passos ativa, pede também o código da app:
 * o link prova que a pessoa tem o email, o código prova o segundo passo.
 */
export function NovaPasswordPage() {
  usePageTitle('Nova password')
  const navigate = useNavigate()
  const { user, isLoading, needsMfa, refreshMfa } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; password?: string; confirmPassword?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) return <FullPageLoader />

  // Sem sessão: o link é inválido, expirou ou já foi usado.
  if (!user) {
    return (
      <AuthLayout title="Link inválido ou expirado">
        <p className="text-sm text-slate-600">
          Este link de recuperação já não é válido. Peça um novo link para definir a sua password.
        </p>
        <Link
          to="/recuperar-password"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-ink hover:bg-brand-500"
        >
          Pedir novo link
        </Link>
      </AuthLayout>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const cleanCode = code.replace(/\s/g, '')
    const errors = {
      code: needsMfa && !isValidCode(cleanCode) ? 'Introduza os 6 dígitos da sua app de autenticação.' : undefined,
      password: validatePassword(password),
      confirmPassword: password === confirmPassword ? undefined : 'As passwords não coincidem.',
    }
    setFieldErrors(errors)
    if (errors.code || errors.password || errors.confirmPassword) return

    setIsSubmitting(true)
    try {
      // 1. Segundo passo (só quem o tem ativo)
      if (needsMfa) {
        const factor = await getVerifiedTotp()
        if (factor) await verifyTotp(factor.id, cleanCode)
        await refreshMfa()
      }
      // 2. Nova password
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setCode('')
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Definir nova password" description="Escolha uma nova password para a sua conta.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        {needsMfa && (
          <TextField
            label="Código da app de autenticação"
            hint="A sua conta tem verificação em dois passos: abra a app e introduza o código de 6 dígitos."
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={fieldErrors.code}
            autoFocus
          />
        )}
        <TextField
          label="Nova password"
          type="password"
          autoComplete="new-password"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres, com letras e números.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <TextField
          label="Confirmar nova password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Guardar password
        </Button>
      </form>
    </AuthLayout>
  )
}
