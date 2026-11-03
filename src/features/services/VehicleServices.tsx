import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, ConfirmDialog, Icon, Spinner } from '../../components/ui'
import { formatDate, formatNumber } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { getErrorMessage } from '../auth/authErrors'
import { ServiceForm } from './ServiceForm'
import { createService, deleteService, listVehicleServices, REVISION_TYPES, serviceTypeLabel, type ServiceRecord } from './servicesApi'

interface VehicleServicesProps {
  vehicleId: string
  canDelete: boolean
}

/** Histórico de serviços de um veículo e registo de novos serviços. */
export function VehicleServices({ vehicleId, canDelete }: VehicleServicesProps) {
  const services = useAsyncData(`servicos:${vehicleId}`, () => listVehicleServices(vehicleId))
  const [isAdding, setIsAdding] = useState(false)
  const [toDelete, setToDelete] = useState<ServiceRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastRevision = services.data?.find((s) => REVISION_TYPES.includes(s.service_type))

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteService(toDelete.id)
      services.reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {lastRevision && (lastRevision.next_service_date || lastRevision.next_service_mileage) && (
        <p className="mb-3 text-sm text-slate-700">
          Próxima revisão:{' '}
          <strong>
            {[
              lastRevision.next_service_date && formatDate(lastRevision.next_service_date),
              lastRevision.next_service_mileage && `${formatNumber(lastRevision.next_service_mileage)} km`,
            ]
              .filter(Boolean)
              .join(' ou aos ')}
          </strong>
        </p>
      )}

      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}

      {isAdding ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <ServiceForm
            onCancel={() => setIsAdding(false)}
            onSubmit={async (input, parts) => {
              await createService(vehicleId, input, parts)
              setIsAdding(false)
              services.reload()
            }}
          />
        </div>
      ) : (
        <Button size="sm" icon="plus" onClick={() => setIsAdding(true)} className="mb-3">
          Registar serviço
        </Button>
      )}

      {services.error && <Alert variant="error">{services.error}</Alert>}
      {services.isLoading && !services.data && <Spinner className="size-4 text-slate-400" />}
      {services.data && services.data.length === 0 && <p className="text-sm text-slate-500">Sem serviços registados.</p>}

      {services.data && services.data.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {services.data.map((service) => (
            <li key={service.id} className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-sm text-slate-500">{formatDate(service.service_date)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900">
                  <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    {serviceTypeLabel(service.service_type)}
                  </span>
                  {service.description}
                </p>
                {service.mileage !== null && <p className="text-xs text-slate-500">{formatNumber(service.mileage)} km</p>}
              </div>
              <Link
                to={`/relatorio/servico/${service.id}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Relatório do serviço de ${formatDate(service.service_date)}`}
              >
                <Icon name="file" className="size-4" />
                <span className="hidden sm:inline">Relatório</span>
              </Link>
              {canDelete && (
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setToDelete(service)} aria-label="Apagar serviço" />
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Apagar serviço?"
        confirmLabel="Apagar"
        isLoading={isDeleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        O serviço de {toDelete ? formatDate(toDelete.service_date) : ''} vai ser apagado definitivamente.
      </ConfirmDialog>
    </div>
  )
}
