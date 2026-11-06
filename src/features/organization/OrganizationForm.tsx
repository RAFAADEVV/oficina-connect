import { useState, type FormEvent } from 'react'
import { Alert, Button, TextField } from '../../components/ui'
import { emptyToNull, formatPhone, nifError, normalizePhone } from '../../lib/format'
import { getErrorMessage } from '../auth/authErrors'
import { validateEmail } from '../auth/validation'
import type { OrganizationDetails, OrganizationUpdate } from './organizationApi'

interface OrganizationFormProps {
  initial: OrganizationDetails
  canEdit: boolean
  onSubmit: (input: OrganizationUpdate) => Promise<void>
}

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'nif' | 'interval', string>>

/** Dados da oficina que aparecem nos relatórios de serviço. Só o Dono pode alterar. */
export function OrganizationForm({ initial, canEdit, onSubmit }: OrganizationFormProps) {
  const [name, setName] = useState(initial.name)
  const [address, setAddress] = useState(initial.address ?? '')
  const [phone, setPhone] = useState(initial.phone ? formatPhone(initial.phone) : '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [nif, setNif] = useState(initial.nif ?? '')
  const [intervalMonths, setIntervalMonths] = useState(String(initial.service_interval_months))
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSaved(false)

    const normalizedPhone = phone.trim() ? normalizePhone(phone) : null
    const months = Number(intervalMonths)
    const next: Errors = {
      name: name.trim().length < 2 ? 'Indique o nome da oficina (pelo menos 2 caracteres).' : undefined,
      phone: phone.trim() && !normalizedPhone ? 'Indique um telefone válido.' : undefined,
      email: email.trim() ? validateEmail(email) : undefined,
      nif: nifError(nif),
      interval: !Number.isInteger(months) || months < 1 || months > 60 ? 'Indique um número de meses entre 1 e 60.' : undefined,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        address: emptyToNull(address),
        phone: normalizedPhone,
        email: emptyToNull(email.toLowerCase()),
        nif: emptyToNull(nif.replace(/\s/g, '')),
        service_interval_months: months,
      })
      setSaved(true)
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="error">{formError}</Alert>}
      {saved && <Alert variant="success">Dados guardados.</Alert>}
      {!canEdit && <Alert variant="info">Só o Dono da oficina pode alterar estes dados.</Alert>}

      <fieldset disabled={!canEdit} className="grid gap-5 sm:grid-cols-2">
        <TextField label="Nome da oficina *" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={120} className="sm:col-span-2" />
        <TextField label="Morada" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} className="sm:col-span-2" />
        <TextField label="Telefone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="NIF" inputMode="numeric" value={nif} onChange={(e) => setNif(e.target.value)} error={errors.nif} maxLength={11} />
        <TextField
          label="Intervalo padrão de revisão (meses)"
          inputMode="numeric"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
          error={errors.interval}
          hint="Se não houver data combinada com o cliente nem histórico de revisões, a próxima revisão é calculada com este intervalo a partir da última."
          maxLength={2}
        />
      </fieldset>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            Guardar
          </Button>
        </div>
      )}
    </form>
  )
}
