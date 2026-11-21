import "server-only";

import {
  getStore,
  type Locale,
  type Party,
  type Role,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { loginToEmail, suggestLoginName } from "@/lib/auth/login-id";
import { createPortalLogin, suggestPassword } from "./portal-access";
import { loginRoleOfParty } from "./partner-types";

/*
 * Gerar o login do parceiro na própria tela onde ele faz falta (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Login do parceiro na Estratégia"):
 * na Estratégia de compra, o parceiro "Sem login ativo" ganha o acesso ali
 * mesmo, com login, nome, senha provisória e idioma sugeridos. O papel sai
 * do tipo do parceiro (a mesma regra do cadastro). Só o administrador
 * (gerar login é dele; docs/EQUIPE_ACESSOS.md, R5).
 */

export class PartnerLoginError extends Error {}

const isChina = (country: string | null | undefined) =>
  /^(cn|china|中国)$/i.test((country ?? "").trim());
const isBrazil = (country: string | null | undefined) =>
  /^(br|brasil|brazil)$/i.test((country ?? "").trim());

/** O idioma do login pelo país do parceiro: China em chinês, Brasil em português, os outros em inglês. */
export function localeForCountry(country: string | null | undefined): Locale {
  if (isChina(country)) return "zh";
  if (!(country ?? "").trim() || isBrazil(country)) return "pt";
  return "en";
}

/** O parceiro (não cliente) e o papel do login dele; só o administrador. */
async function partnerOf(
  viewer: User,
  partyId: string,
): Promise<{ party: Party; role: Role }> {
  if (!isAdmin(viewer)) throw new ForbiddenError();
  const party = await getStore().get("parties", partyId);
  if (!party || party.type === "customer")
    throw new PartnerLoginError("not_found");
  const role = await loginRoleOfParty(party);
  // Tipo criado no painel ainda sem classe de login (docs/PARTNER_TYPES.md).
  if (!role) throw new PartnerLoginError("user_role_mismatch");
  return { party, role: role as Role };
}

export interface PartnerLoginSuggestion {
  login: string;
  name: string;
  password: string;
  locale: Locale;
}

/**
 * O que o formulário já traz: o e-mail do cadastro, se ainda não é login de
 * ninguém, ou um nome de usuário pelo nome do parceiro (com um número no fim,
 * se já for de alguém); o contato ou o nome do parceiro; uma senha
 * provisória; e o idioma pelo país.
 */
export async function partnerLoginSuggestion(
  viewer: User,
  partyId: string,
): Promise<PartnerLoginSuggestion> {
  const { party } = await partnerOf(viewer, partyId);
  const users = await getStore().list("users");
  const taken = new Set(
    users.map((u) => (u.email ?? "").toLowerCase()).filter(Boolean),
  );
  const email = (party.email ?? "").trim().toLowerCase();
  const login =
    email && loginToEmail(email) === email && !taken.has(email)
      ? email
      : suggestLoginName(party.name, party.storeNumber, taken);
  return {
    login,
    name: party.contactName?.trim() || party.name,
    password: suggestPassword(),
    locale: localeForCountry(party.country),
  };
}

/**
 * Cria o login do parceiro (preso ao cadastro dele, com o papel do tipo e a
 * troca da senha no 1º acesso). Login já usado, inválido ou senha curta são
 * recusados com o motivo (as regras do `createPortalLogin`).
 */
export async function createPartnerLogin(
  viewer: User,
  partyId: string,
  input: { login: string; name: string; password: string; locale: Locale },
): Promise<User> {
  const { party, role } = await partnerOf(viewer, partyId);
  return createPortalLogin(viewer, {
    partyId: party.id,
    email: input.login.trim().toLowerCase(),
    name: input.name.trim(),
    role,
    locale: input.locale,
    password: input.password,
    mustChangePassword: true,
  });
}
