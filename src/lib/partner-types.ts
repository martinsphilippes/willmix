import { dictionaries } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import {
  LOCALES,
  type Locale,
  type PartnerType,
  type Party,
  type PartyType,
} from "@/lib/db/schema";
import { FEATURED_PARTY_TYPES, OTHER_PARTY_TYPES } from "@/lib/party-types";

/*
 * Catálogo de tipos de parceiro (docs/PARTNER_TYPES.md): os oito de fábrica
 * (agência, despachante...) mais os criados no painel. Regras puras, usadas
 * pela tela, pelo serviço, pela importação e pelos testes.
 *
 * No formulário e no filtro o tipo viaja como texto: o de fábrica é a própria
 * chave ("agency"); o criado no painel é "custom:<id da linha>".
 */

export const CUSTOM_PREFIX = "custom:";

export interface PartnerTypeEntry {
  /** Valor no formulário e no filtro. */
  value: string;
  /** Identificador estável. */
  key: string;
  /** Tipo de fábrica; nulo no criado no painel. */
  builtin: PartyType | null;
  /** Linha em `partner_types` (nula no tipo de fábrica sem alteração). */
  rowId: string | null;
  names: Record<Locale, string | null>;
  description: string | null;
  active: boolean;
  /**
   * Papel com que os usuários deste tipo entram no portal; nulo = cadastro
   * sem login. Os tipos antigos entram com o papel de sempre; os em destaque
   * e os criados no painel (com login) entram como o Fornecedor entra.
   */
  loginRole: string | null;
  /**
   * Perfil de telas (Gestão de telas): os tipos antigos usam o do papel
   * ("role:agency"); os novos têm o próprio ("type:trading").
   */
  profileKey: string | null;
}

/** Papel de login dos tipos novos: o do Fornecedor (as telas saem do perfil do tipo). */
export const PARTNER_LOGIN_ROLE = "supplier";

const customValue = (id: string) => `${CUSTOM_PREFIX}${id}`;

/** Os de fábrica (com o nome novo ou a inativação, se houver) e os criados. */
export function partnerTypeCatalog(rows: PartnerType[]): PartnerTypeEntry[] {
  const overrides = new Map(
    rows.filter((r) => r.builtin).map((r) => [r.builtin as string, r]),
  );
  const names = (r: PartnerType | undefined) => ({
    pt: r?.name || null,
    en: r?.nameEn || null,
    zh: r?.nameZh || null,
  });
  const builtins = OTHER_PARTY_TYPES.map((type): PartnerTypeEntry => {
    const row = overrides.get(type);
    return {
      value: type,
      key: type,
      builtin: type,
      rowId: row?.id ?? null,
      names: names(row),
      description: row?.description ?? null,
      active: row ? row.active : true,
      ...(FEATURED_PARTY_TYPES.includes(type)
        ? { loginRole: PARTNER_LOGIN_ROLE, profileKey: `type:${type}` }
        : { loginRole: type, profileKey: `role:${type}` }),
    };
  });
  const custom = rows
    .filter((r) => !r.builtin)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r): PartnerTypeEntry => ({
      value: customValue(r.id),
      key: r.key,
      builtin: null,
      rowId: r.id,
      names: names(r),
      description: r.description,
      active: r.active,
      loginRole: r.loginClass ? PARTNER_LOGIN_ROLE : null,
      profileKey: r.loginClass ? `type:${r.key}` : null,
    }));
  return [...builtins, ...custom];
}

/** Nome do tipo no idioma: o dado pelo administrador, senão o de fábrica. */
export function partnerTypeName(entry: PartnerTypeEntry, locale: Locale) {
  const own = entry.names[locale] ?? entry.names.pt;
  if (own) return own;
  return entry.builtin
    ? (dictionaries[locale] ?? dictionaries.pt)[`party.${entry.builtin}`]
    : entry.key;
}

/** Valor do tipo de um cadastro (para o formulário e o filtro). */
export const partyTypeValue = (p: Pick<Party, "type" | "partnerTypeId">) =>
  p.type === "partner" && p.partnerTypeId
    ? customValue(p.partnerTypeId)
    : p.type;

/** Nome do tipo de um cadastro; o tipo inativo ou apagado continua legível. */
export function partyTypeLabel(
  p: Pick<Party, "type" | "partnerTypeId">,
  catalog: PartnerTypeEntry[],
  t: Translate,
): string {
  const entry = catalog.find((e) => e.value === partyTypeValue(p));
  return entry ? partnerTypeName(entry, t.locale) : t(`party.${p.type}`);
}

/** Sem acento nem caixa, com espaços simples: para comparar nomes. */
export const foldTypeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, " ")
    .trim();

/** Identificador estável a partir do nome ("Empresa de Inspeção" → "empresa_de_inspecao"). */
export function partnerTypeKey(name: string, taken: readonly string[]) {
  const base = foldTypeText(name).replace(/ /g, "_").slice(0, 60) || "tipo";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`;
  return key;
}

/** Todos os nomes pelos quais um tipo pode ser chamado (chave e os três idiomas). */
function aliases(entry: PartnerTypeEntry): string[] {
  const out = [entry.key, ...LOCALES.map((l) => partnerTypeName(entry, l))];
  // O nome de fábrica continua valendo depois de renomear (planilhas antigas).
  if (entry.builtin)
    for (const l of LOCALES)
      out.push(dictionaries[l][`party.${entry.builtin}`]);
  return [...new Set(out.map(foldTypeText).filter(Boolean))];
}

export type TypeMatch =
  | { ok: true; entry: PartnerTypeEntry }
  | { ok: false; reason: "unknown" | "ambiguous" | "inactive" };

/**
 * Acha o tipo pelo texto de uma planilha: a chave legada ("agency") ou o
 * nome em qualquer idioma. Mais de um tipo com o mesmo nome é ambíguo; o
 * inativo não recebe cadastro novo.
 */
export function matchPartnerType(
  text: string,
  catalog: PartnerTypeEntry[],
): TypeMatch {
  const wanted = foldTypeText(text);
  if (!wanted) return { ok: false, reason: "unknown" };
  const byKey = catalog.filter((e) => foldTypeText(e.key) === wanted);
  const found = byKey.length
    ? byKey
    : catalog.filter((e) => aliases(e).includes(wanted));
  if (!found.length) return { ok: false, reason: "unknown" };
  const active = found.filter((e) => e.active);
  if (!active.length) return { ok: false, reason: "inactive" };
  if (active.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, entry: active[0] };
}

/** Nome já usado por outro tipo (em qualquer idioma)? */
export function partnerTypeNameTaken(
  name: string,
  catalog: PartnerTypeEntry[],
  exceptValue: string | null,
) {
  const wanted = foldTypeText(name);
  return catalog.some(
    (e) => e.value !== exceptValue && aliases(e).includes(wanted),
  );
}
