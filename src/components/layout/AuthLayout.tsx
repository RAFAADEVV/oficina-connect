import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/** Moldura dos ecrãs de conta (entrar, criar conta, recuperar password, criar oficina). */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="size-9" />
        <span className="text-lg font-semibold tracking-tight text-slate-900">Oficina Connect</span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
    </div>
  )
}
