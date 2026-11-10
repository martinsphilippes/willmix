import "server-only";
import {
  executeQuery,
  type SankhyaClientOptions,
  type SankhyaTable,
} from "./sankhya-client";

/*
 * Dicionário de dados do Sankhya Om, lido do próprio ERP (somente leitura):
 * - TDDTAB: tabelas (TGFPRO, TGFPAR, TGFCAB, TGFITE, AD_*...);
 * - TDDINS: instâncias/entidades de cada tabela (Produto, Parceiro,
 *   CabecalhoNota...), os nomes usados no loadRecords e no DatasetSP.save;
 * - TDDCAM: campos de cada tabela (nome, descrição, tipo);
 * - TDDLIG: ligações entre instâncias (de onde para onde), que viram os
 *   "path" das ligações no loadRecords.
 * Colunas de TDDINS e TDDLIG conferidas no ERP da Wellmix (docs/SANKHYA.md).
 * Inclui as tabelas e campos personalizados (AD_). Os termos vão no SQL só
 * depois de reduzidos a letras, números, "_" e espaço.
 */

/** Termo de busca seguro para o SQL (maiúsculas; sem aspas nem símbolos). */
export function sqlTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_ ]/g, "")
    .trim()
    .slice(0, 40);
}

/** Nome de tabela seguro (TGFPRO, AD_FREINT). */
export function tableName(value: string) {
  const name = value.toUpperCase().trim();
  return /^[A-Z][A-Z0-9_]{1,39}$/.test(name) ? name : null;
}

export function searchTablesSql(term: string) {
  const q = sqlTerm(term);
  const like = `'%${q}%'`;
  return [
    "SELECT T.NOMETAB, T.DESCRTAB, I.NOMEINSTANCIA, I.DESCRINSTANCIA",
    "FROM TDDTAB T LEFT JOIN TDDINS I ON I.NOMETAB = T.NOMETAB",
    q
      ? `WHERE UPPER(T.NOMETAB) LIKE ${like} OR UPPER(T.DESCRTAB) LIKE ${like} OR UPPER(I.NOMEINSTANCIA) LIKE ${like} OR UPPER(I.DESCRINSTANCIA) LIKE ${like}`
      : "",
    "ORDER BY T.NOMETAB, I.NOMEINSTANCIA",
  ]
    .filter(Boolean)
    .join(" ");
}

export function fieldsSql(table: string) {
  return `SELECT * FROM TDDCAM WHERE NOMETAB = '${table}' ORDER BY NOMECAMPO`;
}

export function instancesSql(table: string) {
  return `SELECT * FROM TDDINS WHERE NOMETAB = '${table}' ORDER BY NOMEINSTANCIA`;
}

export function linksSql(table: string) {
  return [
    "SELECT O.NOMETAB AS TABELA_ORIGEM, O.NOMEINSTANCIA AS ENTIDADE_ORIGEM,",
    "D.NOMETAB AS TABELA_DESTINO, D.NOMEINSTANCIA AS ENTIDADE_DESTINO, L.*",
    "FROM TDDLIG L",
    "JOIN TDDINS O ON O.NUINSTANCIA = L.NUINSTORIG",
    "JOIN TDDINS D ON D.NUINSTANCIA = L.NUINSTDEST",
    `WHERE O.NOMETAB = '${table}' OR D.NOMETAB = '${table}'`,
    "ORDER BY O.NOMETAB, D.NOMETAB",
  ].join(" ");
}

export async function searchTables(
  term: string,
  options?: SankhyaClientOptions,
): Promise<SankhyaTable> {
  return executeQuery(searchTablesSql(term), options);
}

export interface TableDescription {
  table: string;
  instances: SankhyaTable | { error: string };
  fields: SankhyaTable | { error: string };
  links: SankhyaTable | { error: string };
}

const settle = async (job: Promise<SankhyaTable>) =>
  job.catch((error: unknown) => ({
    error:
      (error as { detail?: string })?.detail ||
      (error instanceof Error ? error.message : String(error)),
  }));

/** Entidades, campos e ligações de uma tabela (cada parte falha sozinha). */
export async function describeTable(
  table: string,
  options?: SankhyaClientOptions,
): Promise<TableDescription | null> {
  const name = tableName(table);
  if (!name) return null;
  const [instances, fields, links] = await Promise.all([
    settle(executeQuery(instancesSql(name), options)),
    settle(executeQuery(fieldsSql(name), options)),
    settle(executeQuery(linksSql(name), options)),
  ]);
  return { table: name, instances, fields, links };
}
