import { useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { Alert, Button, FullPageLoader, Icon } from '../../components/ui'
import { getServiceReport, serviceTypeLabel } from '../../features/services/servicesApi'
import { formatDate, formatNumber, formatPhone, formatPlate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-24 shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-900">{value || '—'}</span>
    </div>
  )
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString('pt-PT')
}

/**
 * Relatório técnico de um serviço, em formato A4, para imprimir ou guardar em PDF
 * (através da janela de impressão do navegador). Não é uma fatura.
 */
export function RelatorioServicoPage() {
  const { id } = useParams()
  const { data, error } = useAsyncData(`relatorio:${id}`, () => getServiceReport(id!))

  // O título da página é usado como nome do ficheiro PDF
  useEffect(() => {
    if (data) {
      document.title = `Relatório ${formatPlate(data.vehicle.plate)} ${formatDate(data.service.service_date).replaceAll('/', '-')}`
    }
  }, [data])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Alert variant="error">{error}</Alert>
      </div>
    )
  }
  if (!data) return <FullPageLoader />

  const { service, parts, vehicle, customer, organization } = data
  const car = [vehicle.make, vehicle.model].filter(Boolean).join(' ')
  const hasNext = service.next_service_date || service.next_service_mileage
  const reference = service.id.slice(0, 8).toUpperCase()

  return (
    <div className="min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
      {/* Barra de ações (não aparece na impressão) */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Button variant="secondary" onClick={() => window.close()}>
          Fechar
        </Button>
        <Button onClick={() => window.print()}>
          <Icon name="printer" className="size-4" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Cabeçalho */}
        <header className="flex flex-col gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-start sm:justify-between print:flex-row">
          <div>
            <p className="text-xl font-bold">{organization.name}</p>
            <div className="mt-1 space-y-0.5 text-xs text-slate-600">
              {organization.address && <p>{organization.address}</p>}
              {(organization.phone || organization.email) && (
                <p>{[organization.phone && formatPhone(organization.phone), organization.email].filter(Boolean).join(' · ')}</p>
              )}
              {organization.nif && <p>NIF {organization.nif}</p>}
            </div>
          </div>
          <div className="sm:text-right print:text-right">
            <p className="text-lg font-semibold">Relatório de serviço</p>
            <p className="text-sm text-slate-600">{formatDate(service.service_date)}</p>
            <p className="text-xs text-slate-500">Ref. {reference}</p>
          </div>
        </header>

        {/* Cliente e veículo */}
        <div className="grid gap-x-8 sm:grid-cols-2 print:grid-cols-2">
          <Section title="Cliente">
            <Field label="Nome" value={customer?.full_name} />
            <Field label="Telefone" value={customer ? formatPhone(customer.phone) : null} />
            {customer?.nif && <Field label="NIF" value={customer.nif} />}
          </Section>
          <Section title="Veículo">
            <Field label="Matrícula" value={<strong className="font-mono">{formatPlate(vehicle.plate)}</strong>} />
            <Field label="Marca/modelo" value={car} />
            {vehicle.year && <Field label="Ano" value={vehicle.year} />}
          </Section>
        </div>

        {/* Serviço */}
        <Section title="Serviço">
          <Field label="Tipo" value={serviceTypeLabel(service.service_type)} />
          {service.description !== serviceTypeLabel(service.service_type) && (
            <Field label="Descrição" value={service.description} />
          )}
          <Field label="Km" value={service.mileage !== null ? `${formatNumber(service.mileage)} km` : null} />
        </Section>

        {service.problem && (
          <Section title="Avaria / sintoma reportado">
            <p className="text-sm whitespace-pre-line">{service.problem}</p>
          </Section>
        )}

        {service.work_done && (
          <Section title="Trabalho efetuado">
            <p className="text-sm whitespace-pre-line">{service.work_done}</p>
          </Section>
        )}

        {service.checklist.length > 0 && (
          <Section title="Lista de verificação">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {service.checklist.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Icon name="check" className="size-4 text-emerald-700" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {parts.length > 0 && (
          <Section title="Peças aplicadas">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-1 font-medium">Descrição</th>
                  <th className="pb-1 font-medium">Referência</th>
                  <th className="pb-1 text-right font-medium">Qtd.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {parts.map((part) => (
                  <tr key={part.id}>
                    <td className="py-1.5 pr-4">{part.description}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs">{part.reference ?? '—'}</td>
                    <td className="py-1.5 text-right">{formatQuantity(Number(part.quantity))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {service.recommendations && (
          <Section title="Observações e recomendações">
            <p className="text-sm whitespace-pre-line">{service.recommendations}</p>
          </Section>
        )}

        {hasNext && (
          <section className="mt-6 break-inside-avoid rounded-lg border-2 border-slate-900 px-5 py-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Próxima revisão</p>
            <p className="mt-0.5 text-lg font-bold">
              {[
                service.next_service_date && formatDate(service.next_service_date),
                service.next_service_mileage !== null && `${formatNumber(service.next_service_mileage)} km`,
              ]
                .filter(Boolean)
                .join(' ou aos ')}
            </p>
          </section>
        )}

        <footer className="mt-10 break-inside-avoid">
          <div className="flex justify-end">
            <div className="w-56 border-t border-slate-400 pt-1 text-center text-xs text-slate-500">O responsável</div>
          </div>
          <p className="mt-8 border-t border-slate-200 pt-2 text-center text-xs text-slate-500">
            Este documento não é uma fatura. Relatório técnico do serviço efetuado ao veículo.
          </p>
        </footer>
      </article>
    </div>
  )
}
