import { Icon, type IconName } from './Icon'

interface StatCardProps {
  label: string
  /** Valor do indicador. Use `null` enquanto ainda não há dados. */
  value: string | number | null
  icon: IconName
  hint?: string
}

/** Cartão de indicador para o dashboard. Mostra "—" quando ainda não existem dados. */
export function StatCard({ label, value, icon, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name={icon} className="size-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-graphite">
        {value ?? <span className="text-slate-300">—</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
