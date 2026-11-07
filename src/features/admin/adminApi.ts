import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { useAsyncData } from '../../lib/useAsyncData'

type Fns = Database['public']['Functions']
export type AllowedEmail = Fns['admin_list_allowlist']['Returns'][number]
export type AdminOrganization = Fns['admin_list_organizations']['Returns'][number]

/**
 * Administração da plataforma (só o administrador, com dois passos confirmados).
 * Todas as verificações são feitas na base de dados (migração 0009).
 */

export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_platform_admin')
  if (error) return false
  return data === true
}

/** Mostra ou esconde o menu de administração. */
export function useIsPlatformAdmin(): { isAdmin: boolean; isChecking: boolean } {
  const { user, aal } = useAuth()
  const key = user && aal === 'aal2' ? `admin:${user.id}` : null
  const { data, isLoading } = useAsyncData(key, isPlatformAdmin)
  return { isAdmin: data === true, isChecking: isLoading }
}

export async function listAllowlist(): Promise<AllowedEmail[]> {
  const { data, error } = await supabase.rpc('admin_list_allowlist')
  if (error) throw error
  return data
}

export async function allowEmail(email: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_allow_email', { p_email: email.trim(), p_note: note.trim() || null })
  if (error) throw error
}

export async function removeAllowedEmail(email: string): Promise<void> {
  const { error } = await supabase.rpc('admin_remove_email', { p_email: email })
  if (error) throw error
}

export async function listOrganizations(): Promise<AdminOrganization[]> {
  const { data, error } = await supabase.rpc('admin_list_organizations')
  if (error) throw error
  return data
}
