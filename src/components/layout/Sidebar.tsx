import { NavLink } from 'react-router'
import { mainNavigation, secondaryNavigation, type NavItem } from '../../config/navigation'
import { cn } from '../../lib/cn'
import { Icon } from '../ui/Icon'

interface SidebarProps {
  /** Chamado quando o utilizador escolhe uma página (usado para fechar o menu no telemóvel). */
  onNavigate?: () => void
}

function NavigationLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <Icon name={item.icon} className="size-5 shrink-0" />
      {item.label}
    </NavLink>
  )
}

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5">
        <img src="/favicon.svg" alt="" className="size-8" />
        <span className="text-base font-semibold tracking-tight text-slate-900">Oficina Connect</span>
      </div>

      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {mainNavigation.map((item) => (
          <NavigationLink key={item.path} item={item} onNavigate={onNavigate} />
        ))}

        <div className="mt-auto border-t border-slate-200 pt-3">
          {secondaryNavigation.map((item) => (
            <NavigationLink key={item.path} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
    </div>
  )
}
