import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** true enquanto se verifica se já existe sessão guardada */
  isLoading: boolean
  /** true quando o utilizador chegou através do link de recuperação de password */
  isPasswordRecovery: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
