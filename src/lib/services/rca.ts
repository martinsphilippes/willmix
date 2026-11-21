import "server-only";
import { getStore, type Party, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/permissions";
import { canOpen, canOpenNewRequest } from "@/lib/auth/screens";
import { executeQuery } from "@/lib/integrations/sankhya-client";
import { setRawSetting } from "@/lib/settings";
import { audit } from "./audit";
import {
  SELLER_VIEW,
  sellerFromRow,
  type SellerViewRow,
} from "@/lib/integrations/sankhya-views";

/*
 * RCA do cliente (dono, 15/11/2026; docs/CUSTOMER_RCA.md). O RCA é o vendedor
 * do Sankhya (VW_AD_VENDEDOR_WELL desde 20/11/2026: COD_VENDEDOR e
 * NOME_VENDEDOR; a TGFVEN se a view falhar). O portal guarda uma cópia da lista
 * (trazida do Sankhya pelo botão no cadastro do cliente) e o vínculo no
 * cadastro do cliente pelo código do vendedor (`parties.rcaCode`). Cada cliente
 * já chega da carga com o vendedor de lá (`sankhyaRefs.CODVEND`); o Sankhya
 * manda: a carga sobrescreve o que for escolhido no portal.
 */

/** Chave da cópia da lista de vendedores do Sankhya em `settings`. */
export const RCA_LIST_KEY = "sankhyaSellers";
/** Código do Sankhya para "sem vendedor" (CODVEND 0). */
export const NO_RCA = "0";

export interface RcaSeller {
  code: string;
  name: string;
  active: boolean;
  /**
   * Código do vendedor como parceiro na empresa (TGFVEN.CODPARC; dono,
   * 16/11/2026): é o que a tela mostra ("CODPARC - APELIDO"). O CODVEND
   * (`code`) é interno do Sankhya. Ausente nas listas trazidas antes.
   */
  partnerCode?: string | null;
  /* Da VW_AD_VENDEDOR_WELL (20/11/2026); ausentes nas listas da TGFVEN. */
  type?: string | null;
  wellmixType?: string | null;
  email?: string | null;
  phone?: string | null;
  manager?: string | null;
  team?: string | null;
  region?: string | null;
  states?: string | null;
}

export interface RcaList {
  syncedAt: string | null;
  sellers: RcaSeller[];
  /** Lista de demonstração (seed do modo memória), não veio do Sankhya. */
  demo?: boolean;
}

export interface RcaView {
  /** CODVEND (interno do Sankhya; o vínculo do cliente). */
  code: string;
  /** Nome na lista do Sankhya; nulo = o código não está na lista. */
  name: string | null;
  active: boolean | null;
  /** CODPARC do vendedor (o código dele na empresa); nulo sem ele. */
  partnerCode: string | null;
}

export class RcaError extends Error {}

/** Só os números do código; vazio, "0" ou inválido = sem RCA (nulo). */
export function normalizeRcaCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d{1,10}$/.test(text)) return null;
  const code = text.replace(/^0+(?=\d)/, "");
  return code === NO_RCA ? null : code;
}

/**
 * Código do RCA do cliente: o gravado no portal (ou pela carga) em
 * `rcaCode`; sem nada gravado, o vendedor que veio do Sankhya.
 */
export function rcaCodeOf(
  party: Pick<Party, "type" | "rcaCode" | "sankhyaRefs"> | null | undefined,
): string | null {
  if (!party || party.type !== "customer") return null;
  if (party.rcaCode !== null && party.rcaCode !== undefined)
    return normalizeRcaCode(party.rcaCode);
  return normalizeRcaCode(party.sankhyaRefs?.CODVEND);
}

/** A cópia da lista de vendedores do Sankhya (vazia até trazer a primeira). */
export async function loadRcaList(): Promise<RcaList> {
  const [row] = await getStore().list("settings", {
    filter: { key: RCA_LIST_KEY },
    limit: 1,
  });
  const value = (row?.value ?? null) as Partial<RcaList> | null;
  const sellers = Array.isArray(value?.sellers)
    ? value.sellers
        .map((s) => ({
          ...sellerExtras(s as RcaSeller),
          code: normalizeRcaCode((s as RcaSeller).code) ?? "",
          name: String((s as RcaSeller).name ?? "").trim(),
          active: (s as RcaSeller).active !== false,
          partnerCode: normalizeRcaCode((s as RcaSeller).partnerCode),
        }))
        .filter((s) => s.code && s.name)
    : [];
  return {
    syncedAt: typeof value?.syncedAt === "string" ? value.syncedAt : null,
    sellers,
    demo: value?.demo === true,
  };
}

