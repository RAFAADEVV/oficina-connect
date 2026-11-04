import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AssuranceLevel = 'aal1' | 'aal2'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** true enquanto se verifica se já existe sessão guardada (e o estado do MFA) */
  isLoading: boolean
  /** true quando o utilizador chegou através do link de recuperação de password */
  isPasswordRecovery: boolean
  /** Nível de autenticação da sessão: aal2 = código de dois passos confirmado */
  aal: AssuranceLevel | null
  /** true quando a conta tem autenticação em dois passos e falta introduzir o código */
  needsMfa: boolean
  /** Volta a ler o estado do MFA (depois de ativar ou desativar) */
  refreshMfa: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
