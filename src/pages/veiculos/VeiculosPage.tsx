import { EmptyState, PageHeader } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function VeiculosPage() {
  usePageTitle('Veículos')

  return (
    <>
      <PageHeader
        title="Veículos"
        description="Veículos dos clientes, com matrícula, marca, modelo e histórico de serviços."
      />
      <EmptyState
        icon="car"
        title="Ainda não existem veículos"
        description="Os veículos são criados automaticamente ao importar os dados dos clientes."
      />
    </>
  )
}
