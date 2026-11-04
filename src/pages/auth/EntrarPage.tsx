import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { isCaptchaEnabled } from '../../config/env'
import { Turnstile, type TurnstileHandle } from '../../features/auth/Turnstile'
import { takeLogoutReason } from '../../features/auth/useIdleLogout'
import { validateEmail } from '../../features/auth/validation'
import { supabase } from '../../lib/supabase'
import { usePageTitle } from '../../lib/usePageTitle'

export function EntrarPage() {
  usePageTitle('Entrar')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<TurnstileHandle>(null)
  // Lido uma única vez ao abrir a página
  const [idleLogout] = useState(() => takeLogoutReason() === 'inatividade')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors = {
      email: validateEmail(email),
      password: password ? undefined : 'Indique a sua password.',
    }
    setFieldErrors(errors)
    if (errors.email || errors.password) return
    if (isCaptchaEnabled && !captchaToken) {
      setFormError('Confirme a verificação de segurança.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken: captchaToken ?? undefined },
    })
    setIsSubmitting(false)
    captchaRef.current?.reset()

    if (error) {
      setFormError(getErrorMessage(error))
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Entrar"
      description="Aceda à conta da sua oficina."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" className="font-medium text-brand-700 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {idleLogout && !formError && (
          <Alert variant="info">A sessão foi terminada por inatividade. Entre novamente.</Alert>
        )}
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        <div className="text-right">
          <Link to="/recuperar-password" className="text-sm text-brand-700 hover:underline">
            Esqueceu-se da password?
          </Link>
        </div>

        <Turnstile ref={captchaRef} onToken={setCaptchaToken} />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
