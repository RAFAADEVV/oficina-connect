import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Card, Icon, PageHeader, Spinner } from '../../components/ui'
import { CustomerForm } from '../../features/customers/CustomerForm'
import { createCustomer, getCustomer, updateCustomer } from '../../features/customers/customersApi'
import { useOrganization } from '../../features/organization/useOrganization'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'

/** Criar cliente (/clientes/novo) ou editar (/clientes/:id/editar). */
export function ClienteFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  usePageTitle(isEditing ? 'Editar cliente' : 'Novo cliente')
  const navigate = useNavigate()
  const { organization } = useOrganization()

  const { data: customer, error } = useAsyncData(id ? `cliente:${id}` : null, () => getCustomer(id!))
  const backTo = id ? `/clientes/${id}` : '/clientes'

  return (
    <>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="arrowLeft" className="size-4" />
        {isEditing ? 'Voltar ao cliente' : 'Clientes'}
      </Link>
      <PageHeader title={isEditing ? 'Editar cliente' : 'Novo cliente'} />

      <Card className="max-w-3xl">
        {error && <Alert variant="error">{error}</Alert>}
        {isEditing && !customer && !error && (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner />
          </div>
        )}
        {(!isEditing || customer) && organization && (
          <CustomerForm
            initial={customer ?? undefined}
            submitLabel={isEditing ? 'Guardar alterações' : 'Criar cliente'}
            onCancel={() => navigate(backTo)}
            onSubmit={async (input) => {
              const saved = isEditing
                ? await updateCustomer(id!, input)
                : await createCustomer(organization.id, input)
              navigate(`/clientes/${saved.id}`, { replace: true })
            }}
          />
        )}
      </Card>
    </>
  )
}