const EXTRA_KEYS = [
  "type",
  "wellmixType",
  "email",
  "phone",
  "manager",
  "team",
  "region",
  "states",
] as const;

/** Os campos a mais da view que estiverem preenchidos. */
function sellerExtras(s: Partial<RcaSeller>): Partial<RcaSeller> {
  const out: Partial<RcaSeller> = {};
  for (const k of EXTRA_KEYS) {
    const v = typeof s[k] === "string" ? s[k]!.trim().slice(0, 200) : "";
    if (v) out[k] = v;
  }
  return out;
}

/** O RCA de um código, com o nome da lista (ou sem nome, se não estiver). */
export function rcaView(code: string | null, list: RcaList): RcaView | null {
  if (!code) return null;
  const seller = list.sellers.find((s) => s.code === code);
  return {
    code,
    name: seller?.name ?? null,
    active: seller ? seller.active : null,
    partnerCode: seller?.partnerCode ?? null,
  };
}

/** Quem cuida do cadastro de clientes (a mesma regra de gravar o cadastro). */
const canEditCustomers = (user: User) =>
  isWellmix(user) && canOpen(user, "parties");

/**
 * Traz a lista de vendedores do Sankhya (TGFVEN, ativos e inativos) e guarda
 * a cópia. Precisa da integração do Sankhya configurada.
 */
export async function refreshRcaList(user: User): Promise<RcaList> {
  if (!canEditCustomers(user)) throw new ForbiddenError();
  return (await syncSellers(user)).list;
}

/** Lê os vendedores: a view do portal; se ela falhar, a TGFVEN. */
async function readSellers(): Promise<{
  sellers: SellerViewRow[];
  source: "view" | "table";
  missing: string[];
}> {
  try {
    const table = await executeQuery(
      `SELECT V.* FROM ${SELLER_VIEW} V ORDER BY V.COD_VENDEDOR`,
    );
    const columns = table.columns.length
      ? table.columns
      : Object.keys(table.rows[0] ?? {});
    return {
      sellers: table.rows.map(sellerFromRow).filter((s) => s != null),
      source: "view",
      missing: table.rows.length
        ? ["COD_VENDEDOR", "NOME_VENDEDOR", "ATIVO", "COD_PARCEIRO", "EMAIL"]
            .filter((c) => !columns.some((k) => k.toUpperCase() === c))
            .map((c) => `${SELLER_VIEW}.${c}`)
        : [],
    };
  } catch (error) {
    console.warn("[rca] view de vendedores falhou, lendo a TGFVEN", error);
  }
  const rows = (
    await executeQuery(
      "SELECT CODVEND, CODPARC, APELIDO, ATIVO FROM TGFVEN ORDER BY CODVEND",
    )
  ).rows;
  return {
    sellers: rows.map(sellerFromRow).filter((s) => s != null),
    source: "table",
    missing: [],
  };
}

/**
 * Traz a lista de vendedores do Sankhya (ativos e inativos), guarda a cópia
 * e liga cada vendedor ao login da equipe pelo e-mail (dono, 20/11/2026): só
 * o login da Wellmix sem código de vendedor, com um único vendedor de mesmo
 * e-mail e esse código ainda sem dono. Nunca troca o que o administrador
 * gravou. Sem permissão própria: quem chama confere (refreshRcaList, carga).
 */
