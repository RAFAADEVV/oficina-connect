/** Mostrado quando o ficheiro .env.local não está preenchido. */
export function ConfigMissing() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Configuração em falta</h1>
        <p className="mt-2 text-sm text-slate-600">
          A aplicação não encontrou os dados de ligação ao Supabase. Copie o ficheiro{' '}
          <code className="rounded bg-slate-100 px-1">.env.example</code> para{' '}
          <code className="rounded bg-slate-100 px-1">.env.local</code>, preencha{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> e{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> e reinicie a
          aplicação.
        </p>
      </div>
    </div>
  )
}
