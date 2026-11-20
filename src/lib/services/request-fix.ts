import "server-only";

import { getStore, type User } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  loginLabel,
  loginToEmail,
  suggestLoginName,
} from "@/lib/auth/login-id";
import { readContacts, type ContactRole } from "@/lib/order-terms";
import type { FixDirectory, PeopleDirectory } from "@/lib/request-responsible";
import { audit } from "./audit";
import { createPortalLogin, suggestPassword } from "./portal-access";
import { canConfirmAs } from "./request-turns";
import { setRequester } from "./requests";

/*
 * Resolver a pendência de cadastro pelo balão "Quem pode agir" (dono,
 * 20/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 10). O cliente sem nenhum
 * login que confirme a venda ganha o acesso ali mesmo: o administrador
 * confere o login, o nome e a senha provisória sugeridos e cria; a encomenda
 * passa a ter quem confirma. Os outros avisos levam ao lugar que resolve
 * (escolher o login na encomenda, o acesso do parceiro, Funções e acessos).
 */

/** Login que pode agir agora: ativo e não suspenso. */
const canAct = (u: Pick<User, "active" | "loginSuspended">) =>
  u.active !== false && !u.loginSuspended;

/** De quem é o e-mail sugerido: quem confirma a compra vem primeiro. */
const SUGGESTION_ROLES: readonly ContactRole[] = [
  "buyer",
  "partner",
  "finance",
  "logistics",
];

/**
 * O que o botão de cada aviso precisa (só o que quem vê pode usar). A
 * sugestão de login é do cliente: o primeiro e-mail dos contatos (comprador,
 * sócio, financeiro e fiscal, logística) ou do cadastro que ainda não é
 * login de ninguém; sem e-mail, um nome de usuário pelo nome da empresa
 * (com um número no fim, se já for de alguém).
 */
export async function fixDirectory(
  viewer: User,
  input: {
    /** Todos os logins (as telas já os leem). */
    users: readonly User[];
    /** Os clientes das encomendas sem login que confirme. */
    customerIds: readonly string[];
    people: PeopleDirectory;
  },
): Promise<FixDirectory> {
  const admin = isAdmin(viewer);
  const customers = admin
    ? await listByIds(getStore(), "parties", [...new Set(input.customerIds)])
    : [];
  const byId = new Map(customers.map((c) => [c.id, c]));
  const taken = new Set(
    input.users.map((u) => (u.email ?? "").toLowerCase()).filter(Boolean),
  );
  const suggestions = new Map<
    string,
    ReturnType<FixDirectory["customerSuggestion"]>
  >();
  return {
    admin,
    wellmix: isWellmix(viewer),
    customerHasLogin: (customerId) =>
      input.users.some(
        (u) => u.role === "customer" && u.partyId === customerId && canAct(u),
      ),
    customerSuggestion: (customerId) => {
      const cached = suggestions.get(customerId);
      if (cached) return cached;
      const party = byId.get(customerId);
      const contacts = readContacts(party?.customerContacts);
      const emails = [
        ...SUGGESTION_ROLES.map((role) => contacts?.[role]?.email),
        party?.email,
      ]
        .map((e) => (e ?? "").trim().toLowerCase())
        .filter((e) => e && loginToEmail(e) === e && !taken.has(e));
      const customer = party?.name?.trim() || null;
      const name = customer ?? "Cliente";
      const out = {
        customer,
        login:
          emails[0] ??
          suggestLoginName(
            name,
            (party?.taxId ?? "").replace(/\D/g, "") || party?.storeNumber,
            taken,
          ),
        name,
        password: suggestPassword(),
      };
      suggestions.set(customerId, out);
      return out;
    },
    partner: (partyId) => input.people.partner(partyId),
  };
}

export class RequestFixError extends Error {}

/**
 * Cria o login do cliente pela encomenda (só o administrador): o acesso
 * nasce no cadastro do cliente, com senha provisória (troca no 1º acesso).
 * Encomenda do lote aguardando o cliente com um login com acesso que não
 * confirma mais (inativo ou de outro cliente) passa para o login novo. A
 * senha não fica gravada em lugar nenhum além da conta.
 */
export async function createCustomerLoginForRequest(
  user: User,
  requestId: string,
  input: { login: string; name: string; password: string },
): Promise<{ user: User; reassigned: number }> {
  if (!isAdmin(user)) throw new RequestFixError("forbidden");
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new RequestFixError("not_found");
  const party = await store.get("parties", request.customerId);
  if (!party || party.type !== "customer")
    throw new RequestFixError("not_found");
  const created = await createPortalLogin(user, {
    partyId: party.id,
    email: input.login.trim().toLowerCase(),
    name: input.name.trim(),
    role: "customer",
    locale: "pt",
    password: input.password,
    mustChangePassword: true,
  });
  const batch = request.groupId
    ? await store.list("requests", { filter: { groupId: request.groupId } })
    : [request];
  let reassigned = 0;
  for (const r of batch) {
    if (r.status !== "AWAITING_CUSTOMER" || !r.requestedForUserId) continue;
    const current = await store.get("users", r.requestedForUserId);
    if (current && canAct(current) && canConfirmAs(current, r)) continue;
    await setRequester(user, r.id, created.id);
    reassigned++;
  }
  await audit(
    user,
    "request.customer_login",
    "request",
    request.id,
    `Login do cliente criado pela encomenda nº ${request.number ?? "—"} (${party.name}): ${loginLabel(created.email)}${reassigned ? `; login com acesso em ${reassigned} encomenda(s)` : ""}`,
  );
  return { user: created, reassigned };
}
