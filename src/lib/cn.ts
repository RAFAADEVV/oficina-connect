/**
 * Junta classes CSS, ignorando valores vazios.
 * Exemplo: cn('px-4', isActive && 'bg-brand-50') → 'px-4 bg-brand-50'
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
