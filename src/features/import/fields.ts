/**
 * Campos que podem ser importados e os nomes de coluna habituais para cada um.
 * A deteção automática compara os cabeçalhos do ficheiro com estes nomes
 * (sem acentos, maiúsculas, espaços ou pontuação).
 */

export type ImportField =
  | 'full_name'
  | 'phone'
  | 'email'
  | 'nif'
  | 'address'
  | 'plate'
  | 'make'
  | 'model'
  | 'year'
  | 'mileage'
  | 'service_date'
  | 'service_description'
  | 'service_mileage'
  | 'next_service_date'

export interface FieldDefinition {
  field: ImportField
  label: string
  group: 'Cliente' | 'Veículo' | 'Serviço'
  required?: boolean
  synonyms: string[]
}

export const IMPORT_FIELDS: FieldDefinition[] = [
  { field: 'full_name', label: 'Nome', group: 'Cliente', required: true, synonyms: ['nome', 'cliente', 'nomecliente', 'nomedocliente', 'nomecompleto', 'name', 'customer'] },
  { field: 'phone', label: 'Telefone', group: 'Cliente', required: true, synonyms: ['telefone', 'telemovel', 'tlm', 'tlf', 'telef', 'tel', 'contacto', 'contactotelefonico', 'numerotelefone', 'phone', 'mobile'] },
  { field: 'email', label: 'Email', group: 'Cliente', synonyms: ['email', 'e-mail', 'mail', 'correioeletronico'] },
  { field: 'nif', label: 'NIF', group: 'Cliente', synonyms: ['nif', 'contribuinte', 'ncontribuinte', 'numerocontribuinte', 'nifcliente', 'vat'] },
  { field: 'address', label: 'Morada', group: 'Cliente', synonyms: ['morada', 'endereco', 'address', 'localidade'] },
  { field: 'plate', label: 'Matrícula', group: 'Veículo', synonyms: ['matricula', 'mat', 'plate', 'licenseplate'] },
  { field: 'make', label: 'Marca', group: 'Veículo', synonyms: ['marca', 'make', 'brand'] },
  { field: 'model', label: 'Modelo', group: 'Veículo', synonyms: ['modelo', 'model', 'versao'] },
  { field: 'year', label: 'Ano', group: 'Veículo', synonyms: ['ano', 'anomatricula', 'anodematricula', 'anoviatura', 'year'] },
  { field: 'mileage', label: 'Quilómetros (atuais)', group: 'Veículo', synonyms: ['km', 'kms', 'quilometros', 'quilometragem', 'kmatuais', 'mileage'] },
  { field: 'service_date', label: 'Data do serviço', group: 'Serviço', synonyms: ['data', 'dataservico', 'datadoservico', 'dataintervencao', 'datadaintervencao', 'datareparacao', 'date'] },
  { field: 'service_description', label: 'Serviço', group: 'Serviço', synonyms: ['servico', 'descricao', 'descricaoservico', 'trabalho', 'trabalhos', 'intervencao', 'tiposervico', 'tipodeservico', 'service'] },
  { field: 'service_mileage', label: 'Km no serviço', group: 'Serviço', synonyms: ['kmservico', 'kmdoservico', 'kmintervencao', 'kmnaintervencao', 'kmentrada'] },
  { field: 'next_service_date', label: 'Próxima revisão', group: 'Serviço', synonyms: ['proximarevisao', 'proxrevisao', 'datproximarevisao', 'dataproximarevisao', 'proximamanutencao', 'proximoservico'] },
]

/** Cabeçalhos do modelo de importação, pela ordem das colunas. */
export const TEMPLATE_HEADERS = [
  'Nome',
  'Telefone',
  'Email',
  'NIF',
  'Morada',
  'Matrícula',
  'Marca',
  'Modelo',
  'Ano',
  'Km',
  'Data do serviço',
  'Serviço',
  'Km do serviço',
  'Próxima revisão',
]

/** "Data do Serviço" → "datadoservico" */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°ª]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export type ColumnMapping = Partial<Record<ImportField, number>>

/**
 * Tenta adivinhar que coluna corresponde a cada campo.
 * Primeiro procura nomes exatos; depois nomes que começam pelo sinónimo.
 * Cada coluna só é usada uma vez.
 */
export function detectMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const used = new Set<number>()
  const mapping: ColumnMapping = {}

  for (const pass of ['exact', 'prefix'] as const) {
    for (const definition of IMPORT_FIELDS) {
      if (mapping[definition.field] !== undefined) continue
      const index = normalized.findIndex(
        (header, i) =>
          !used.has(i) &&
          header !== '' &&
          definition.synonyms.some((s) => {
            const synonym = normalizeHeader(s)
            return pass === 'exact' ? header === synonym : synonym.length >= 3 && header.startsWith(synonym)
          }),
      )
      if (index >= 0) {
        mapping[definition.field] = index
        used.add(index)
      }
    }
  }
  return mapping
}
