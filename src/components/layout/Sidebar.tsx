import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { mainNavigation, secondaryNavigation, type NavItem } from '../../config/navigation'
import { useAuth } from '../../features/auth/useAuth'
import { roleLabel, useOrganization } from '../../features/organization/useOrganization'
import { isContacted, listReminders, onRemindersChanged } from '../../features/reminders/remindersApi'
import { cn } from '../../lib/cn'
import { useAsyncData } from '../../lib/useAsyncData'
import { Icon } from '../ui/Icon'

/** Número de clientes por contactar. Atualiza sempre que se muda de página. */
function usePendingReminderCount(organizationId: string | null): number {
  const { pathname, search } = useLocation()
  const [changes, setChanges] = useState(0)
  useEffect(() => onRemindersChanged(() => setChanges((n) => n + 1)), [])
  const { data } = useAsyncData(organizationId ? `lembretes-contagem:${organizationId}:${pathname}${search}:${changes}` : null, () =>
    listReminders(organizationId!),
  )
  return data ? data.filter((r) => !isContacted(r)).length : 0
}

interface SidebarProps {
  /** Chamado quando o utilizador escolhe uma página (usado para fechar o menu no telemóvel). */
  onNavigate?: () => void
}

function NavigationLink({ item, onNavigate, badge }: { item: NavItem; onNavigate?: () => void; badge?: number }) {
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
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${badge} por contactar`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  )
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth()
  const { organization } = useOrganization()
  const pendingReminders = usePendingReminderCount(organization?.id ?? null)
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5">
        <img src="/favicon.svg" alt="" className="size-8" />
        <span className="text-base font-semibold tracking-tight text-slate-900">Oficina Connect</span>
      </div>

      {organization && (
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon name="building" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{organization.name}</p>
            <p className="text-xs text-slate-500">{roleLabel(organization.role)}</p>
          </div>
        </div>
      )}

      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {mainNavigation.map((item) => (
          <NavigationLink
            key={item.path}
            item={item}
            onNavigate={onNavigate}
            badge={item.path === '/oportunidades' ? pendingReminders : undefined}
          />
        ))}

        <div className="mt-auto border-t border-slate-200 pt-3">
          {secondaryNavigation.map((item) => (
            <NavigationLink key={item.path} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      {user && (
        <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-3">
          <p className="min-w-0 flex-1 truncate px-2 text-sm text-slate-600" title={user.email}>
            {displayName}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon name="logout" className="size-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
