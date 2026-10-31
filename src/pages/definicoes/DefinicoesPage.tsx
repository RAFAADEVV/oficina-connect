import { Card, Icon, PageHeader } from '../../components/ui'
import { isSupabaseConfigured } from '../../config/env'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

export function DefinicoesPage() {
  usePageTitle('Definições')

  return (
    <>
      <PageHeader
        title="Definições"
        description="Dados da oficina, utilizadores e preferências da conta."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Oficina" description="Nome, contactos e dados da oficina.">
          <p className="text-sm text-slate-500">Disponível depois de ativarmos as contas de utilizador.</p>
        </Card>

        <Card title="Estado do sistema" description="Informação técnica da instalação.">
          <div className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'size-2.5 rounded-full',
                isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              aria-hidden="true"
            />
            <span className="text-slate-700">
              Base de dados:{' '}
              <strong className="font-medium">
                {isSupabaseConfigured ? 'configuração encontrada' : 'ainda não configurada'}
              </strong>
            </span>
          </div>
          {!isSupabaseConfigured && (
            <p className="mt-3 flex gap-2 text-xs text-slate-500">
              <Icon name="info" className="size-4 shrink-0" />
              Normal nesta fase. A ligação ao Supabase será feita numa próxima tarefa.
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
