import { EmptyState, PageHeader } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function VeiculosPage() {
  usePageTitle('Veículos')

  return (
    <>
      <PageHeader
        title="Veículos"
      />
      <EmptyState
        icon="car"
        title="Ainda não existem veículos"
      />
    </>
  )
}
