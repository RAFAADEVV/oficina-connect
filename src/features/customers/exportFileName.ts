/** Nome do ficheiro: "dados-maria-silva-2026-11-04.json" */
export function exportFileName(customerName: string, today = new Date()): string {
  const slug = customerName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `dados-${slug || 'cliente'}-${today.toISOString().slice(0, 10)}.json`
}