export async function syncSellers(user: User): Promise<{
  list: RcaList;
  linkedUsers: number;
  source: "view" | "table";
  missing: string[];
}> {
  let read: Awaited<ReturnType<typeof readSellers>>;
  try {
    read = await readSellers();
  } catch (error) {
    console.error("[rca] lista do Sankhya", error);
    throw new RcaError("rca_sankhya");
  }
  const sellers: RcaSeller[] = read.sellers.map((s) => ({
    ...sellerExtras(s),
    code: s.code,
    name: s.name,
    active: s.active,
    partnerCode: s.partnerCode,
  }));
  const list: RcaList = { syncedAt: new Date().toISOString(), sellers };
  await setRawSetting(RCA_LIST_KEY, list);
  await audit(
    user,
    "rca.list",
    "settings",
    RCA_LIST_KEY,
    `Lista de RCAs trazida do Sankhya: ${sellers.length} vendedores`,
  );
  const linkedUsers = await linkSellersByEmail(user, sellers);
  return {
    list,
    linkedUsers,
    source: read.source,
    missing: read.source === "view" ? read.missing : [],
  };
}

/** Liga vendedor e login pelo e-mail (ver syncSellers). Devolve quantos. */
export async function linkSellersByEmail(
  user: User,
  sellers: RcaSeller[],
): Promise<number> {
  const byEmail = new Map<string, RcaSeller[]>();
  for (const s of sellers) {
    const email = s.email?.trim().toLowerCase();
    if (!email || !s.active) continue;
    byEmail.set(email, [...(byEmail.get(email) ?? []), s]);
  }
  if (!byEmail.size) return 0;
  const store = getStore();
  const team = (await store.list("users")).filter((u) => isWellmix(u));
  const taken = new Set(
    team.map((u) => u.sellerCode?.trim()).filter((c): c is string => !!c),
  );
  let linked = 0;
  for (const member of team) {
    if (member.active === false || member.sellerCode?.trim()) continue;
    const matches = byEmail.get(member.email.trim().toLowerCase()) ?? [];
    if (matches.length !== 1) continue;
    const code = matches[0].code;
    if (taken.has(code)) continue;
    await store.update("users", member.id, { sellerCode: code });
    taken.add(code);
    linked++;
    await audit(
      user,
      "team.seller_code",
      "user",
      member.id,
      `${member.name}: vendedor ${matches[0].name} (${code}) pelo e-mail, da lista do Sankhya`,
      { sellerCode: null },
      { sellerCode: code },
    );
  }
  return linked;
}

/** RCA do cliente para a Nova solicitação (Wellmix que abre Solicitações). */
export async function customerRca(
  user: User,
  customerId: string,
): Promise<RcaView | null> {
  // Telas de nova solicitação (Encomendas, TS e Venda), como a rota.
  if (!isWellmix(user) || !canOpenNewRequest(user)) throw new ForbiddenError();
  const party = await getStore().get("parties", customerId);
  if (!party || party.type !== "customer") return null;
  const view = rcaView(rcaCodeOf(party), await loadRcaList());
  // Sem o nome ou o CODPARC na cópia da lista (lista antiga ou vendedor
  // novo; dono, 16/11/2026): vêm direto do Sankhya (TGFVEN), só leitura;
  // sem o Sankhya, fica o que a lista tem.
  if (view && (!view.name || !view.partnerCode)) {
    const live = await sankhyaSeller(view.code);
    if (live)
      return {
        code: view.code,
        name: live.name,
        active: live.active,
        partnerCode: live.partnerCode,
      };
  }
  return view;
}

/** Um vendedor do Sankhya pelo código (TGFVEN); nulo sem ele ou sem o Sankhya. */
export async function sankhyaSeller(code: string): Promise<{
  name: string;
  active: boolean;
  partnerCode: string | null;
} | null> {
  const n = normalizeRcaCode(code);
  if (!n) return null;
  try {
    let rows: Array<Record<string, unknown>>;
    try {
      rows = (
        await executeQuery(
          `SELECT V.* FROM ${SELLER_VIEW} V WHERE V.COD_VENDEDOR = ${Number(n)}`,
        )
      ).rows;
    } catch {
      rows = (
        await executeQuery(
          `SELECT CODVEND, CODPARC, APELIDO, ATIVO FROM TGFVEN WHERE CODVEND = ${Number(n)}`,
        )
      ).rows;
    }
    const seller = rows[0] ? sellerFromRow(rows[0] as never) : null;
    if (!seller) return null;
    return {
      name: seller.name,
      active: seller.active,
      partnerCode: seller.partnerCode,
    };
  } catch (error) {
    console.error("[rca] vendedor do Sankhya", error);
    return null;
  }
}

