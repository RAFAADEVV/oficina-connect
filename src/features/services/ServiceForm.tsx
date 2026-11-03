import { useState, type FormEvent } from 'react'
import { Alert, Button, TextField } from '../../components/ui'
import { cn } from '../../lib/cn'
import { addMonths, todayIso } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import type { ServiceType } from '../../types/database'
import { getErrorMessage } from '../auth/authErrors'
import { REVISION_TYPES, SERVICE_TYPES, serviceTypeLabel, type ServiceInput } from './servicesApi'

interface ServiceFormProps {
  onSubmit: (input: ServiceInput) => Promise<void>
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

function parseKm(value: string): number | null | 'invalid' {
  const digits = value.replace(/[\s.]/g, '')
  if (!digits) return null
  return /^\d+$/.test(digits) && Number(digits) <= 3_000_000 ? Number(digits) : 'invalid'
}

const selectClass =
  'mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'

/** Registar um serviço feito a um veículo, com a próxima revisão combinada com o cliente. */
export function ServiceForm({ onSubmit, onCancel }: ServiceFormProps) {
  const today = todayIso()
  const [serviceDate, setServiceDate] = useState(today)
  const [serviceType, setServiceType] = useState<ServiceType>('revisao')
  const [description, setDescription] = useState('')
  const [mileage, setMileage] = useState('')
  const [nextChoice, setNextChoice] = useState<NextChoice>(12)
  const [nextDate, setNextDate] = useState('')
  const [nextKm, setNextKm] = useState('')
  const [errors, setErrors] = useState<Partial<Record<'serviceDate' | 'mileage' | 'nextDate' | 'nextKm', string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRevision = REVISION_TYPES.includes(serviceType)
  const computedNextDate =
    !isRevision || nextChoice === 'none' ? null : nextChoice === 'date' ? nextDate || null : addMonths(serviceDate || today, nextChoice)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const km = parseKm(mileage)
    const nextKmValue = isRevision ? parseKm(nextKm) : null
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
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        service_date: serviceDate,
        service_type: serviceType,
        description: description.trim() || serviceTypeLabel(serviceType),
        mileage: km === 'invalid' ? null : km,
        next_service_date: computedNextDate,
        next_service_mileage: typeof nextKmValue === 'number' ? nextKmValue : null,
      })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Data *"
          type="date"
          max={today}
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
          error={errors.serviceDate}
        />
        <div>
          <label htmlFor="service-type" className="block text-sm font-medium text-slate-700">
            Tipo *
          </label>
          <select
            id="service-type"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
            className={selectClass}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label="Descrição"
          placeholder={serviceTypeLabel(serviceType)}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
        <TextField
          label="Km do carro"
          inputMode="numeric"
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
          error={errors.mileage}
          maxLength={9}
        />
      </div>

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
                  'h-9 rounded-lg border px-3 text-sm font-medium transition-colors',
                  nextChoice === choice.value
                    ? 'border-brand-600 bg-brand-600 text-white'
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
          Guardar serviço
        </Button>
      </div>
    </form>
  )
}
