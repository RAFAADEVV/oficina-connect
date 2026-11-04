import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { getVerifiedTotp, isValidCode, verifyTotp } from '../../features/auth/mfa'
import { useAuth } from '../../features/auth/useAuth'
import { usePageTitle } from '../../lib/usePageTitle'

/** Segundo passo do login: código de 6 dígitos da app de autenticação. */
export function VerificarCodigoPage() {
  usePageTitle('Código de verificação')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const { signOut, refreshMfa } = useAuth()

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const clean = code.replace(/\s/g, '')
    if (!isValidCode(clean)) {
      setCodeError('Introduza os 6 dígitos que aparecem na sua app de autenticação.')
      return
    }
    setCodeError(undefined)

    setIsSubmitting(true)
    try {
      const factor = await getVerifiedTotp()
      if (!factor) {
        // Não há fator ativo: atualizar o estado e seguir
        await refreshMfa()
        navigate(from, { replace: true })
        return
      }
      await verifyTotp(factor.id, clean)
      await refreshMfa()
      navigate(from, { replace: true })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setCode('')
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Verificação em dois passos"
      description="Abra a sua app de autenticação e introduza o código de 6 dígitos da RevyAuto."
      footer={
        <button type="button" onClick={() => void signOut()} className="text-slate-500 hover:text-slate-700 hover:underline">
          Sair e entrar com outra conta
        </button>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={codeError}
          autoFocus
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Confirmar
        </Button>
      </form>
    </AuthLayout>
  )
}