/**
 * Grava o RCA do cliente pelo cadastro (nulo = sem RCA). Só cliente; quem
 * grava o cadastro de clientes. Devolve se mudou.
 */
export async function setCustomerRca(
  user: User,
  partyId: string,
  code: string | null,
): Promise<boolean> {
  if (!canEditCustomers(user)) throw new ForbiddenError();
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party) throw new RcaError("not_found");
  if (party.type !== "customer") throw new RcaError("rca_not_customer");
  const next = normalizeRcaCode(code);
  const before = rcaCodeOf(party);
  // O mesmo RCA de antes (gravado ou vindo do Sankhya): nada a gravar.
  if (next === before) return false;
  // "0" marca "sem RCA" (o código do Sankhya para sem vendedor), para não
  // voltar a valer o vendedor da carga antiga.
  await store.update("parties", partyId, { rcaCode: next ?? NO_RCA });
  const list = await loadRcaList();
  const label = (c: string | null) => {
    const view = rcaView(c, list);
    return view ? `${view.name ?? "Vendedor"} (${view.code})` : "sem RCA";
  };
  await audit(
    user,
    "party.rca",
    "party",
    partyId,
    `RCA do cliente: ${label(before)} → ${label(next)}`,
    { rcaCode: before },
    { rcaCode: next },
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Cliente sem RCA: vários RCAs até um fechar a venda (dono, 19/11/2026) */
/* ------------------------------------------------------------------ */

/** Dias em que o RCA que fechou a venda fica como padrão do cliente. */
export const RCA_LOCK_DAYS = 30;

/** O RCA que fechou a venda, enquanto vale (até `lockedUntil`). */
export function lockedRcaOf(
  party: Pick<Party, "rcaPortal"> | null | undefined,
  now = new Date(),
): { code: string; until: string } | null {
  const portal = party?.rcaPortal;
  const code = normalizeRcaCode(portal?.lockedCode);
  const until = portal?.lockedUntil;
  if (!code || !until || !(Date.parse(until) > now.getTime())) return null;
  return { code, until };
}

/** RCAs cadastrados pelos vendedores para o cliente (sem repetir). */
export function rcaCandidatesOf(
  party: Pick<Party, "rcaPortal"> | null | undefined,
): string[] {
  const list = Array.isArray(party?.rcaPortal?.candidates)
    ? party!.rcaPortal!.candidates
    : [];
  return [
    ...new Set(list.map(normalizeRcaCode).filter((c): c is string => !!c)),
  ];
}

/**
 * RCA que vale para o cliente agora: o do cadastro (Sankhya ou portal) ou,
 * sem ele, o que fechou a última venda (30 dias). Nulo = em aberto.
 */
export function effectiveRcaCode(
  party:
    | Pick<Party, "type" | "rcaCode" | "sankhyaRefs" | "rcaPortal">
    | null
    | undefined,
  now = new Date(),
): string | null {
  return rcaCodeOf(party) ?? lockedRcaOf(party, now)?.code ?? null;
}

/** Uma opção de RCA para a tela ("CODPARC - APELIDO"). */
export interface RcaOption {
  code: string;
  label: string;
  /** Nome e CODPARC do vendedor (buscador "Código - Item"; 21/11/2026). */
  name?: string;
  partnerCode?: string | null;
}

const optionOf = (s: RcaSeller): RcaOption => ({
  code: s.code,
  label: s.partnerCode ? `${s.partnerCode} - ${s.name}` : s.name,
  name: s.name,
  partnerCode: s.partnerCode ?? null,
});

/**
 * O que a Nova solicitação mostra no campo "RCA do cliente": o RCA fixo
 * (`rca`), o que prendeu a venda com a data (`locked`) ou, em aberto, os
 * cadastrados para o cliente e os demais vendedores ativos para escolher.
 */
export interface RcaFieldState {
  rca: RcaView | null;
  locked: { until: string } | null;
  open: { candidates: RcaOption[]; sellers: RcaOption[] } | null;
}

export async function customerRcaField(
  user: User,
  customerId: string,
): Promise<RcaFieldState> {
  const rca = await customerRca(user, customerId);
  if (rca) return { rca, locked: null, open: null };
  const party = await getStore().get("parties", customerId);
  if (!party || party.type !== "customer")
    return { rca: null, locked: null, open: null };
  const list = await loadRcaList();
  const locked = lockedRcaOf(party);
  if (locked) {
    const view = rcaView(locked.code, list);
    return {
      rca: view ?? {
        code: locked.code,
        name: null,
        active: null,
        partnerCode: null,
      },
      locked: { until: locked.until },
      open: null,
    };
  }
  const candidates = rcaCandidatesOf(party);
  const byCode = new Map(list.sellers.map((s) => [s.code, s]));
  return {
    rca: null,
    locked: null,
    open: {
      candidates: candidates.map((code) => {
        const s = byCode.get(code);
        return s ? optionOf(s) : { code, label: code };
      }),
      sellers: list.sellers
        .filter((s) => s.active && !candidates.includes(s.code))
        .map(optionOf)
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
  };
}

/**
 * RCA do pedido no envio da Nova solicitação: o do cliente quando ele tem
 * (o formulário não muda); o que prendeu a venda; ou, em aberto, o escolhido
 * pelo vendedor (um vendedor ativo da lista), que entra nos RCAs do cliente.
 * Sem escolha em aberto: nulo (sem RCA).
 */
export async function resolveRequestRca(
  user: User,
  customerId: string,
  chosen: string | null | undefined,
): Promise<NonNullable<import("@/lib/order-terms").OrderTerms["rca"]> | null> {
  const store = getStore();
  const party = await store.get("parties", customerId);
  if (!party || party.type !== "customer") return null;
  const fixed = rcaCodeOf(party);
  if (fixed) return { code: fixed, source: "customer" };
  const locked = lockedRcaOf(party);
  if (locked) return { code: locked.code, source: "locked" };
  const code = normalizeRcaCode(chosen);
  if (!code) return null;
  const seller = (await loadRcaList()).sellers.find((s) => s.code === code);
  if (!seller?.active) throw new RcaError("rca_invalid");
  const candidates = rcaCandidatesOf(party);
  if (!candidates.includes(code)) {
    await store.update("parties", party.id, {
      rcaPortal: {
        ...(party.rcaPortal ?? {}),
        candidates: [...candidates, code],
      },
    });
    await audit(
      user,
      "party.rca_candidate",
      "party",
      party.id,
      `RCA cadastrado para o cliente na Nova solicitação: ${seller.name} (${code})`,
      { candidates },
      { candidates: [...candidates, code] },
    );
  }
  return { code, source: "chosen" };
}

/**
 * O cliente confirmou o pedido: o RCA escolhido fecha a venda e fica como
 * padrão do cliente por 30 dias (`RCA_LOCK_DAYS`), enquanto o cliente não
 * tem RCA no cadastro. Devolve se prendeu.
 */
export async function lockRcaOnSale(
  user: User,
  request: { id: string; customerId: string; orderTerms?: unknown },
  now = new Date(),
): Promise<boolean> {
  const terms = request.orderTerms as
    import("@/lib/order-terms").OrderTerms | null | undefined;
  const rca = terms?.rca;
  // Venda fechada pelo RCA escolhido, ou de novo pelo que já estava preso
  // (renova os 30 dias).
  if (!rca || rca.source === "customer") return false;
  const store = getStore();
  const party = await store.get("parties", request.customerId);
  if (!party || party.type !== "customer" || rcaCodeOf(party)) return false;
  const until = new Date(
    now.getTime() + RCA_LOCK_DAYS * 86_400_000,
  ).toISOString();
  await store.update("parties", party.id, {
    rcaPortal: {
      candidates: rcaCandidatesOf(party),
      ...(party.rcaPortal ?? {}),
      lockedCode: rca.code,
      lockedUntil: until,
      lockedByRequestId: request.id,
    },
  });
  await audit(
    user,
    "party.rca_lock",
    "party",
    party.id,
    `RCA ${rca.code} fechou a venda (pedido confirmado pelo cliente): padrão do cliente por ${RCA_LOCK_DAYS} dias`,
    { rcaPortal: party.rcaPortal ?? null },
    { lockedCode: rca.code, lockedUntil: until },
  );
  return true;
}
