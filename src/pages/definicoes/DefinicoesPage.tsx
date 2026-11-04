import { Alert, Card, Icon, PageHeader, Spinner } from '../../components/ui'
import { isSupabaseConfigured } from '../../config/env'
import { AuditLog } from '../../features/audit/AuditLog'
import { SecuritySettings } from '../../features/auth/SecuritySettings'
import { getOrganizationDetails, updateOrganization } from '../../features/organization/organizationApi'
import { OrganizationForm } from '../../features/organization/OrganizationForm'
import { TeamSettings } from '../../features/team/TeamSettings'
import { useOrganization } from '../../features/organization/useOrganization'
import { cn } from '../../lib/cn'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'

export function DefinicoesPage() {
  usePageTitle('Definições')
  const { organization, reload } = useOrganization()
  const orgId = organization?.id ?? null
  const details = useAsyncData(orgId ? `oficina:${orgId}` : null, () => getOrganizationDetails(orgId!))

  return (
    <>
      <PageHeader title="Definições" />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Oficina">
          {details.error && <Alert variant="error">{details.error}</Alert>}
          {!details.data && !details.error && <Spinner className="size-5 text-slate-400" />}
          {details.data && organization && (
            <OrganizationForm
              key={details.data.id}
              initial={details.data}
              canEdit={organization.role === 'owner'}
              onSubmit={async (input) => {
                await updateOrganization(organization.id, input)
                // Atualiza o nome mostrado na barra lateral
                await reload()
              }}
            />
          )}
        </Card>

        <div className="flex flex-col gap-6">
        {organization && (
          <Card title="Equipa">
            <TeamSettings organization={organization} />
          </Card>
        )}

        <Card title="Segurança da sua conta">
          <SecuritySettings />
        </Card>

        <Card title="Estado do sistema">
          <div className="flex items-center gap-3 text-sm">
            <span
              className={cn('size-2.5 rounded-full', isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500')}
              aria-hidden="true"
            />
            <span className="text-slate-700">
              Base de dados:{' '}
              <strong className="font-medium">{isSupabaseConfigured ? 'ligada' : 'não configurada'}</strong>
            </span>
          </div>
          <p className="mt-3 flex gap-2 text-xs text-slate-500">
            <Icon name="info" className="size-4 shrink-0" />
            Os dados da oficina aparecem nos relatórios de serviço.
          </p>
        </Card>
        </div>
      </div>

      {organization?.role === 'owner' && (
        <Card title="Registo de eliminações" className="mt-6">
          <AuditLog organizationId={organization.id} />
        </Card>
      )}
    </>
  )
}
