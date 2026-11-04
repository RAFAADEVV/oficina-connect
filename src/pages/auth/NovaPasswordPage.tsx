import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, FullPageLoader, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import { MIN_PASSWORD_LENGTH, validatePassword } from '../../features/auth/validation'
import { supabase } from '../../lib/supabase'
import { usePageTitle } from '../../lib/usePageTitle'

/** Página aberta a partir do link de recuperação enviado por email. */
export function NovaPasswordPage() {
  usePageTitle('Nova password')
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({})
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

    const errors = {
      password: validatePassword(password),
      confirmPassword: password === confirmPassword ? undefined : 'As passwords não coincidem.',
    }
    setFieldErrors(errors)
    if (errors.password || errors.confirmPassword) return

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) {
      setFormError(getErrorMessage(error))
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Definir nova password" description="Escolha uma nova password para a sua conta.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}
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
