import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth tem de ser usado dentro de <AuthProvider>')
  }
  return context
}
