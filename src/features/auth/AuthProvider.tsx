import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthContextValue } from './AuthContext'

/** Mantém a sessão do utilizador sincronizada com o Supabase. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setIsLoading(false)
    })

    // Nota: não chamar outras funções do Supabase com await dentro deste callback.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setIsLoading(false)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isPasswordRecovery,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, isLoading, isPasswordRecovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
