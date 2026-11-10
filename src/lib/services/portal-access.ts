import "server-only";

import {
  getStore,
  USER_EXTRA_DEFAULTS,
  type Locale,
  type Role,
  type User,
} from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Acesso ao portal (login) de um cadastro: fornecedor, cliente, agência…
 * O login nasce sempre preso a um cadastro (`partyId`), com o papel do tipo
 * do cadastro: quem entra vê só o que é daquele cadastro. Fornecedor que a
 * planilha do Booking cadastrou é um cadastro como os outros (Cadastros →
 * Fornecedores) e ganha o acesso aqui.
 */

/** Senha mínima: a mesma do login (o Appwrite recusa menos de 8). */
export const PORTAL_MIN_PASSWORD = 8;

const WELLMIX_ROLES: readonly Role[] = ["admin", "operator"];

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
  email: string;
  name: string;
  role: Role;
  locale: Locale;
  password: string;
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
  const email = input.email.trim().toLowerCase();
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
    `${email} (${input.role})${party ? ` · ${party.name}` : ""}`,
  );
  return created;
}
