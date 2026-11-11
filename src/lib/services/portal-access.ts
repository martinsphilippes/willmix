import "server-only";

import { randomInt } from "node:crypto";
import {
  getStore,
  USER_EXTRA_DEFAULTS,
  type Locale,
  type Role,
  type User,
} from "@/lib/db";
import { loginLabel, loginToEmail } from "@/lib/auth/login-id";
import { hashPassword } from "@/lib/auth/password";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Acesso ao portal (login) de um cadastro: fornecedor, cliente, agência…
 * O login nasce sempre preso a um cadastro (`partyId`), com o papel do tipo
 * do cadastro: quem entra vê só o que é daquele cadastro. Fornecedor que a
 * planilha do Booking cadastrou é um cadastro como os outros (Cadastros →
 * Fornecedores) e ganha o acesso aqui. Quem cria é a Wellmix: escolhe o
 * login (nome de usuário, sem precisar de e-mail, ou um e-mail) e a senha e
 * passa os dois à pessoa (src/lib/auth/login-id.ts).
 */

/** Senha mínima: a mesma do login (o Appwrite recusa menos de 8). */
export const PORTAL_MIN_PASSWORD = 8;

const WELLMIX_ROLES: readonly Role[] = ["admin", "operator"];

/** Letras e números que não se confundem ao ler (sem 0/o, 1/l/i). */
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Senha sugerida no formulário (aleatória); quem cria pode trocar. */
export function suggestPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < Math.max(length, PORTAL_MIN_PASSWORD); i++)
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/** Dos cadastros dados, os que não têm nenhum login ativo. */
export async function partiesWithoutLogin(
  partyIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(partyIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const users = await getStore().list("users", { filter: { partyId: ids } });
  const withLogin = new Set(
    users.filter((u) => u.active && u.partyId).map((u) => u.partyId as string),
  );
  return new Set(ids.filter((id) => !withLogin.has(id)));
}

export interface PortalLoginInput {
  partyId: string | null;
  /** Nome de usuário (login sem e-mail) ou e-mail. */
  email: string;
  name: string;
  role: Role;
  locale: Locale;
  password: string;
  /** Senha provisória: o login troca a senha no primeiro acesso. */
  mustChangePassword?: boolean;
}

/**
 * Cria o login. Papel de parceiro (tudo que não é da Wellmix) exige o
 * cadastro e o papel do tipo dele: não nasce login solto nem com papel de
 * outro tipo de empresa. Papel da Wellmix continua só para o administrador.
 * A permissão de tela (Cadastros) é conferida na Server Action.
 */
export async function createPortalLogin(
  actor: User,
  input: PortalLoginInput,
): Promise<User> {
  const store = getStore();
  // Nome de usuário ou e-mail: o endereço que identifica a conta.
  const email = loginToEmail(input.email);
  if (!email) throw new Error("user_login_invalid");
  if (input.password.length < PORTAL_MIN_PASSWORD)
    throw new Error("user_password_short");
  const wellmixRole = WELLMIX_ROLES.includes(input.role);
  if (wellmixRole && !isAdmin(actor)) throw new Error("forbidden");
  const party = input.partyId
    ? await store.get("parties", input.partyId)
    : null;
  if (input.partyId && !party) throw new Error("not_found");
  if (!wellmixRole) {
    if (!party) throw new Error("user_party_required");
    if (party.type !== input.role) throw new Error("user_role_mismatch");
  }
  const taken = await store.list("users", { filter: { email }, limit: 1 });
  if (taken.length) throw new Error("user_email_taken");

  // Conta de login no Appwrite primeiro; se a linha do portal não gravar, a
  // conta é desfeita (nada de conta sem cadastro).
  let accountId: string | null = null;
  if (store.mode === "appwrite") {
    const { createAdminClient } = await import("@/lib/appwrite/server");
    const { ID } = await import("node-appwrite");
    const { users } = createAdminClient();
    try {
      const account = await users.create({
        userId: ID.unique(),
        email,
        password: input.password,
        name: input.name,
      });
      accountId = account.$id;
    } catch (error) {
      const failure = error as { code?: unknown; type?: unknown };
      if (
        failure.code === 409 ||
        String(failure.type ?? "").includes("already_exists")
      )
        throw new Error("user_email_taken");
      throw error;
    }
  }
  let created: User;
  try {
    created = await store.create("users", {
      ...USER_EXTRA_DEFAULTS,
      email,
      name: input.name,
      role: input.role,
      partyId: party?.id ?? null,
      locale: input.locale,
      passwordHash:
        store.mode === "memory" ? hashPassword(input.password) : null,
      active: true,
      // Só grava a coluna quando pedida (esquema antigo não a conhece).
      ...(input.mustChangePassword ? { mustChangePassword: true } : {}),
    });
  } catch (error) {
    if (accountId) {
      const { createAdminClient } = await import("@/lib/appwrite/server");
      await createAdminClient()
        .users.delete({ userId: accountId })
        .catch((undo) =>
          console.error("[portal-access] conta sem cadastro", email, undo),
        );
    }
    throw error;
  }
  await audit(
    actor,
    "user.create",
    "user",
    created.id,
    `${loginLabel(email)} (${input.role})${party ? ` · ${party.name}` : ""}`,
  );
  return created;
}
