import { useState, type FormEvent } from 'react'
import { Alert, Button, TextField } from '../../components/ui'
import { emptyToNull, formatPlate, isValidPlate, normalizePlate } from '../../lib/format'
import { getErrorMessage } from '../auth/authErrors'
import type { Vehicle, VehicleInput } from './vehiclesApi'

interface VehicleFormProps {
  customerId: string | null
  initial?: Vehicle
  submitLabel: string
  onSubmit: (input: VehicleInput) => Promise<void>
  onCancel: () => void
}

type Errors = Partial<Record<'plate' | 'year' | 'mileage', string>>

const currentYear = new Date().getFullYear()

/** Lê um número inteiro de um campo de texto ("85 000" → 85000). Vazio → null. */
function parseInteger(value: string): number | null | 'invalid' {
  const digits = value.replace(/[\s.]/g, '')
  if (!digits) return null
  return /^\d+$/.test(digits) ? Number(digits) : 'invalid'
}

export function VehicleForm({ customerId, initial, submitLabel, onSubmit, onCancel }: VehicleFormProps) {
  const [plate, setPlate] = useState(initial ? formatPlate(initial.plate) : '')
  const [make, setMake] = useState(initial?.make ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [year, setYear] = useState(initial?.year?.toString() ?? '')
  const [mileage, setMileage] = useState(initial?.mileage?.toString() ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsedYear = parseInteger(year)
    const parsedMileage = parseInteger(mileage)
    const next: Errors = {
      plate: isValidPlate(plate) ? undefined : 'Indique a matrícula (ex.: AA-00-BB).',
      year:
        parsedYear === 'invalid' || (parsedYear !== null && (parsedYear < 1900 || parsedYear > currentYear + 1))
          ? `Indique um ano entre 1900 e ${currentYear + 1}.`
          : undefined,
      mileage:
        parsedMileage === 'invalid' || (parsedMileage !== null && parsedMileage > 3_000_000)
          ? 'Indique os quilómetros só com números.'
          : undefined,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        customer_id: customerId,
        plate: normalizePlate(plate),
        make: emptyToNull(make),
        model: emptyToNull(model),
        year: parsedYear === 'invalid' ? null : parsedYear,
        mileage: parsedMileage === 'invalid' ? null : parsedMileage,
      })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert variant="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          label="Matrícula *"
          autoComplete="off"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          error={errors.plate}
          maxLength={15}
        />
        <TextField label="Marca" autoComplete="off" value={make} onChange={(e) => setMake(e.target.value)} maxLength={60} />
        <TextField label="Modelo" autoComplete="off" value={model} onChange={(e) => setModel(e.target.value)} maxLength={80} />
        <TextField
          label="Ano"
          inputMode="numeric"
          autoComplete="off"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          error={errors.year}
          maxLength={4}
        />
        <TextField
          label="Quilómetros"
          inputMode="numeric"
          autoComplete="off"
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
          error={errors.mileage}
          maxLength={9}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
