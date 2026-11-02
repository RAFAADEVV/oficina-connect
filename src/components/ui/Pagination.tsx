import { Button } from './Button'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** "A mostrar 1–25 de 120" com botões Anterior / Seguinte. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  if (total <= pageSize) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const lastPage = Math.ceil(total / pageSize) - 1

  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-600">
      <p>
        {from}–{to} de {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          Seguinte
        </Button>
      </div>
    </div>
  )
}
