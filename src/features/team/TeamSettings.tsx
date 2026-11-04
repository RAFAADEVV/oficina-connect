import { useState } from 'react'
import { Alert, Button, ConfirmDialog, Spinner } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { getErrorMessage } from '../auth/authErrors'
import { useAuth } from '../auth/useAuth'
import type { CurrentOrganization } from '../organization/OrganizationContext'
import { useOrganization } from '../organization/useOrganization'
import {
  createInvite,
  leaveOrganization,
  listPendingInvites,
  listTeam,
  removeMember,
  revokeInvite,
  type NewInvite,
  type TeamMember,
} from './teamApi'
import { inviteMessage } from './inviteCode'

const ROLE_LABELS = { owner: 'Dono', member: 'Funcionário' } as const

/** Equipa da oficina: o Dono convida e remove pessoas; um Funcionário pode sair. */
export function TeamSettings({ organization }: { organization: CurrentOrganization }) {
  const { user } = useAuth()
  const { reload: reloadOrganization } = useOrganization()
  const isOwner = organization.role === 'owner'

  const team = useAsyncData(`equipa:${organization.id}`, () => listTeam(organization.id))
  const invites = useAsyncData(isOwner ? `convites:${organization.id}` : null, () =>
    listPendingInvites(organization.id),
  )

  const [newInvite, setNewInvite] = useState<NewInvite | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [toRemove, setToRemove] = useState<TeamMember | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  async function run(action: () => Promise<void>) {
    setError(null)
    setIsBusy(true)
    try {
      await action()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  const message = newInvite ? inviteMessage(organization.name, newInvite.code, window.location.origin) : ''

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
    } catch {
      setError('Não foi possível copiar. Selecione o código e copie-o à mão.')
    }
  }

  if (team.isLoading && !team.data) return <Spinner className="size-5 text-slate-400" />

  return (
    <div className="space-y-5 text-sm">
      {error && <Alert variant="error">{error}</Alert>}
      {team.error && <Alert variant="error">{team.error}</Alert>}

      {team.data && (
        <ul className="-my-2 divide-y divide-slate-100">
          {team.data.map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {member.full_name || member.email}
                  {member.user_id === user?.id && <span className="ml-1.5 font-normal text-slate-500">(você)</span>}
                </p>
                {member.full_name && <p className="truncate text-xs text-slate-500">{member.email}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    member.role === 'owner'
                      ? 'rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800'
                      : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'
                  }
                >
                  {ROLE_LABELS[member.role]}
                </span>
                {isOwner && member.role === 'member' && (
                  <Button variant="ghost" size="sm" onClick={() => setToRemove(member)} disabled={isBusy}>
                    Remover
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          {newInvite ? (
            <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/60 p-4">
              <p className="text-slate-700">Código de convite (válido até {formatDate(newInvite.expiresAt)}):</p>
              <p className="font-mono text-2xl font-semibold tracking-widest text-slate-900 select-all">{newInvite.code}</p>
              <p className="text-xs text-slate-600">
                Só é mostrado agora. Envie-o ao funcionário: ele cria conta e escreve o código.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={copied ? 'check' : 'file'} onClick={() => void copyMessage()}>
                  {copied ? 'Copiado' : 'Copiar mensagem'}
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-800"
                >
                  Enviar por WhatsApp
                </a>
                <Button size="sm" variant="ghost" onClick={() => setNewInvite(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              icon="plus"
              isLoading={isBusy}
              onClick={() =>
                void run(async () => {
                  setCopied(false)
                  setNewInvite(await createInvite(organization.id))
                  invites.reload()
                })
              }
            >
              Convidar funcionário
            </Button>
          )}

          {invites.error && <Alert variant="error">{invites.error}</Alert>}
          {invites.data && invites.data.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Convites por usar</p>
              <ul className="divide-y divide-slate-100">
                {invites.data.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-slate-600">
                      Criado a {formatDate(invite.created_at)} · expira a {formatDate(invite.expires_at)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        void run(async () => {
                          await revokeInvite(invite.id)
                          invites.reload()
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!isOwner && (
        <div className="border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={() => setConfirmLeave(true)} disabled={isBusy}>
            Sair desta oficina
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={toRemove !== null}
        title="Remover da equipa?"
        confirmLabel="Remover"
        isLoading={isBusy}
        onCancel={() => setToRemove(null)}
        onConfirm={() =>
          void run(async () => {
            if (!toRemove) return
            await removeMember(organization.id, toRemove.user_id)
            setToRemove(null)
            team.reload()
          })
        }
      >
        {toRemove?.full_name || toRemove?.email} deixa de ter acesso aos dados da oficina. Os registos que criou
        mantêm-se.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmLeave}
        title="Sair desta oficina?"
        confirmLabel="Sair"
        isLoading={isBusy}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() =>
          void run(async () => {
            await leaveOrganization(organization.id)
            setConfirmLeave(false)
            await reloadOrganization()
          })
        }
      >
        Deixa de ter acesso aos dados. Para voltar, precisa de um novo convite do Dono.
      </ConfirmDialog>
    </div>
  )
}
