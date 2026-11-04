import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AssuranceLevel, type AuthContextValue } from './AuthContext'

function toLevel(level: string | null): AssuranceLevel | null {
  return level === 'aal1' || level === 'aal2' ? level : null
}

interface MfaState {
  /** Utilizador para o qual este estado foi calculado (evita usar estado de outra conta) */
  userId: string
  aal: AssuranceLevel | null
  needsMfa: boolean
}

/** Mantém a sessão do utilizador e o estado da autenticação em dois passos sincronizados com o Supabase. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [mfa, setMfa] = useState<MfaState | null>(null)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setIsSessionLoading(false)
    })

    // Nota: não chamar outras funções do Supabase com await dentro deste callback.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setIsSessionLoading(false)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const token = session?.access_token ?? null
  const userId = session?.user.id ?? null

  const loadMfa = useCallback(async (forUser: string) => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) {
      // Em caso de dúvida, pedir o código: a base de dados bloqueia o acesso de qualquer forma
      setMfa({ userId: forUser, aal: null, needsMfa: true })
      return
    }
    setMfa({
      userId: forUser,
      aal: toLevel(data.currentLevel),
      needsMfa: data.nextLevel === 'aal2' && data.currentLevel !== 'aal2',
    })
  }, [])

  // Estado do MFA sempre que a sessão muda (fora do callback acima, como o Supabase recomenda)
  // (ao renovar a sessão mantém-se o estado anterior, sem ecrã de carregamento)
  useEffect(() => {
    if (!token || !userId) return
    let cancelled = false
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) {
        setMfa({ userId, aal: null, needsMfa: true })
        return
      }
      setMfa({ userId, aal: toLevel(data.currentLevel), needsMfa: data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' })
    })
    return () => {
      cancelled = true
    }
  }, [token, userId])

  const value = useMemo<AuthContextValue>(() => {
    const currentMfa = userId && mfa?.userId === userId ? mfa : null
    return {
      session,
      user: session?.user ?? null,
      isLoading: isSessionLoading || (Boolean(token) && !currentMfa),
      isPasswordRecovery,
      aal: currentMfa?.aal ?? null,
      needsMfa: currentMfa?.needsMfa ?? false,
      refreshMfa: async () => {
        if (userId) await loadMfa(userId)
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }
  }, [session, token, userId, mfa, isSessionLoading, isPasswordRecovery, loadMfa])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
