import { Button, EmptyState, PageHeader } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function ClientesPage() {
  usePageTitle('Clientes')

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Lista de clientes da oficina com contactos e veículos associados."
        actions={
          <Button icon="upload" disabled title="Disponível numa próxima fase">
            Importar ficheiro
          </Button>
        }
      />
      <EmptyState
        icon="users"
        title="Ainda não existem clientes"
        description="Os clientes vão aparecer aqui depois de importar um ficheiro Excel ou CSV. A importação será ativada numa próxima fase."
      />
    </>
  )
}
