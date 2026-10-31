import { EmptyState, PageHeader } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function OportunidadesPage() {
  usePageTitle('Oportunidades')

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Clientes que poderão precisar de voltar à oficina — por exemplo, revisão ou inspeção a aproximar-se."
      />
      <EmptyState
        icon="target"
        title="Ainda não existem oportunidades"
        description="As oportunidades de contacto serão identificadas a partir do histórico de serviços importado."
      />
    </>
  )
}
