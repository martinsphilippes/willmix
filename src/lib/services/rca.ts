import "server-only";
import { getStore, type Party, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { executeQuery } from "@/lib/integrations/sankhya-client";
import { setRawSetting } from "@/lib/settings";
import { audit } from "./audit";

/*
 * RCA do cliente (dono, 15/11/2026; docs/CUSTOMER_RCA.md). O RCA é o vendedor
 * do Sankhya (TGFVEN: CODVEND e APELIDO). O portal guarda uma cópia da lista
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
}

export interface RcaList {
  syncedAt: string | null;
  sellers: RcaSeller[];
  /** Lista de demonstração (seed do modo memória), não veio do Sankhya. */
  demo?: boolean;
}

export interface RcaView {
  code: string;
  /** Nome na lista do Sankhya; nulo = o código não está na lista. */
  name: string | null;
  active: boolean | null;
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
          code: normalizeRcaCode((s as RcaSeller).code) ?? "",
          name: String((s as RcaSeller).name ?? "").trim(),
          active: (s as RcaSeller).active !== false,
        }))
        .filter((s) => s.code && s.name)
    : [];
  return {
    syncedAt: typeof value?.syncedAt === "string" ? value.syncedAt : null,
    sellers,
    demo: value?.demo === true,
  };
}

/** O RCA de um código, com o nome da lista (ou sem nome, se não estiver). */
export function rcaView(code: string | null, list: RcaList): RcaView | null {
  if (!code) return null;
  const seller = list.sellers.find((s) => s.code === code);
  return {
    code,
    name: seller?.name ?? null,
    active: seller ? seller.active : null,
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
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (
      await executeQuery(
        "SELECT CODVEND, APELIDO, ATIVO FROM TGFVEN ORDER BY CODVEND",
      )
    ).rows;
  } catch (error) {
    console.error("[rca] lista do Sankhya", error);
    throw new RcaError("rca_sankhya");
  }
  const sellers: RcaSeller[] = rows
    .map((row) => ({
      code: normalizeRcaCode(row.CODVEND) ?? "",
      name: String(row.APELIDO ?? "").trim(),
      active:
        String(row.ATIVO ?? "S")
          .trim()
          .toUpperCase() !== "N",
    }))
    .filter((s) => s.code && s.name);
  const list: RcaList = { syncedAt: new Date().toISOString(), sellers };
  await setRawSetting(RCA_LIST_KEY, list);
  await audit(
    user,
    "rca.list",
    "settings",
    RCA_LIST_KEY,
    `Lista de RCAs trazida do Sankhya: ${sellers.length} vendedores`,
  );
  return list;
}

/** RCA do cliente para a Nova solicitação (Wellmix que abre Solicitações). */
export async function customerRca(
  user: User,
  customerId: string,
): Promise<RcaView | null> {
  if (!isWellmix(user) || !canOpen(user, "requests"))
    throw new ForbiddenError();
  const party = await getStore().get("parties", customerId);
  if (!party || party.type !== "customer") return null;
  return rcaView(rcaCodeOf(party), await loadRcaList());
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
