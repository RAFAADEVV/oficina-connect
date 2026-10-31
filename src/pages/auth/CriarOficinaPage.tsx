import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, FullPageLoader, TextField } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import { validateName } from '../../features/auth/validation'
import { useOrganization } from '../../features/organization/useOrganization'
import { usePageTitle } from '../../lib/usePageTitle'

/** Primeiro acesso: o utilizador cria a sua oficina e fica como Dono. */
export function CriarOficinaPage() {
  usePageTitle('Criar oficina')
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { organization, isLoading, createOrganization } = useOrganization()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) return <FullPageLoader />
  // Quem já tem oficina não precisa de estar aqui.
  if (organization && !isSubmitting) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const error = validateName(name, 'o nome da oficina')
    setNameError(error)
    if (error) return

    setIsSubmitting(true)
    try {
      await createOrganization(name.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Criar a sua oficina"
      description="Falta só um passo. Como se chama a sua oficina?"
      footer={
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-slate-500 hover:text-slate-700 hover:underline"
        >
          Sair da conta
        </button>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="Nome da oficina"
          placeholder="Ex.: Auto Reparadora Silva"
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          maxLength={120}
        />
        <p className="text-xs text-slate-500">
          Vai ficar como <strong>Dono</strong> desta oficina. Pode alterar o nome mais tarde.
        </p>
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Criar oficina
        </Button>
      </form>
    </AuthLayout>
  )
}
