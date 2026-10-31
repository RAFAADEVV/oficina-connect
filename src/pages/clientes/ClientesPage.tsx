import { Button, EmptyState, PageHeader } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function ClientesPage() {
  usePageTitle('Clientes')

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <Button icon="upload" disabled title="Disponível numa próxima fase">
            Importar ficheiro
          </Button>
        }
      />
      <EmptyState
        icon="users"
        title="Ainda não existem clientes"
      />
    </>
  )
}
