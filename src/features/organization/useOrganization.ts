import { useContext } from 'react'
import { OrganizationContext, type OrganizationContextValue } from './OrganizationContext'

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization tem de ser usado dentro de <OrganizationProvider>')
  }
  return context
}

/** Nome do papel em português, para mostrar na interface. */
export function roleLabel(role: 'owner' | 'member'): string {
  return role === 'owner' ? 'Dono' : 'Funcionário'
}
