import { useState, type FormEvent } from 'react'
import { Alert, Button, Icon, TextAreaField, TextField } from '../../components/ui'
import { cn } from '../../lib/cn'
import { addMonths, todayIso } from '../../lib/dates'
import { emptyToNull, formatDate } from '../../lib/format'
import type { ServiceType } from '../../types/database'
import { getErrorMessage } from '../auth/authErrors'
import {
  CHECKLIST_ITEMS,
  REVISION_TYPES,
  SERVICE_TYPES,
  serviceTypeLabel,
  type PartInput,
  type ServiceInput,
  type ServicePart,
  type ServiceRecord,
} from './servicesApi'

interface ServiceFormProps {
  /** Ao editar: o serviço e as peças atuais */
  initial?: { service: ServiceRecord; parts: ServicePart[] }
  onSubmit: (input: ServiceInput, parts: PartInput[]) => Promise<void>
  onCancel: () => void
}

type NextChoice = 6 | 12 | 24 | 'date' | 'none'

const NEXT_CHOICES: { value: NextChoice; label: string }[] = [
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
  { value: 'date', label: 'Outra data' },
  { value: 'none', label: 'Sem data' },
]

interface PartRow {
  key: number
  /** Peça já gravada (ao editar) */
  id?: string
  description: string
  reference: string
  quantity: string
}

function parseKm(value: string): number | null | 'invalid' {
  const digits = value.replace(/[\s.]/g, '')
  if (!digits) return null
  return /^\d+$/.test(digits) && Number(digits) <= 3_000_000 ? Number(digits) : 'invalid'
}

function parseQuantity(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 9999 ? Math.round(n * 100) / 100 : null
}

const selectClass =
  'mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'
const smallInputClass =
  'block h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'

let nextPartKey = 1

/** Ao editar, mostra a escolha que corresponde à data já combinada. */
function initialNextChoice(service: ServiceRecord): NextChoice {
  if (!service.next_service_date) return 'none'
  const months = ([6, 12, 24] as const).find((m) => addMonths(service.service_date, m) === service.next_service_date)
  return months ?? 'date'
}

