import { useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, Button, Card, Icon, PageHeader, Spinner } from '../../components/ui'
import { getErrorMessage } from '../../features/auth/authErrors'
import { buildImport, type ImportPlan } from '../../features/import/buildImport'
import { detectMapping, IMPORT_FIELDS, TEMPLATE_HEADERS, type ColumnMapping, type ImportField } from '../../features/import/fields'
import { downloadTemplate, listImports, logImport, runImport, type ImportTotals } from '../../features/import/importApi'
import { cellToText } from '../../features/import/parseValues'
import { ImportFileError, MAX_ROWS, readSpreadsheet, type SpreadsheetData } from '../../features/import/readFile'
import { useOrganization } from '../../features/organization/useOrganization'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { usePageTitle } from '../../lib/usePageTitle'

type Step = 'file' | 'map' | 'review' | 'running' | 'done'

const STEPS: { id: Step; label: string }[] = [
  { id: 'file', label: 'Ficheiro' },
  { id: 'map', label: 'Colunas' },
  { id: 'review', label: 'Verificar' },
  { id: 'done', label: 'Concluído' },
]

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === (current === 'running' ? 'review' : current))
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm">
      {STEPS.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
              index < currentIndex && 'bg-brand-600 text-white',
              index === currentIndex && 'bg-brand-50 text-brand-700 ring-2 ring-brand-600',
              index > currentIndex && 'bg-slate-100 text-slate-500',
            )}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            {index + 1}
          </span>
          <span className={cn('hidden sm:inline', index === currentIndex ? 'font-medium text-slate-900' : 'text-slate-500')}>
            {step.label}
          </span>
          {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300 sm:w-10" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

function StatBox({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' }) {
  return (
    <div className={cn('rounded-lg border p-4', tone === 'warning' && value > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

export function ImportarPage() {
  usePageTitle('Importar ficheiro')
  const navigate = useNavigate()
  const { organization } = useOrganization()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('file')
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<SpreadsheetData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [isReading, setIsReading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [totals, setTotals] = useState<ImportTotals | null>(null)

  const orgId = organization?.id ?? null
  const history = useAsyncData(orgId && step === 'file' ? `importacoes:${orgId}` : null, () => listImports(orgId!))

  const plan: ImportPlan | null = useMemo(
    () => (sheet && step !== 'file' && step !== 'map' ? buildImport(sheet.rows, mapping, sheet.firstDataLine) : null),
    [sheet, mapping, step],
  )

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setIsReading(true)
    try {
      const data = await readSpreadsheet(file)
      setFileName(file.name)
      setSheet(data)
      setMapping(detectMapping(data.headers))
      setStep('map')
    } catch (err) {
      setError(err instanceof ImportFileError ? err.message : 'Não foi possível ler o ficheiro.')
    } finally {
      setIsReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  function setColumn(field: ImportField, value: string) {
    setMapping((current) => {
      const next = { ...current }
      if (value === '') {
        delete next[field]
      } else {
        const column = Number(value)
        // Uma coluna só pode estar ligada a um campo
        for (const key of Object.keys(next) as ImportField[]) if (next[key] === column) delete next[key]
        next[field] = column
      }
      return next
    })
  }

  async function startImport() {
    if (!plan || !organization) return
    setError(null)
    setStep('running')
    setProgress({ done: 0, total: plan.rows.length })
    try {
      const result = await runImport(organization.id, plan.rows, (done, total) => setProgress({ done, total }))
      setTotals(result)
      await logImport(organization.id, {
        file_name: fileName.slice(0, 255),
        rows_total: plan.rows.length + plan.skipped,
        rows_skipped: plan.skipped,
        customers_created: result.customers_created,
        vehicles_created: result.vehicles_created,
        services_created: result.services_created,
      }).catch(() => undefined) // o registo é secundário; não falha a importação por causa dele
      setStep('done')
    } catch (err) {
      setError(`${getErrorMessage(err)} Os lotes já gravados ficam guardados; pode repetir a importação com o mesmo ficheiro sem criar duplicados.`)
      setStep('review')
    }
  }

  function reset() {
    setStep('file')
    setSheet(null)
    setMapping({})
    setFileName('')
    setTotals(null)
    setError(null)
  }

  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && mapping[f.field] === undefined)
  const sampleRow = sheet?.rows.find((row) => row.some((cell) => cellToText(cell) !== ''))

  return (
    <>
      <Link to="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="arrowLeft" className="size-4" />
        Clientes
      </Link>
      <PageHeader title="Importar ficheiro" />
      <Stepper current={step} />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Passo 1 — Ficheiro */}
      {step === 'file' && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <label
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
                isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50',
              )}
            >
              {isReading ? (
                <Spinner className="size-7 text-brand-600" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name="upload" className="size-6" />
                </span>
              )}
              <span className="mt-4 text-sm font-medium text-slate-900">
                {isReading ? 'A ler o ficheiro…' : 'Escolher ficheiro ou arrastar para aqui'}
              </span>
              <span className="mt-1 text-xs text-slate-500">Excel (.xlsx) ou CSV · até {MAX_ROWS} linhas</span>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept=".xlsx,.csv,.txt"
                className="sr-only"
                disabled={isReading}
                onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFile(e.target.files?.[0])}
              />
            </label>
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>Não tem um ficheiro? Use o nosso modelo.</span>
              <Button variant="secondary" size="sm" onClick={() => downloadTemplate(TEMPLATE_HEADERS)}>
                Descarregar modelo
              </Button>
            </div>
          </Card>

          <Card title="Últimas importações">
            {history.isLoading && <Spinner className="size-5 text-slate-400" />}
            {history.data && history.data.length === 0 && <p className="text-sm text-slate-500">Ainda não foram feitas importações.</p>}
            <ul className="-my-2 divide-y divide-slate-100">
              {history.data?.map((entry) => (
                <li key={entry.id} className="py-2.5 text-sm">
                  <p className="truncate font-medium text-slate-900">{entry.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(entry.created_at)} · {entry.customers_created} clientes · {entry.vehicles_created} veículos ·{' '}
                    {entry.services_created} serviços
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Passo 2 — Colunas */}
      {step === 'map' && sheet && (
        <Card title={fileName} description={`${sheet.rows.length} linhas encontradas`}>
          <p className="mb-4 text-sm text-slate-600">Indique que coluna do ficheiro corresponde a cada dado.</p>
          <div className="space-y-6">
            {(['Cliente', 'Veículo', 'Serviço'] as const).map((group) => (
              <fieldset key={group}>
                <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{group}</legend>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {IMPORT_FIELDS.filter((f) => f.group === group).map((definition) => {
                    const column = mapping[definition.field]
                    const rawSample = column !== undefined && sampleRow ? sampleRow[column] : null
                    const sample = rawSample instanceof Date ? formatDate(cellToText(rawSample)) : cellToText(rawSample)
                    return (
                      <div key={definition.field} className="grid items-center gap-2 px-4 py-2.5 sm:grid-cols-[10rem_1fr_1fr] sm:gap-4">
                        <label htmlFor={`col-${definition.field}`} className="text-sm font-medium text-slate-700">
                          {definition.label}
                          {definition.required && <span className="text-red-600"> *</span>}
                        </label>
                        <select
                          id={`col-${definition.field}`}
                          value={column ?? ''}
                          onChange={(e) => setColumn(definition.field, e.target.value)}
                          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                        >
                          <option value="">— Não importar —</option>
                          {sheet.headers.map((header, index) => (
                            <option key={index} value={index}>
                              {header}
                            </option>
                          ))}
                        </select>
                        <span className="truncate text-xs text-slate-500" title={sample}>
                          {sample ? `Ex.: ${sample}` : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          {missingRequired.length > 0 && (
            <Alert variant="info" className="mt-5">
              Falta indicar: {missingRequired.map((f) => f.label).join(', ')}.
            </Alert>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={reset}>
              Escolher outro ficheiro
            </Button>
            <Button onClick={() => setStep('review')} disabled={missingRequired.length > 0}>
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {/* Passo 3 — Verificar */}
      {(step === 'review' || step === 'running') && plan && (
        <Card title="Verificar antes de importar" description={fileName}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBox label="Clientes" value={plan.distinctCustomers} />
            <StatBox label="Veículos" value={plan.distinctVehicles} />
            <StatBox label="Serviços" value={plan.services} />
            <StatBox label="Linhas ignoradas" value={plan.skipped} tone="warning" />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Clientes com o mesmo telefone e veículos com a mesma matrícula que já existam não são duplicados.
          </p>

          {plan.issues.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Problemas encontrados ({plan.issues.length})
              </h3>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                {[...plan.issues]
                  .sort((a, b) => (a.level === b.level ? a.line - b.line : a.level === 'error' ? -1 : 1))
                  .slice(0, 200)
                  .map((issue, index) => (
                    <li key={index} className="flex gap-3 px-4 py-2">
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                          issue.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        Linha {issue.line}
                      </span>
                      <span className="text-slate-700">{issue.message}</span>
                    </li>
                  ))}
              </ul>
              {plan.issues.length > 200 && (
                <p className="mt-1 text-xs text-slate-500">A mostrar os primeiros 200 problemas.</p>
              )}
            </div>
          )}

          {step === 'running' && (
            <div className="mt-6" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                A importar… {progress.done} de {progress.total} linhas
              </p>
            </div>
          )}

          {step === 'review' && (
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setStep('map')}>
                Voltar
              </Button>
              <Button onClick={() => void startImport()} disabled={plan.rows.length === 0}>
                Importar {plan.rows.length} {plan.rows.length === 1 ? 'linha' : 'linhas'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Passo 4 — Concluído */}
      {step === 'done' && totals && (
        <Card>
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon name="check" className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Importação concluída</h2>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatBox label="Clientes novos" value={totals.customers_created} />
            <StatBox label="Veículos novos" value={totals.vehicles_created} />
            <StatBox label="Serviços novos" value={totals.services_created} />
          </div>
          {totals.customers_reused + totals.vehicles_reused + totals.services_skipped > 0 && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Registos que já existiam foram reutilizados e não foram duplicados.
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button variant="secondary" onClick={reset}>
              Importar outro ficheiro
            </Button>
            <Button onClick={() => navigate('/clientes')}>Ver clientes</Button>
          </div>
        </Card>
      )}
    </>
  )
}
