import "server-only";
import { getStore, type PartyType } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { searchText } from "@/lib/db/store";

/** Quantos parceiros a busca devolve por vez (o campo mostra os primeiros). */
export const PARTY_SEARCH_LIMIT = 20;

export interface PartyOption {
  id: string;
  name: string;
  /**
   * Código do parceiro no Sankhya e CNPJ/CPF (só números), para mostrar ao
   * lado do nome. Só vêm na busca com `identifiers` (Wellmix).
   */
  code?: string | null;
  taxId?: string | null;
  /** Tipo do parceiro (para dizer o tipo ao lado do nome na busca de vários tipos). */
  type?: PartyType;
}

/** Só os números do texto (CNPJ/CPF e código digitados com pontuação). */
export const digitsOf = (text: string) => text.replace(/\D/g, "");

/** O texto é um número, com a pontuação de CNPJ/CPF se houver? */
const looksNumeric = (text: string) => /^[\d.\-/\s]+$/.test(text.trim());

/**
 * Os mesmos números com a pontuação de CNPJ (14), CPF (11) ou da raiz do
 * CNPJ (8: "12.345.678"); outro tamanho, nulo.
 */
function punctuated(d: string): string | null {
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return null;
}

/**
 * CNPJ (14 dígitos) e CPF (11) com a pontuação de sempre; outro tamanho fica
 * como está. Na carga do Sankhya o documento está só com números; no
 * cadastro pelo portal, como foi digitado.
 */
export function formatTaxId(taxId: string | null | undefined): {
  kind: "cnpj" | "cpf" | "other";
  text: string;
} | null {
  const raw = (taxId ?? "").trim();
  if (!raw) return null;
  const d = digitsOf(raw);
  if (d.length === 14) return { kind: "cnpj", text: punctuated(d)! };
  if (d.length === 11) return { kind: "cpf", text: punctuated(d)! };
  return { kind: "other", text: raw };
}

/**
 * Parceiros de um tipo para os campos de cliente e fornecedor: com a carga do
 * Sankhya são ~26 mil clientes e ~5,7 mil fornecedores, que não cabem numa
 * lista de seleção.
 *
 * - Pelo nome: contém o texto (sem diferenciar caixa), em ordem alfabética.
 * - Com `identifiers` (Wellmix; dono, 15/11/2026), também pelo código do
 *   Sankhya (igual ao digitado) e pelo CNPJ/CPF (os números digitados, com ou
 *   sem pontuação: o documento inteiro ou a raiz do CNPJ, 8 dígitos, que traz
 *   as filiais). Primeiro o código, depois o documento, depois o nome, sem
 *   repetir. Quem é de fora busca só pelo nome e não vê o documento (o CPF é
 *   dado pessoal).
 */
export async function searchParties(input: {
  /** Um tipo ou vários (ex.: os da cotação de compra). */
  type: PartyType | readonly PartyType[];
  q: string;
  /** Ids que não entram (ex.: o "estoque" nas reservas). */
  exclude?: string[];
  /** Só os ativos. */
  activeOnly?: boolean;
  /** Também pelo código do Sankhya e pelo CNPJ/CPF (e os devolve). */
  identifiers?: boolean;
}): Promise<PartyOption[]> {
  const text = searchText(input.q).slice(0, 80);
  if (text.length < 2) return [];
  const exclude = new Set(input.exclude ?? []);
  const store = getStore();
  const types: PartyType[] = Array.isArray(input.type)
    ? [...(input.type as readonly PartyType[])]
    : [input.type as PartyType];
  const filter = {
    type: types.length === 1 ? types[0] : types,
    ...(input.activeOnly ? { active: true } : {}),
  };
  const limit = PARTY_SEARCH_LIMIT + exclude.size;
  const ids = !!input.identifiers;
  const columns = ids
    ? (["name", "active", "type", "sankhyaCode", "taxId"] as const)
    : (["name", "active", "type"] as const);
  const digits = digitsOf(input.q).slice(0, 20);
  const numeric = ids && looksNumeric(input.q) && digits.length >= 2;
  const none = Promise.resolve([]);
  // O documento só com números (carga do Sankhya) e com a pontuação (como
  // foi digitado no cadastro pelo portal).
  const taxPatterns =
    numeric && digits.length >= 8
      ? [
          ...new Set(
            [digits, punctuated(digits)].filter((x): x is string => !!x),
          ),
        ]
      : [];
  const [byCode, byTaxId, byName] = await Promise.all([
    // Código do parceiro no Sankhya (até 7 dígitos hoje): igual ao digitado.
    numeric && digits.length <= 10
      ? listColumns(store, "parties", columns, {
          filter: { ...filter, sankhyaCode: digits },
          limit,
        })
      : none,
    // CNPJ/CPF: a partir de 8 dígitos (a raiz do CNPJ), o documento contém.
    Promise.all(
      taxPatterns.map((pattern) =>
        listColumns(store, "parties", columns, {
          filter,
          search: { column: "taxId", text: pattern },
          orderBy: "name",
          limit,
        }),
      ),
    ).then((lists) => lists.flat()),
    listColumns(store, "parties", columns, {
      filter,
      search: { column: "name", text },
      orderBy: "name",
      limit,
    }),
  ]);
  const seen = new Set<string>();
  const options: PartyOption[] = [];
  for (const p of [...byCode, ...byTaxId, ...byName] as Array<{
    id: string;
    name: string;
    type?: PartyType;
    sankhyaCode?: string | null;
    taxId?: string | null;
  }>) {
    if (exclude.has(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    options.push(
      ids
        ? {
            id: p.id,
            name: p.name,
            code: p.sankhyaCode ?? null,
            taxId: p.taxId ?? null,
            ...(types.length > 1 && p.type ? { type: p.type } : {}),
          }
        : {
            id: p.id,
            name: p.name,
            ...(types.length > 1 && p.type ? { type: p.type } : {}),
          },
    );
    if (options.length >= PARTY_SEARCH_LIMIT) break;
  }
  return options;
}
