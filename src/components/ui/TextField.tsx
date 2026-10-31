import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

/** Campo de texto com etiqueta, ajuda e mensagem de erro. */
export function TextField({ label, hint, error, className, id, ...props }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && hintId, error && errorId) || undefined}
        className={cn(
          'mt-1.5 block h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20',
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
