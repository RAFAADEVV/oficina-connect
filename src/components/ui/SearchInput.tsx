import { Icon } from './Icon'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
}

export function SearchInput({ value, onChange, placeholder, label = 'Pesquisar' }: SearchInputProps) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
        <Icon name="search" className="size-4" />
      </span>
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
    </div>
  )
}
