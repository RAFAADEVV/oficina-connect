import { EmptyState, PageHeader } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function OportunidadesPage() {
  usePageTitle('Oportunidades')

  return (
    <>
      <PageHeader
        title="Oportunidades"
      />
      <EmptyState
        icon="target"
        title="Ainda não existem oportunidades"
      />
    </>
  )
}
