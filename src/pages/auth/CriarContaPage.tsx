import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, Icon, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { isCaptchaEnabled } from '../../config/env'
import { Turnstile, type TurnstileHandle } from '../../features/auth/Turnstile'
import {
  appUrl,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from '../../features/auth/validation'
import { supabase } from '../../lib/supabase'
import { usePageTitle } from '../../lib/usePageTitle'

interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export function CriarContaPage() {
  usePageTitle('Criar conta')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<TurnstileHandle>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors: FieldErrors = {
      fullName: validateName(fullName, 'o seu nome'),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: password === confirmPassword ? undefined : 'As passwords não coincidem.',
    }
    setFieldErrors(errors)
    if (Object.values(errors).some(Boolean)) return
    if (!acceptedTerms) {
      setFormError('Para criar conta tem de aceitar o tratamento dos seus dados.')
      return
    }
    if (isCaptchaEnabled && !captchaToken) {
      setFormError('Confirme a verificação de segurança.')
      return
    }

    setIsSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: appUrl('/'),
        captchaToken: captchaToken ?? undefined,
      },
    })
    setIsSubmitting(false)
    captchaRef.current?.reset()

    if (error) {
      setFormError(getErrorMessage(error))
      return
    }

    // Com confirmação de email ativa, não há sessão até o utilizador clicar no link.
    // Se a confirmação estiver desativada, a sessão começa logo e o guarda de rotas avança sozinho.
    if (!data.session) setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <AuthLayout title="Confirme o seu email">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="mail" className="size-6" />
          </span>
          <p className="mt-4 text-sm text-slate-600">
            Enviámos um link de confirmação para <strong className="text-slate-900">{sentTo}</strong>.
            Abra o email e clique no link para ativar a conta.
          </p>
          <p className="mt-3 text-xs text-slate-500">Não encontra? Veja também a pasta de spam.</p>
          <Link to="/entrar" className="mt-6 text-sm font-medium text-brand-700 hover:underline">
            Voltar a Entrar
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      description="Crie a sua conta. A seguir vai configurar a sua oficina."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-brand-700 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nome"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldErrors.fullName}
          maxLength={120}
        />
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
          autoComplete="new-password"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres, com letras e números.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <TextField
          label="Confirmar password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
        />

        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
          />
          <span>
            Aceito que os meus dados sejam tratados para criar e gerir a conta, de acordo com o RGPD.
          </span>
        </label>

        <Turnstile ref={captchaRef} onToken={setCaptchaToken} />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}
