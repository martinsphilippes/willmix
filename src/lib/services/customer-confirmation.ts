import "server-only";
import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  type Request,
  type User,
} from "@/lib/db";
import { dataMode } from "@/lib/env";
import {
  cnpjDigits,
  formatCnpj,
  validCnpj,
  type CustomerConfirmation,
  type RedispatchCarrier,
} from "@/lib/order-terms";
import { audit } from "./audit";
import { notifyWellmix } from "./notifications";
import { releaseRequest } from "./requests";

/*
 * Confirmação do pedido pelo cliente (dono, 15/11/2026; docs/ORDER_TERMS.md
 * seção 4): o vendedor lança a venda e a solicitação nasce "Aguardando
 * confirmação do cliente". O login do cliente com acesso lê o aviso "sem
 * devoluções", marca "Li e concordo" e, com Re-despacho = Sim, informa o
 * CNPJ da transportadora: o portal busca os dados pelo CNPJ (BrasilAPI,
 * dados públicos da Receita) e cadastra a transportadora. Só então a
 * solicitação entra na fila da Wellmix.
 */

export class ConfirmationError extends Error {}

export interface CnpjData {
  cnpj: string;
  name: string;
  tradeName: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export type CnpjLookup =
  | { state: "found"; data: CnpjData }
  | { state: "not_found" }
  /** Sem a consulta (modo memória, rede fora do ar): digita o nome. */
  | { state: "manual" };

const TIMEOUT_MS = 8000;

const text = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null;

/** Dados públicos do CNPJ pela BrasilAPI (sem credencial). */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookup> {
  const digits = cnpjDigits(cnpj);
  if (!validCnpj(digits)) throw new ConfirmationError("cnpj_invalid");
  // Modo memória (desenvolvimento e testes): sem rede, o nome se digita.
  if (dataMode() === "memory") return { state: "manual" };
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 404) return { state: "not_found" };
    if (!res.ok) return { state: "manual" };
    const body = (await res.json()) as Record<string, unknown>;
    const name = text(body.razao_social);
    if (!name) return { state: "manual" };
    const street = [
      text(body.descricao_tipo_de_logradouro),
      text(body.logradouro),
    ]
      .filter(Boolean)
      .join(" ");
    const address = [
      street,
      text(body.numero),
      text(body.bairro),
      text(body.cep),
    ]
      .filter(Boolean)
      .join(", ");
    return {
      state: "found",
      data: {
        cnpj: digits,
        name,
        tradeName: text(body.nome_fantasia),
        city: text(body.municipio),
        state: text(body.uf),
        address: address || null,
        phone: text(body.ddd_telefone_1),
        email: text(body.email)?.toLowerCase() ?? null,
      },
    };
  } catch (error) {
    console.error("[confirmation] consulta do CNPJ", error);
    return { state: "manual" };
  }
}

/** As solicitações do mesmo lote (ou só ela). */
async function batchOf(request: Request): Promise<Request[]> {
  if (!request.groupId) return [request];
  return (
    await getStore().list("requests", { filter: { groupId: request.groupId } })
  ).filter((r) => r.status !== "CANCELLED");
}

/** Quem confirma: o login do cliente com acesso àquela solicitação. */
export function canConfirm(user: User, request: Request): boolean {
  return (
    user.role === "customer" &&
    request.status === "AWAITING_CUSTOMER" &&
    request.requestedForUserId === user.id &&
    !!request.orderTerms
  );
}

/**
 * Transportadora do re-despacho pelo CNPJ: a do cadastro (mesmo CNPJ) ou uma
 * nova, com os dados da Receita (ou o nome digitado, sem a consulta).
 */
async function carrierByCnpj(
  user: User,
  cnpj: string,
  typedName: string,
): Promise<RedispatchCarrier> {
  const store = getStore();
  const digits = cnpjDigits(cnpj);
  const existing = (
    await store.list("parties", {
      filter: { type: "carrier", taxId: [digits, formatCnpj(digits)] },
      limit: 1,
    })
  )[0];
  const lookup = await lookupCnpj(digits);
  if (lookup.state === "not_found")
    throw new ConfirmationError("cnpj_not_found");
  if (existing)
    return {
      cnpj: digits,
      name: existing.name,
      partyId: existing.id,
      source: lookup.state === "found" ? "brasilapi" : "manual",
    };
  const data = lookup.state === "found" ? lookup.data : null;
  const name = data?.name ?? typedName.trim().slice(0, 160);
  if (name.length < 2) throw new ConfirmationError("carrier_name_required");
  const party = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "carrier",
    name: (data?.tradeName || name).slice(0, 160),
    legalName: name.slice(0, 160),
    country: "BR",
    email: data?.email ?? null,
    phone: data?.phone ?? null,
    taxId: digits,
    notes: `Cadastrada pelo cliente na confirmação do pedido (re-despacho)${data ? ", dados da Receita pela BrasilAPI" : ", nome digitado (sem a consulta do CNPJ)"}.`,
    active: true,
    city: data?.city
      ? `${data.city}${data.state ? ` - ${data.state}` : ""}`
      : null,
    address: data?.address ?? null,
  } as never);
  await audit(
    user,
    "party.create",
    "party",
    party.id,
    `Transportadora do re-despacho cadastrada pelo cliente: ${party.name} (${formatCnpj(digits)})`,
  );
  return {
    cnpj: digits,
    name: party.name,
    partyId: party.id,
    source: data ? "brasilapi" : "manual",
  };
}

/**
 * O cliente confirma o pedido: aviso aceito e, com re-despacho, a
 * transportadora. Todas as solicitações do lote saem de "Aguardando
 * confirmação do cliente" e entram na fila da Wellmix.
 */
export async function confirmCustomerOrder(
  user: User,
  requestId: string,
  input: { accept: boolean; cnpj: string; carrierName: string },
): Promise<Request[]> {
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request || !canConfirm(user, request))
    throw new ConfirmationError("confirm_not_allowed");
  if (!input.accept) throw new ConfirmationError("confirm_accept_required");
  const terms = request.orderTerms!;
  const carrier = terms.redispatchRequired
    ? await carrierByCnpj(user, input.cnpj, input.carrierName)
    : null;
  if (terms.redispatchRequired && !carrier)
    throw new ConfirmationError("cnpj_required");
  const confirmation: CustomerConfirmation = {
    at: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    noReturnsAccepted: true,
    redispatchCarrier: carrier,
  };
  const batch = await batchOf(request);
  const released: Request[] = [];
  for (const r of batch) {
    if (r.status !== "AWAITING_CUSTOMER") continue;
    const updated = await store.update("requests", r.id, {
      status: "REQUESTED",
      orderTerms: { ...(r.orderTerms ?? terms), confirmation },
    });
    await audit(
      user,
      "request.customer_confirm",
      "request",
      r.id,
      `Pedido confirmado pelo cliente (aviso "sem devoluções" aceito${carrier ? `; re-despacho: ${carrier.name}, ${formatCnpj(carrier.cnpj)}` : ""})`,
      { status: "AWAITING_CUSTOMER" },
      { status: "REQUESTED" },
    );
    released.push(updated);
  }
  for (const r of released) await releaseRequest(user, r);
  if (carrier)
    await notifyWellmix({
      kind: "info",
      subject: `Re-despacho informado pelo cliente: ${carrier.name}`,
      body: `CNPJ ${formatCnpj(carrier.cnpj)}${carrier.source === "manual" ? " (nome digitado; confira o cadastro)" : ""}.`,
      link: `/app/parties/${carrier.partyId}`,
    });
  return released;
}
