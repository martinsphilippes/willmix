import "server-only";
import { assertRole, assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type PartnerType,
  type Party,
  type PartyType,
  type User,
} from "@/lib/db";
import { PARTY_TYPES } from "@/lib/db/schema";
import { OTHER_PARTY_TYPES } from "@/lib/party-types";
import {
  CUSTOM_PREFIX,
  PARTNER_LOGIN_ROLE,
  partyTypeValue,
  partnerTypeCatalog,
  partnerTypeKey,
  matchPartnerType,
  partnerTypeNameTaken,
  type PartnerTypeEntry,
} from "@/lib/partner-types";
import { audit } from "./audit";

/*
 * Tipos de parceiro administráveis (docs/PARTNER_TYPES.md). Quem lê: a
 * Wellmix com a tela Cadastros. Quem cria, renomeia ou inativa: o
 * administrador. Tudo fica na auditoria (antes e depois).
 */

/** Linhas do catálogo; antes de o esquema ser publicado, só os de fábrica. */
export async function listPartnerTypeRows(): Promise<PartnerType[]> {
  try {
    return await getStore().list("partner_types");
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

export async function getPartnerTypeCatalog(): Promise<PartnerTypeEntry[]> {
  return partnerTypeCatalog(await listPartnerTypeRows());
}

export interface PartnerTypeInput {
  /** Valor do tipo a alterar ("agency" ou "custom:<id>"); vazio = tipo novo. */
  value: string | null;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  description: string | null;
  active: boolean;
  /** Só nos criados no painel: os usuários deste tipo podem ter login? */
  allowLogin?: boolean;
}

const clip = (v: string | null, max: number) => {
  const text = (v ?? "").trim();
  return text ? text.slice(0, max) : null;
};

/** Cria um tipo, ou renomeia / inativa um existente (de fábrica ou criado). */
export async function savePartnerType(
  user: User,
  input: PartnerTypeInput,
): Promise<PartnerTypeEntry> {
  assertWellmix(user);
  assertScreen(user, "parties");
  assertRole(user, ["admin"]);
  const store = getStore();
  const rows = await store.list("partner_types");
  const catalog = partnerTypeCatalog(rows);
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120)
    throw new Error("partner_type_name_invalid");
  const current = input.value
    ? (catalog.find((e) => e.value === input.value) ?? null)
    : null;
  if (input.value && !current) throw new Error("not_found");
  for (const candidate of [name, input.nameEn, input.nameZh])
    if (
      candidate &&
      partnerTypeNameTaken(candidate, catalog, current?.value ?? null)
    )
      throw new Error("partner_type_name_taken");
  const data = {
    name,
    nameEn: clip(input.nameEn, 120),
    nameZh: clip(input.nameZh, 120),
    description: clip(input.description, 500),
    active: input.active,
    updatedByUserId: user.id,
    // Login: só nos tipos criados no painel (os de fábrica têm o seu papel).
    ...(current?.builtin || input.allowLogin === undefined
      ? {}
      : { loginClass: input.allowLogin ? PARTNER_LOGIN_ROLE : null }),
  };
  let row: PartnerType;
  const before = current?.rowId
    ? (rows.find((r) => r.id === current.rowId) ?? null)
    : null;
  if (before) {
    row = await store.update("partner_types", before.id, data);
  } else {
    row = await store.create("partner_types", {
      ...data,
      // De fábrica: a chave é o próprio tipo. Novo: sai do nome e não muda mais.
      key: current?.builtin
        ? current.builtin
        : partnerTypeKey(name, [
            ...rows.map((r) => r.key),
            ...(PARTY_TYPES as readonly string[]),
          ]),
      builtin: current?.builtin ?? null,
      createdByUserId: user.id,
    });
  }
  const pick = (r: PartnerType | null) =>
    r && {
      name: r.name,
      nameEn: r.nameEn,
      nameZh: r.nameZh,
      description: r.description,
      active: r.active,
      loginClass: r.loginClass ?? null,
    };
  await audit(
    user,
    current ? "partner_type.update" : "partner_type.create",
    "partner_type",
    row.id,
    `Tipo de parceiro ${current ? "alterado" : "criado"}: ${name}${row.active ? "" : " (inativo)"}`,
    pick(before),
    pick(row),
  );
  const entry = partnerTypeCatalog(await store.list("partner_types")).find(
    (e) => e.rowId === row.id,
  );
  if (!entry) throw new Error("unexpected");
  return entry;
}

/**
 * Tipo escolhido no formulário → o que vai no cadastro. Cliente e fornecedor
 * passam direto. Para atribuição nova o tipo tem de estar ativo; o cadastro
 * que já tinha um tipo inativo continua com ele.
 */
export async function resolvePartyType(
  value: string,
  current: Pick<Party, "type" | "partnerTypeId"> | null,
): Promise<{ type: PartyType; partnerTypeId: string | null }> {
  if (value === "customer" || value === "supplier")
    return { type: value, partnerTypeId: null };
  const catalog = await getPartnerTypeCatalog();
  const entry = catalog.find((e) => e.value === value);
  if (!entry) throw new Error("partner_type_invalid");
  const same =
    current &&
    (entry.builtin
      ? current.type === entry.builtin
      : current.type === "partner" && current.partnerTypeId === entry.rowId);
  if (!entry.active && !same) throw new Error("partner_type_inactive");
  if (entry.builtin) return { type: entry.builtin, partnerTypeId: null };
  return { type: "partner", partnerTypeId: entry.rowId };
}

/** Valor do formulário é de um tipo de "Outros parceiros"? (para o filtro da lista) */
export const isPartnerTypeValue = (value: string) =>
  value.startsWith(CUSTOM_PREFIX) ||
  (OTHER_PARTY_TYPES as readonly string[]).includes(value);

export type ImportedPartyType =
  | {
      ok: true;
      /** Valor do tipo ("agency", "supplier" ou "custom:<id>"). */
      value: string;
      party: { type: PartyType; partnerTypeId?: string };
    }
  | { ok: false; reason: "unknown" | "ambiguous" | "inactive" };

/**
 * Para a importação de parceiros (CSV): devolve a função que acha o tipo de
 * cada linha. Vale a chave legada (customer, supplier, agency...) e o nome em
 * qualquer idioma. Só cadastra o parceiro: nunca cria login nem acesso.
 */
export async function importPartyType(): Promise<
  (text: string) => ImportedPartyType
> {
  const catalog = await getPartnerTypeCatalog();
  return (text) => {
    const raw = text.trim().toLowerCase();
    if (raw === "customer" || raw === "supplier")
      return { ok: true, value: raw, party: { type: raw } };
    // O valor exato ("custom:<id>") vale: a prévia já o resolveu.
    const exact = catalog.find((e) => e.value === text.trim());
    const match = exact
      ? exact.active
        ? ({ ok: true, entry: exact } as const)
        : ({ ok: false, reason: "inactive" } as const)
      : matchPartnerType(text, catalog);
    if (!match.ok) return match;
    const { entry } = match;
    return {
      ok: true,
      value: entry.value,
      party: entry.builtin
        ? { type: entry.builtin }
        : { type: "partner", partnerTypeId: entry.rowId as string },
    };
  };
}

/**
 * Papel com que os usuários de um cadastro entram: o do tipo. Nulo = o tipo
 * (criado no painel) não tem login.
 */
export async function loginRoleOfParty(
  party: Pick<Party, "type" | "partnerTypeId">,
): Promise<string | null> {
  if (party.type === "customer" || party.type === "supplier") return party.type;
  const entry = (await getPartnerTypeCatalog()).find(
    (e) => e.value === partyTypeValue(party),
  );
  return entry?.loginRole ?? null;
}
