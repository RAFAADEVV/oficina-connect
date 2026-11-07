import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Alert, Button, Card, ConfirmDialog, PageHeader, Spinner, TextField } from '../../components/ui'
import {
  allowEmail,
  listAllowlist,
  listOrganizations,
  removeAllowedEmail,
  useIsPlatformAdmin,
} from '../../features/admin/adminApi'
import { getErrorMessage } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import { validateEmail } from '../../features/auth/validation'
import { formatDate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'

/** Administração da plataforma: quem pode criar conta e que oficinas existem. */
export function AdminPage() {
  usePageTitle('Administração')
  const { aal } = useAuth()
  const { isAdmin, isChecking } = useIsPlatformAdmin()

  const allowlist = useAsyncData(isAdmin ? 'admin:lista' : null, listAllowlist)
  const organizations = useAsyncData(isAdmin ? 'admin:oficinas' : null, listOrganizations)

  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toRemove, setToRemove] = useState<string | null>(null)

  // Sem dois passos confirmados, a base de dados nunca reconhece o administrador
  if (aal !== 'aal2') return <Navigate to="/" replace />
  if (isChecking) return <Spinner className="size-5 text-slate-400" />
  // Quem não é administrador volta ao Dashboard (a base de dados recusaria de qualquer forma)
  if (!isAdmin) return <Navigate to="/" replace />

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const error = validateEmail(email)
    setEmailError(error)
    if (error) return
    setIsSaving(true)
    try {
      await allowEmail(email, note)
      setEmail('')
      setNote('')
      allowlist.reload()
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove() {
    if (!toRemove) return
    setIsSaving(true)
    try {
      await removeAllowedEmail(toRemove)
      setToRemove(null)
      allowlist.reload()
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Administração" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Emails autorizados a criar conta">
          <form onSubmit={handleAdd} noValidate className="mb-5 space-y-3">
            {formError && <Alert variant="error">{formError}</Alert>}
            <TextField
              label="Email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <TextField
              label="Nota (opcional)"
              placeholder="Ex.: Auto Silva, Amadora"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" icon="plus" isLoading={isSaving}>
              Autorizar email
            </Button>
          </form>

          {allowlist.error && <Alert variant="error">{allowlist.error}</Alert>}
          {!allowlist.data && !allowlist.error && <Spinner className="size-5 text-slate-400" />}
          {allowlist.data && allowlist.data.length === 0 && (
            <p className="text-sm text-slate-500">Ainda não há emails autorizados.</p>
          )}
          {allowlist.data && allowlist.data.length > 0 && (
            <ul className="-my-2 divide-y divide-slate-100 text-sm">
              {allowlist.data.map((row) => (
                <li key={row.email} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{row.email}</p>
                    <p className="truncate text-xs text-slate-500">
                      {row.has_account ? 'Já criou conta' : 'Ainda sem conta'} · {formatDate(row.created_at)}
                      {row.note ? ` · ${row.note}` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setToRemove(row.email)} disabled={isSaving}>
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Oficinas">
          {organizations.error && <Alert variant="error">{organizations.error}</Alert>}
          {!organizations.data && !organizations.error && <Spinner className="size-5 text-slate-400" />}
          {organizations.data && organizations.data.length === 0 && (
            <p className="text-sm text-slate-500">Ainda não há oficinas.</p>
          )}
          {organizations.data && organizations.data.length > 0 && (
            <ul className="-my-2 divide-y divide-slate-100 text-sm">
              {organizations.data.map((org) => (
                <li key={org.id} className="py-2.5">
                  <p className="font-medium text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-500">
                    {org.owner_email ?? 'sem Dono'} · {org.members} {org.members === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                    {org.customers} {org.customers === 1 ? 'cliente' : 'clientes'} · desde {formatDate(org.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={toRemove !== null}
        title="Remover autorização?"
        confirmLabel="Remover"
        isLoading={isSaving}
        onCancel={() => setToRemove(null)}
        onConfirm={() => void handleRemove()}
      >
        {toRemove} deixa de poder criar conta. Se já tiver conta, continua a ter acesso.
      </ConfirmDialog>
    </>
  )
}
