import type { IconName } from '../components/ui/Icon'

export interface NavItem {
  label: string
  path: string
  icon: IconName
}

/**
 * Itens do menu lateral.
 * Para adicionar um módulo novo: criar a página, a rota em app/router.tsx e um item aqui.
 */
export const mainNavigation: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Clientes', path: '/clientes', icon: 'users' },
  { label: 'Veículos', path: '/veiculos', icon: 'car' },
  { label: 'Oportunidades', path: '/oportunidades', icon: 'target' },
]

export const secondaryNavigation: NavItem[] = [
  { label: 'Definições', path: '/definicoes', icon: 'settings' },
]
