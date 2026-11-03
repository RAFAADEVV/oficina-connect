import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Icon } from '../../components/ui'
import { formatPhone, formatPlate } from '../../lib/format'
import { getErrorMessage } from '../auth/authErrors'
import { buildReminderMessage, whatsappLink } from './message'
import type { Reminder } from './remindersApi'

interface SendReminderDialogProps {
  reminder: Reminder | null
  organizationName: string
  onSend: (reminder: Reminder) => Promise<void>
  onClose: () => void
}

/**
 * Mostra a mensagem sugerida (editável). Ao confirmar, abre o WhatsApp com o texto
 * e regista o contacto. O envio é sempre feito pelo mecânico, a partir do WhatsApp da oficina.
 */
export function SendReminderDialog({ reminder, organizationName, onSend, onClose }: SendReminderDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [forReminder, setForReminder] = useState<Reminder | null>(null)

  // Prepara a mensagem sempre que se abre para um cliente diferente
  if (reminder && reminder !== forReminder) {
    setForReminder(reminder)
    setMessage(buildReminderMessage(reminder, organizationName))
    setError(null)
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (reminder && !dialog.open) dialog.showModal()
    if (!reminder && dialog.open) dialog.close()
  }, [reminder])

  async function handleSend() {
    if (!reminder || !message.trim()) return
    // Abrir o WhatsApp primeiro, no próprio clique (senão o navegador pode bloquear a janela)
    window.open(whatsappLink(reminder.customer_phone, message.trim()), '_blank', 'noopener,noreferrer')
    setIsSaving(true)
    try {
      await onSend(reminder)
    } catch (err) {
      setError(`A mensagem foi aberta no WhatsApp, mas não foi possível registar o contacto: ${getErrorMessage(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="send-reminder-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!isSaving) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      {reminder && (
        <>
          <div className="p-6">
            <h2 id="send-reminder-title" className="text-lg font-semibold text-slate-900">
              Enviar notificação
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {reminder.customer_name} · {formatPhone(reminder.customer_phone)} · {formatPlate(reminder.plate)}
            </p>

            {error && (
              <Alert variant="error" className="mt-4">
                {error}
              </Alert>
            )}

            <label htmlFor="reminder-message" className="mt-4 block text-sm font-medium text-slate-700">
              Mensagem
            </label>
            <textarea
              id="reminder-message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSend()}
              isLoading={isSaving}
              disabled={!message.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50"
            >
              <Icon name="phone" className="size-4" />
              Abrir no WhatsApp
            </Button>
          </div>
        </>
      )}
    </dialog>
  )
}
