import { createContext } from 'react'
import type { OrganizationRole } from '../../types/database'

export interface CurrentOrganization {
  id: string
  name: string
  role: OrganizationRole
}

export interface OrganizationContextValue {
  /** Oficina em que o utilizador está a trabalhar (null se ainda não tem nenhuma) */
  organization: CurrentOrganization | null
  isLoading: boolean
  /** Mensagem de erro se não foi possível carregar a oficina */
  error: string | null
  /** Cria uma oficina (o utilizador fica como Dono) e passa a usá-la */
  createOrganization: (name: string) => Promise<void>
  reload: () => Promise<void>
}

export const OrganizationContext = createContext<OrganizationContextValue | null>(null)
