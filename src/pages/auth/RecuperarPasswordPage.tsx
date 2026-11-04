import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { isCaptchaEnabled } from '../../config/env'
import { Turnstile, type TurnstileHandle } from '../../features/auth/Turnstile'
import { appUrl, validateEmail } from '../../features/auth/validation'
import { supabase } from '../../lib/supabase'
import { usePageTitle } from '../../lib/usePageTitle'

export function RecuperarPasswordPage() {
  usePageTitle('Recuperar password')

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<TurnstileHandle>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const error = validateEmail(email)
    setEmailError(error)
    if (error) return
    if (isCaptchaEnabled && !captchaToken) {
      setFormError('Confirme a verificação de segurança.')
      return
    }

    setIsSubmitting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl('/nova-password'),
      captchaToken: captchaToken ?? undefined,
    })
    setIsSubmitting(false)
    captchaRef.current?.reset()

    if (resetError) {
      setFormError(getErrorMessage(resetError))
      return
    }
    // Mostramos sempre a mesma mensagem, exista ou não a conta (não revelar que emails estão registados).
    setIsSent(true)
  }

  return (
    <AuthLayout
      title="Recuperar password"
      description="Indique o email da sua conta. Vamos enviar um link para definir uma nova password."
      footer={
        <Link to="/entrar" className="font-medium text-brand-700 hover:underline">
          Voltar a Entrar
        </Link>
      }
    >
      {isSent ? (
        <Alert variant="success">
          Se existir uma conta com este email, vai receber um link em poucos minutos. Veja também a pasta
          de spam.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <Turnstile ref={captchaRef} onToken={setCaptchaToken} />
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
