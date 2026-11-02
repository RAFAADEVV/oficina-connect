import type { Cell } from './parseValues'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_ROWS = 5000

export interface SpreadsheetData {
  headers: string[]
  rows: Cell[][]
  /** Número da linha (no ficheiro) onde começam os dados */
  firstDataLine: number
}

export class ImportFileError extends Error {}

/**
 * Lê o texto de um CSV. Tenta UTF-8; se falhar (ficheiros gravados pelo Excel português),
 * usa Windows-1252 para não estragar acentos como "João" ou "Matrícula".
 */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/** Remove linhas vazias do início e separa o cabeçalho dos dados. */
export function splitHeader(allRows: Cell[][]): SpreadsheetData {
  const isEmpty = (row: Cell[]) => row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')
  const headerIndex = allRows.findIndex((row) => !isEmpty(row))
  if (headerIndex < 0) throw new ImportFileError('O ficheiro está vazio.')

  const headers = allRows[headerIndex].map((cell, i) => (cell === null || cell === undefined ? '' : String(cell).trim()) || `Coluna ${i + 1}`)
  const rows = allRows.slice(headerIndex + 1)
  // Remove linhas vazias no fim
  while (rows.length > 0 && isEmpty(rows[rows.length - 1])) rows.pop()

  if (rows.length === 0) throw new ImportFileError('O ficheiro só tem o cabeçalho, sem dados.')
  if (rows.length > MAX_ROWS) {
    throw new ImportFileError(`O ficheiro tem ${rows.length} linhas. O máximo por importação é ${MAX_ROWS}; divida-o em vários ficheiros.`)
  }
  return { headers, rows, firstDataLine: headerIndex + 2 }
}

/** Lê um ficheiro .xlsx, .csv ou .txt escolhido pelo utilizador. */
export async function readSpreadsheet(file: File): Promise<SpreadsheetData> {
  if (file.size > MAX_FILE_SIZE) throw new ImportFileError('O ficheiro é demasiado grande (máximo 10 MB).')

  const name = file.name.toLowerCase()

  if (name.endsWith('.xlsx')) {
    // Carregado só quando é preciso, para não tornar a app mais lenta
    const { readSheet } = await import('read-excel-file/browser')
    try {
      const data = await readSheet(file)
      return splitHeader(data as unknown as Cell[][])
    } catch (err) {
      if (err instanceof ImportFileError) throw err
      throw new ImportFileError('Não foi possível ler este ficheiro Excel. Confirme que não está protegido por password.')
    }
  }

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const Papa = (await import('papaparse')).default
    const text = decodeText(await file.arrayBuffer())
    const result = Papa.parse<string[]>(text, { skipEmptyLines: false, delimitersToGuess: [';', ',', '\t', '|'] })
    return splitHeader(result.data)
  }

  if (name.endsWith('.xls')) {
    throw new ImportFileError('Ficheiros .xls (Excel antigo) não são suportados. Abra-o no Excel e grave como .xlsx ou .csv.')
  }

  throw new ImportFileError('Formato não suportado. Use um ficheiro .xlsx ou .csv.')
}
