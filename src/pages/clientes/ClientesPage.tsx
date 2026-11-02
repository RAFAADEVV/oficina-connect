import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert, Button, EmptyState, Icon, PageHeader, Pagination, SearchInput, Spinner } from '../../components/ui'
import { listCustomers, PAGE_SIZE } from '../../features/customers/customersApi'
import { useOrganization } from '../../features/organization/useOrganization'
import { formatPhone } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { usePageTitle } from '../../lib/usePageTitle'

export function ClientesPage() {
  usePageTitle('Clientes')
  const navigate = useNavigate()
  const { organization } = useOrganization()

  // Pesquisa e página ficam no endereço, para voltar ao mesmo sítio depois de abrir um cliente
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('p') ?? 0) || 0)
  const debouncedSearch = useDebouncedValue(search)

  const orgId = organization?.id ?? null
  const { data, error, isLoading, reload } = useAsyncData(
    orgId ? `clientes:${orgId}:${debouncedSearch}:${page}` : null,
    () => listCustomers(orgId!, debouncedSearch, page),
  )

  function updateParams(q: string, p: number) {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (p > 0) next.set('p', String(p))
    setParams(next, { replace: true })
  }

  const hasNoCustomers = data && data.total === 0 && !debouncedSearch

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <>
            <Button variant="secondary" icon="upload" onClick={() => navigate('/clientes/importar')}>
              Importar ficheiro
            </Button>
            <Button icon="plus" onClick={() => navigate('/clientes/novo')}>
              Novo cliente
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}{' '}
          <button type="button" onClick={reload} className="font-medium underline">
            Tentar novamente
          </button>
        </Alert>
      )}

      {hasNoCustomers ? (
        <EmptyState
          icon="users"
          title="Ainda não existem clientes"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" icon="upload" onClick={() => navigate('/clientes/importar')}>
                Importar ficheiro
              </Button>
              <Button icon="plus" onClick={() => navigate('/clientes/novo')}>
                Novo cliente
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <SearchInput
              value={search}
              onChange={(value) => updateParams(value, 0)}
              placeholder="Nome, telefone ou email"
              label="Pesquisar clientes"
            />
            {isLoading && <Spinner className="size-4 text-slate-400" />}
          </div>

          {data && data.customers.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Nenhum cliente encontrado.
            </p>
          )}

          {data && data.customers.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Cabeçalho (só em ecrãs largos) */}
              <div className="hidden grid-cols-[2fr_1.2fr_1.5fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase md:grid">
                <span>Nome</span>
                <span>Telefone</span>
                <span>Email</span>
                <span className="w-4" />
              </div>
              <ul className="divide-y divide-slate-100">
                {data.customers.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      to={`/clientes/${customer.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-5 py-3 hover:bg-slate-50 md:grid-cols-[2fr_1.2fr_1.5fr_auto]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-slate-900">{customer.full_name}</span>
                        {customer.contact_opt_out && (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            Não contactar
                          </span>
                        )}
                      </span>
                      <Icon name="chevronRight" className="size-4 text-slate-400 md:order-last" />
                      <span className="text-sm text-slate-600">{formatPhone(customer.phone)}</span>
                      <span className="hidden truncate text-sm text-slate-500 md:block">{customer.email ?? '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={(p) => updateParams(search, p)} />
          )}
        </>
      )}

      {!data && isLoading && (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner className="size-6" />
        </div>
      )}
    </>
  )
}
