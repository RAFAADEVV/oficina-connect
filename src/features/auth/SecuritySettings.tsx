import { useState, type FormEvent } from 'react'
import { Alert, Button, ConfirmDialog, Spinner, TextField } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { getErrorMessage } from './authErrors'
import { getVerifiedTotp, isValidCode, removeTotp, startTotpEnrollment, verifyTotp, type TotpEnrollment } from './mfa'
import { useAuth } from './useAuth'

/** Ativar ou desativar a autenticação em dois passos da conta do utilizador. */
export function SecuritySettings() {
  const { user, refreshMfa } = useAuth()
  const factor = useAsyncData(user ? `mfa:${user.id}` : null, getVerifiedTotp)

  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function start() {
    setError(null)
    setSuccess(null)
    setIsBusy(true)
    try {
      setEnrollment(await startTotpEnrollment())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enrollment) return
    const clean = code.replace(/\s/g, '')
    if (!isValidCode(clean)) {
      setCodeError('Introduza os 6 dígitos que aparecem na app.')
      return
    }
    setCodeError(undefined)
    setError(null)
    setIsBusy(true)
    try {
      await verifyTotp(enrollment.factorId, clean)
      setEnrollment(null)
      setCode('')
      setSuccess('Autenticação em dois passos ativada. Da próxima vez que entrar, vai ser pedido o código.')
      await refreshMfa()
      factor.reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  async function remove() {
    if (!factor.data) return
    setIsBusy(true)
    setError(null)
    try {
      await removeTotp(factor.data.id)
      setSuccess('Autenticação em dois passos desativada.')
      await refreshMfa()
      factor.reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsBusy(false)
      setConfirmRemove(false)
    }
  }

  if (factor.isLoading && !factor.data) return <Spinner className="size-5 text-slate-400" />

  return (
    <div className="space-y-4 text-sm">
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {factor.error && <Alert variant="error">{factor.error}</Alert>}

      {factor.data ? (
        <>
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-slate-700">
              Autenticação em dois passos <strong className="font-medium">ativa</strong> desde{' '}
              {formatDate(factor.data.createdAt)}.
            </span>
          </div>
          <Button variant="secondary" onClick={() => setConfirmRemove(true)} disabled={isBusy}>
            Desativar
          </Button>
        </>
      ) : enrollment ? (
        <form onSubmit={confirm} noValidate className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-slate-600">
            <li>Abra uma app de autenticação (Google Authenticator, Microsoft Authenticator…).</li>
            <li>Leia este código QR com a app.</li>
            <li>Escreva o código de 6 dígitos que a app mostra.</li>
          </ol>
          <img src={enrollment.qrCode} alt="Código QR para a app de autenticação" className="size-44 rounded-lg border border-slate-200 bg-white p-2" />
          <p className="text-xs text-slate-500">
            Não consegue ler o código? Introduza esta chave na app:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono break-all text-slate-800">{enrollment.secret}</code>
          </p>
          <TextField
            label="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={codeError}
            className="max-w-48"
          />
          <div className="flex gap-2">
            <Button type="submit" isLoading={isBusy}>
              Ativar
            </Button>
            <Button variant="secondary" onClick={() => setEnrollment(null)} disabled={isBusy}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-slate-600">
            Além da password, passa a ser pedido um código de 6 dígitos do seu telemóvel. Recomendado para o Dono da
            oficina.
          </p>
          <Button onClick={() => void start()} isLoading={isBusy}>
            Ativar autenticação em dois passos
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Desativar autenticação em dois passos?"
        confirmLabel="Desativar"
        isLoading={isBusy}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      >
        A sua conta fica protegida apenas pela password.
      </ConfirmDialog>
    </div>
  )
}
