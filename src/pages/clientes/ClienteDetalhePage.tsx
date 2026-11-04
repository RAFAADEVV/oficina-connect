import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, ConfirmDialog, Icon, PageHeader, Spinner } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { deleteCustomer, getCustomer } from '../../features/customers/customersApi'
import { buildCustomerExport, downloadJson } from '../../features/customers/exportCustomer'
import { exportFileName } from '../../features/customers/exportFileName'
import { useOrganization } from '../../features/organization/useOrganization'
import { VehicleServices } from '../../features/services/VehicleServices'
import { VehicleForm } from '../../features/vehicles/VehicleForm'
import {
  createVehicle,
  deleteVehicle,
  listCustomerVehicles,
  updateVehicle,
  type Vehicle,
} from '../../features/vehicles/vehiclesApi'
import { formatDate, formatNumber, formatPhone, formatPlate, whatsappNumber } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 sm:col-span-2 sm:mt-0">{value || '—'}</dd>
    </div>
  )
}

export function ClienteDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { organization } = useOrganization()
  const isOwner = organization?.role === 'owner'

  const customerQuery = useAsyncData(`cliente:${id}`, () => getCustomer(id!))
  const vehiclesQuery = useAsyncData(`cliente-veiculos:${id}`, () => listCustomerVehicles(id!))
  const customer = customerQuery.data
  usePageTitle(customer?.full_name ?? 'Cliente')

  // Veículo a ser adicionado ('new') ou editado (id)
  const [editingVehicle, setEditingVehicle] = useState<'new' | string | null>(null)
  const [toDelete, setToDelete] = useState<{ type: 'customer' } | { type: 'vehicle'; vehicle: Vehicle } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Veículos com o histórico de serviços aberto (com um só veículo, abre logo)
  const [toggledVehicles, setToggledVehicles] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  if (customerQuery.error) {
    return (
      <>
        <Link to="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <Icon name="arrowLeft" className="size-4" />
          Clientes
        </Link>
        <Alert variant="error">{customerQuery.error}</Alert>
      </>
    )
  }

  if (!customer || !organization) {
    return (
      <div className="flex justify-center py-16 text-brand-600">
        <Spinner className="size-6" />
      </div>
    )
  }

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    setActionError(null)
    try {
      if (toDelete.type === 'customer') {
        await deleteCustomer(customer!.id)
        navigate('/clientes', { replace: true })
        return
      }
      await deleteVehicle(toDelete.vehicle.id)
      vehiclesQuery.reload()
      setToDelete(null)
    } catch (err) {
      setActionError(getErrorMessage(err))
      setToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  // RGPD: o cliente pode pedir uma cópia de todos os seus dados
  async function exportData() {
    setIsExporting(true)
    setActionError(null)
    try {
      const data = await buildCustomerExport(customer!.id, organization!.name)
      downloadJson(data, exportFileName(customer!.full_name))
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setIsExporting(false)
    }
  }

  const vehicles = vehiclesQuery.data ?? []
  const openByDefault = vehicles.length === 1
  const isServicesOpen = (vehicleId: string) => toggledVehicles.includes(vehicleId) !== openByDefault
  const toggleServices = (vehicleId: string) =>
    setToggledVehicles((current) =>
      current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId],
    )

  return (
    <>
      <Link to="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="arrowLeft" className="size-4" />
        Clientes
      </Link>

      <PageHeader
        title={customer.full_name}
        actions={
          <>
            {!customer.contact_opt_out && (
              <a
                href={`https://wa.me/${whatsappNumber(customer.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Icon name="phone" className="size-4" />
                WhatsApp
              </a>
            )}
            <Button variant="secondary" icon="pencil" onClick={() => navigate(`/clientes/${customer.id}/editar`)}>
              Editar
            </Button>
            <Button
              variant="ghost"
              icon="download"
              isLoading={isExporting}
              onClick={() => void exportData()}
              title="Descarregar todos os dados deste cliente (RGPD)"
            >
              Exportar dados
            </Button>
            {isOwner && (
              <Button variant="ghost" icon="trash" onClick={() => setToDelete({ type: 'customer' })} aria-label="Apagar cliente">
                Apagar
              </Button>
            )}
          </>
        }
      />

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {customer.contact_opt_out && (
        <Alert variant="info" className="mb-4">
          Este cliente pediu para não ser contactado
          {customer.contact_opt_out_at ? ` (desde ${formatDate(customer.contact_opt_out_at)})` : ''}.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Dados do cliente">
          <dl className="-my-2.5 divide-y divide-slate-100">
            <InfoRow label="Telefone" value={formatPhone(customer.phone)} />
            <InfoRow label="Email" value={customer.email} />
            <InfoRow label="NIF" value={customer.nif} />
            <InfoRow label="Morada" value={customer.address} />
            <InfoRow label="Notas" value={customer.notes} />
            <InfoRow label="Cliente desde" value={formatDate(customer.created_at)} />
          </dl>
        </Card>

        <Card
          title="Veículos"
          actions={
            editingVehicle === null && (
              <Button size="sm" icon="plus" onClick={() => setEditingVehicle('new')}>
                Adicionar
              </Button>
            )
          }
        >
          {editingVehicle === 'new' && (
            <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <VehicleForm
                customerId={customer.id}
                submitLabel="Adicionar veículo"
                onCancel={() => setEditingVehicle(null)}
                onSubmit={async (input) => {
                  await createVehicle(organization.id, input)
                  setEditingVehicle(null)
                  vehiclesQuery.reload()
                }}
              />
            </div>
          )}

          {vehiclesQuery.error && <Alert variant="error">{vehiclesQuery.error}</Alert>}

          {vehiclesQuery.data && vehicles.length === 0 && editingVehicle !== 'new' && (
            <p className="py-6 text-center text-sm text-slate-500">Sem veículos registados.</p>
          )}

          <ul className="-my-3 divide-y divide-slate-100">
            {vehicles.map((vehicle) =>
              editingVehicle === vehicle.id ? (
                <li key={vehicle.id} className="py-4">
                  <VehicleForm
                    customerId={customer.id}
                    initial={vehicle}
                    submitLabel="Guardar"
                    onCancel={() => setEditingVehicle(null)}
                    onSubmit={async (input) => {
                      await updateVehicle(vehicle.id, input)
                      setEditingVehicle(null)
                      vehiclesQuery.reload()
                    }}
                  />
                </li>
              ) : (
                <li key={vehicle.id} className="py-3">
                  <div className="flex items-center gap-3">
                  <span className="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-sm font-semibold tracking-wide text-slate-800">
                    {formatPlate(vehicle.plate)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Marca/modelo por indicar'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[vehicle.year, vehicle.mileage !== null ? `${formatNumber(vehicle.mileage)} km` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  {editingVehicle === null && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-expanded={isServicesOpen(vehicle.id)}
                        onClick={() => toggleServices(vehicle.id)}
                      >
                        Serviços
                      </Button>
                      <Button size="sm" variant="ghost" icon="pencil" onClick={() => setEditingVehicle(vehicle.id)} aria-label={`Editar ${formatPlate(vehicle.plate)}`}>
                        <span className="sr-only sm:not-sr-only">Editar</span>
                      </Button>
                      {isOwner && (
                        <Button size="sm" variant="ghost" icon="trash" onClick={() => setToDelete({ type: 'vehicle', vehicle })} aria-label={`Apagar ${formatPlate(vehicle.plate)}`} />
                      )}
                    </div>
                  )}
                  </div>
                  {isServicesOpen(vehicle.id) && (
                    <VehicleServices vehicleId={vehicle.id} canDelete={isOwner} />
                  )}
                </li>
              ),
            )}
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete?.type === 'customer' ? 'Apagar cliente?' : 'Apagar veículo?'}
        confirmLabel="Apagar"
        isLoading={isDeleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        {toDelete?.type === 'customer' ? (
          <>
            <strong>{customer.full_name}</strong> vai ser apagado definitivamente. Os veículos ficam registados, mas sem
            dono.
          </>
        ) : (
          toDelete?.type === 'vehicle' && (
            <>
              O veículo <strong>{formatPlate(toDelete.vehicle.plate)}</strong> e todo o seu histórico de serviços vão
              ser apagados definitivamente.
            </>
          )
        )}
      </ConfirmDialog>
    </>
  )
}
