import { useState, type FormEvent } from 'react'
import { Alert, Button, TextAreaField, TextField } from '../../components/ui'
import { emptyToNull, formatPhone, nifError, normalizePhone } from '../../lib/format'
import { getErrorMessage } from '../auth/authErrors'
import { validateEmail } from '../auth/validation'
import type { Customer, CustomerInput } from './customersApi'

interface CustomerFormProps {
  initial?: Customer
  submitLabel: string
  onSubmit: (input: CustomerInput) => Promise<void>
  onCancel: () => void
}

type Errors = Partial<Record<'full_name' | 'phone' | 'email' | 'nif', string>>

/** Formulário de cliente (criar e editar). Valida e normaliza antes de enviar. */
export function CustomerForm({ initial, submitLabel, onSubmit, onCancel }: CustomerFormProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [phone, setPhone] = useState(initial ? formatPhone(initial.phone) : '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [nif, setNif] = useState(initial?.nif ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [optOut, setOptOut] = useState(initial?.contact_opt_out ?? false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const normalizedPhone = normalizePhone(phone)
    const next: Errors = {
      full_name: fullName.trim() ? undefined : 'Indique o nome do cliente.',
      phone: normalizedPhone ? undefined : 'Indique um telefone válido (ex.: 912 345 678).',
      email: email.trim() ? validateEmail(email) : undefined,
      nif: nifError(nif),
    }
    setErrors(next)
    if (Object.values(next).some(Boolean) || !normalizedPhone) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        full_name: fullName.trim(),
        phone: normalizedPhone,
        email: emptyToNull(email),
        nif: emptyToNull(nif.replace(/\s/g, '')),
        address: emptyToNull(address),
        notes: emptyToNull(notes),
        contact_opt_out: optOut,
      })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Nome *"
          autoComplete="off"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.full_name}
          maxLength={200}
          className="sm:col-span-2"
        />
        <TextField
          label="Telefone *"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="NIF"
          inputMode="numeric"
          autoComplete="off"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          error={errors.nif}
          maxLength={11}
        />
        <TextField
          label="Morada"
          autoComplete="off"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={300}
        />
        <TextAreaField
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          className="sm:col-span-2"
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={optOut}
          onChange={(e) => setOptOut(e.target.checked)}
          className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
        />
        <span>O cliente não quer ser contactado</span>
      </label>

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
