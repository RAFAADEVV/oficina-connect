import { Link, useSearchParams } from 'react-router'
import { Alert, EmptyState, PageHeader, Pagination, SearchInput, Spinner } from '../../components/ui'
import { useOrganization } from '../../features/organization/useOrganization'
import { listVehicles, PAGE_SIZE } from '../../features/vehicles/vehiclesApi'
import { formatNumber, formatPlate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { usePageTitle } from '../../lib/usePageTitle'

export function VeiculosPage() {
  usePageTitle('Veículos')
  const { organization } = useOrganization()

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('p') ?? 0) || 0)
  const debouncedSearch = useDebouncedValue(search)

  const orgId = organization?.id ?? null
  const { data, error, isLoading, reload } = useAsyncData(
    orgId ? `veiculos:${orgId}:${debouncedSearch}:${page}` : null,
    () => listVehicles(orgId!, debouncedSearch, page),
  )

  function updateParams(q: string, p: number) {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (p > 0) next.set('p', String(p))
    setParams(next, { replace: true })
  }

  const hasNoVehicles = data && data.total === 0 && !debouncedSearch

  return (
    <>
      <PageHeader title="Veículos" />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}{' '}
          <button type="button" onClick={reload} className="font-medium underline">
            Tentar novamente
          </button>
        </Alert>
      )}

      {hasNoVehicles ? (
        <EmptyState icon="car" title="Ainda não existem veículos" />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <SearchInput
              value={search}
              onChange={(value) => updateParams(value, 0)}
              placeholder="Matrícula, marca ou modelo"
              label="Pesquisar veículos"
            />
            {isLoading && <Spinner className="size-4 text-slate-400" />}
          </div>

          {data && data.vehicles.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Nenhum veículo encontrado.
            </p>
          )}

          {data && data.vehicles.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[8rem_2fr_1fr_1.5fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase md:grid">
                <span>Matrícula</span>
                <span>Marca e modelo</span>
                <span>Ano · km</span>
                <span>Cliente</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {data.vehicles.map((vehicle) => (
                  <li
                    key={vehicle.id}
                    className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[8rem_2fr_1fr_1.5fr]"
                  >
                    <span className="w-fit rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-sm font-semibold tracking-wide text-slate-800">
                      {formatPlate(vehicle.plate)}
                    </span>
                    <span className="truncate text-sm text-slate-900">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
                    </span>
                    <span className="col-start-2 text-xs text-slate-500 md:col-start-auto md:text-sm">
                      {[vehicle.year, vehicle.mileage !== null ? `${formatNumber(vehicle.mileage)} km` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                    <span className="col-start-2 truncate text-sm md:col-start-auto">
                      {vehicle.customer_id && vehicle.ownerName ? (
                        <Link to={`/clientes/${vehicle.customer_id}`} className="text-brand-700 hover:underline">
                          {vehicle.ownerName}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Sem cliente</span>
                      )}
                    </span>
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