/** Registar um serviço: dados técnicos, peças aplicadas e próxima revisão. Sem preços. */
export function ServiceForm({ initial, onSubmit, onCancel }: ServiceFormProps) {
  const today = todayIso()
  const s = initial?.service
  const [serviceDate, setServiceDate] = useState(s?.service_date ?? today)
  const [serviceType, setServiceType] = useState<ServiceType>(s?.service_type ?? 'revisao')
  // Ao editar, o título só fica preenchido se for diferente do nome do tipo
  const [description, setDescription] = useState(
    s && s.description !== serviceTypeLabel(s.service_type) ? s.description : '',
  )
  const [mileage, setMileage] = useState(s?.mileage != null ? String(s.mileage) : '')
  const [problem, setProblem] = useState(s?.problem ?? '')
  const [workDone, setWorkDone] = useState(s?.work_done ?? '')
  const [checklist, setChecklist] = useState<string[]>(s?.checklist ?? [])
  const [recommendations, setRecommendations] = useState(s?.recommendations ?? '')
  const [parts, setParts] = useState<PartRow[]>(
    () =>
      initial?.parts.map((p) => ({
        key: nextPartKey++,
        id: p.id,
        description: p.description,
        reference: p.reference ?? '',
        quantity: String(p.quantity).replace('.', ','),
      })) ?? [],
  )
  const [nextChoice, setNextChoice] = useState<NextChoice>(s ? initialNextChoice(s) : 12)
  const [nextDate, setNextDate] = useState(s?.next_service_date ?? '')
  const [nextKm, setNextKm] = useState(s?.next_service_mileage != null ? String(s.next_service_mileage) : '')
  const [errors, setErrors] = useState<Partial<Record<'serviceDate' | 'mileage' | 'nextDate' | 'nextKm' | 'parts', string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRevision = REVISION_TYPES.includes(serviceType)
  const isRepair = !isRevision
  const computedNextDate =
    !isRevision || nextChoice === 'none' ? null : nextChoice === 'date' ? nextDate || null : addMonths(serviceDate || today, nextChoice)

  const toggleCheck = (item: string) =>
    setChecklist((current) => (current.includes(item) ? current.filter((i) => i !== item) : [...current, item]))
  const updatePart = (key: number, changes: Partial<PartRow>) =>
    setParts((current) => current.map((p) => (p.key === key ? { ...p, ...changes } : p)))
  const addPart = () => setParts((current) => [...current, { key: nextPartKey++, description: '', reference: '', quantity: '1' }])
  const removePart = (key: number) => setParts((current) => current.filter((p) => p.key !== key))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const km = parseKm(mileage)
    const nextKmValue = isRevision ? parseKm(nextKm) : null
    const filledParts = parts.filter((p) => p.description.trim() || p.reference.trim())
    const badPart = filledParts.find((p) => !p.description.trim() || parseQuantity(p.quantity) === null)

    const next = {
      serviceDate: !serviceDate ? 'Indique a data do serviço.' : serviceDate > today ? 'A data não pode ser no futuro.' : undefined,
      mileage: km === 'invalid' ? 'Indique os quilómetros só com números.' : undefined,
      nextDate:
        isRevision && nextChoice === 'date' && (!nextDate || nextDate <= serviceDate)
          ? 'Escolha uma data depois do serviço.'
          : undefined,
      nextKm:
        nextKmValue === 'invalid'
          ? 'Indique os quilómetros só com números.'
          : typeof nextKmValue === 'number' && typeof km === 'number' && nextKmValue <= km
            ? 'Tem de ser mais do que os km atuais.'
            : undefined,
      parts: badPart ? 'Cada peça precisa de descrição e de uma quantidade válida.' : undefined,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setIsSubmitting(true)
    try {
      await onSubmit(
        {
          service_date: serviceDate,
          service_type: serviceType,
          description: description.trim() || serviceTypeLabel(serviceType),
          mileage: km === 'invalid' ? null : km,
          next_service_date: computedNextDate,
          next_service_mileage: typeof nextKmValue === 'number' ? nextKmValue : null,
          problem: isRepair ? emptyToNull(problem) : null,
          work_done: emptyToNull(workDone),
          checklist: isRevision ? CHECKLIST_ITEMS.filter((item) => checklist.includes(item)) : [],
          recommendations: emptyToNull(recommendations),
        },
        filledParts.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          description: p.description.trim(),
          reference: emptyToNull(p.reference),
          quantity: parseQuantity(p.quantity) ?? 1,
        })),
      )
    } catch (err) {
      setFormError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Data *" type="date" max={today} value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} error={errors.serviceDate} />
        <div>
          <label htmlFor="service-type" className="block text-sm font-medium text-slate-700">
            Tipo *
          </label>
          <select id="service-type" value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)} className={selectClass}>
            {SERVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Título" placeholder={serviceTypeLabel(serviceType)} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        <TextField label="Km do carro" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} error={errors.mileage} maxLength={9} />
        {isRepair && (
          <TextAreaField
            label="Avaria / sintoma reportado"
            rows={2}
            placeholder="Ex.: barulho ao travar"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            maxLength={1000}
            className="sm:col-span-2"
          />
        )}
        <TextAreaField
          label="Trabalho efetuado"
          rows={3}
          value={workDone}
          onChange={(e) => setWorkDone(e.target.value)}
          maxLength={2000}
          className="sm:col-span-2"
        />
      </div>

      {isRevision && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Lista de verificação</legend>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checklist.includes(item)}
                  onChange={() => toggleCheck(item)}
                  className="size-4 rounded border-slate-300 accent-brand-600"
                />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Peças aplicadas</legend>
        {parts.length > 0 && (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_9rem_5rem_2.25rem] gap-2 text-xs text-slate-500 sm:grid">
              <span>Descrição</span>
              <span>Referência</span>
              <span>Qtd.</span>
              <span />
            </div>
            {parts.map((part, index) => (
              <div key={part.key} className="grid grid-cols-[1fr_5rem_2.25rem] gap-2 sm:grid-cols-[1fr_9rem_5rem_2.25rem]">
                <input
                  aria-label={`Peça ${index + 1}: descrição`}
                  placeholder="Ex.: Pastilhas de travão"
                  value={part.description}
                  onChange={(e) => updatePart(part.key, { description: e.target.value })}
                  maxLength={200}
                  className={cn(smallInputClass, 'col-span-3 sm:col-span-1')}
                />
                <input
                  aria-label={`Peça ${index + 1}: referência`}
                  placeholder="Referência"
                  value={part.reference}
                  onChange={(e) => updatePart(part.key, { reference: e.target.value })}
                  maxLength={60}
                  className={smallInputClass}
                />
                <input
                  aria-label={`Peça ${index + 1}: quantidade`}
                  inputMode="decimal"
                  value={part.quantity}
                  onChange={(e) => updatePart(part.key, { quantity: e.target.value })}
                  maxLength={7}
                  className={smallInputClass}
                />
                <button
                  type="button"
                  onClick={() => removePart(part.key)}
                  aria-label={`Remover peça ${index + 1}`}
                  className="flex h-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <Icon name="close" className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {errors.parts && <p className="mt-1.5 text-xs text-red-600">{errors.parts}</p>}
        <Button size="sm" variant="secondary" icon="plus" onClick={addPart} className="mt-2" disabled={parts.length >= 50}>
          Adicionar peça
        </Button>
      </fieldset>

      <TextAreaField
        label="Observações e recomendações"
        rows={2}
        placeholder="Ex.: pastilhas de trás a 30%, trocar na próxima visita"
        value={recommendations}
        onChange={(e) => setRecommendations(e.target.value)}
        maxLength={2000}
      />

      {isRevision && (
        <fieldset className="rounded-lg border border-brand-200 bg-brand-50/50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Próxima revisão</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Próxima revisão">
            {NEXT_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={nextChoice === choice.value}
                onClick={() => setNextChoice(choice.value)}
                className={cn(
                  'h-9 rounded-lg border px-3 text-sm font-medium',
                  nextChoice === choice.value
                    ? 'border-brand-600 bg-brand-600 text-ink'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {nextChoice === 'date' ? (
              <TextField
                label="Data da próxima revisão"
                type="date"
                min={serviceDate}
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                error={errors.nextDate}
              />
            ) : (
              <p className="self-center text-sm text-slate-700">
                {computedNextDate ? (
                  <>
                    Próxima revisão: <strong>{formatDate(computedNextDate)}</strong>
                  </>
                ) : (
                  'Sem data combinada.'
                )}
              </p>
            )}
            <TextField
              label="Ou aos km"
              inputMode="numeric"
              placeholder="Ex.: 100 000"
              value={nextKm}
              onChange={(e) => setNextKm(e.target.value)}
              error={errors.nextKm}
              maxLength={9}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">O cliente aparece nas Oportunidades 1 mês e 1 semana antes.</p>
        </fieldset>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initial ? 'Guardar alterações' : 'Guardar serviço'}
        </Button>
      </div>
    </form>
  )
}
