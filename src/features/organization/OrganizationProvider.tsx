import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../auth/authErrors'
import { useAuth } from '../auth/useAuth'
import {
  OrganizationContext,
  type CurrentOrganization,
  type OrganizationContextValue,
} from './OrganizationContext'

interface LoadResult {
  userId: string
  organization: CurrentOrganization | null
  error: string | null
}

/**
 * Vai buscar a oficina do utilizador.
 * As regras RLS garantem que só são devolvidas oficinas a que ele pertence.
 * Nesta fase usa a primeira oficina; trocar de oficina será adicionado mais tarde.
 */
async function fetchOrganization(userId: string): Promise<LoadResult> {
  const [orgsResult, membershipsResult] = await Promise.all([
    supabase.from('organizations').select('id, name').order('created_at'),
    supabase.from('organization_members').select('organization_id, role').eq('user_id', userId),
  ])

  if (orgsResult.error || membershipsResult.error) {
    return { userId, organization: null, error: getErrorMessage(orgsResult.error ?? membershipsResult.error) }
  }

  const first = orgsResult.data[0]
  const membership = first
    ? membershipsResult.data.find((m) => m.organization_id === first.id)
    : undefined

  return {
    userId,
    organization: first && membership ? { id: first.id, name: first.name, role: membership.role } : null,
    error: null,
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, aal, needsMfa } = useAuth()
  const userId = user?.id ?? null
  // Só carrega depois do código de dois passos (se ativo); volta a carregar quando o nível muda
  const loadKey = userId && !needsMfa ? `${userId}:${aal ?? 'aal1'}` : null
  const [result, setResult] = useState<LoadResult | null>(null)

  useEffect(() => {
    if (!userId || !loadKey) return
    let cancelled = false
    void fetchOrganization(userId).then((loaded) => {
      if (!cancelled) setResult(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [userId, loadKey])

  const reload = useCallback(async () => {
    if (!userId || !loadKey) return
    setResult(await fetchOrganization(userId))
  }, [userId, loadKey])

  const value = useMemo<OrganizationContextValue>(() => {
    // Ignora resultados de outro utilizador (ex.: sair e entrar com outra conta).
    // Ao mudar o nível de autenticação, mantém os dados anteriores enquanto recarrega (sem ecrã de carregamento).
    const current = loadKey && userId && result?.userId === userId ? result : null
    return {
      organization: current?.organization ?? null,
      isLoading: Boolean(loadKey) && !current,
      error: current?.error ?? null,
      createOrganization: async (name: string) => {
        if (!userId) throw new Error('Sem sessão')
        const { error } = await supabase.rpc('create_organization', { p_name: name })
        if (error) throw error
        await reload()
      },
      reload,
    }
  }, [userId, loadKey, result, reload])

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}
