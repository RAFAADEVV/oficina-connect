import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type TeamMember = Database['public']['Functions']['list_team']['Returns'][number]

export interface PendingInvite {
  id: string
  created_at: string
  expires_at: string
}

export interface NewInvite {
  code: string
  expiresAt: string
}

/** Equipa da oficina (qualquer membro pode ver). */
export async function listTeam(organizationId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('list_team', { p_organization_id: organizationId })
  if (error) throw error
  return data
}

/** Convites ainda por usar (só o Dono vê; garantido pela base de dados). */
export async function listPendingInvites(organizationId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, created_at, expires_at')
    .eq('organization_id', organizationId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** Cria um código de convite. O código só é devolvido esta vez: a base de dados guarda apenas o resumo. */
export async function createInvite(organizationId: string): Promise<NewInvite> {
  const { data, error } = await supabase.rpc('create_invite', { p_organization_id: organizationId })
  if (error) throw error
  const row = data[0]
  if (!row) throw new Error('Sem código')
  return { code: row.code, expiresAt: row.expires_at }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId })
  if (error) throw error
}

/** Usa um código de convite. Devolve false se o código não for válido. */
export async function acceptInvite(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
  if (error) throw error
  return Boolean(data)
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_organization_id: organizationId, p_user_id: userId })
  if (error) throw error
}

export async function leaveOrganization(organizationId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_organization', { p_organization_id: organizationId })
  if (error) throw error
}
