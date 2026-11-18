import "server-only";

import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { isLoginName } from "@/lib/auth/login-id";
import { resolveProfile } from "@/lib/partner-access";
import { partnerTypeCatalog, partnerTypeName } from "@/lib/partner-types";
import {
  receivesQuote,
  recipientVerdict,
  type RecipientCheck,
} from "@/lib/purchase-recipients";
import type { Translate } from "@/i18n";
import { loadPartnerAccess } from "./partner-access";
import { listPartnerTypeRows } from "./partner-types";

/*
 * Conferência dos parceiros candidatos à cotação de compra (Estratégia de
 * Compra; dono, 18/11/2026): quem recebe e responde no portal e o que falta
 * a quem não pode. Nada é gravado: tudo é lido na hora.
 *
 * - Cadastro ativo e do tipo que cota (Fornecedor, Trading, Supplier, Factory).
 * - Tipo de parceiro ativo (o administrador pode desativar Trading etc.).
 * - Pelo menos um login ativo da empresa (o aviso e a resposta são no portal).
 * - A tela Cotação aberta no perfil de telas do tipo (Gestão de telas).
 * - Aviso (não impede): nenhum login com e-mail, o aviso fica só no portal.
 */

/** Perfil de telas dos logins do parceiro (o do Fornecedor ou o do tipo). */
const profileKeyOf = (type: string) =>
  type === "supplier" ? "role:supplier" : `type:${type}`;

export async function checkRecipients(
  partyIds: readonly string[],
  t: Translate,
): Promise<Map<string, RecipientCheck>> {
  const out = new Map<string, RecipientCheck>();
  const ids = [...new Set(partyIds.filter(Boolean))];
  if (!ids.length) return out;
  const store = getStore();
  const [parties, users, typeRows, access] = await Promise.all([
    listByIds(store, "parties", ids),
    store.list("users", {
      filter: { partyId: ids, role: "supplier", active: true },
    }),
    listPartnerTypeRows(),
    loadPartnerAccess(),
  ]);
  const catalog = partnerTypeCatalog(typeRows);
  for (const party of parties) {
    const entry = catalog.find((e) => e.builtin === party.type) ?? null;
    const logins = users.filter((u) => u.partyId === party.id);
    const quotesScreen = resolveProfile(
      access,
      profileKeyOf(party.type),
    ).screens.includes("quotes");
    const verdict = recipientVerdict({
      type: party.type,
      active: party.active,
      typeActive: entry ? entry.active : true,
      logins: logins.length,
      quotesScreen,
      loginsWithEmail: logins.filter((u) => !isLoginName(u.email)).length,
    });
    out.set(party.id, {
      partyId: party.id,
      name: party.name,
      type: party.type,
      typeLabel:
        entry && receivesQuote(party.type)
          ? partnerTypeName(entry, t.locale)
          : t(`party.${party.type}`),
      country: party.country,
      logins: logins.length,
      ...verdict,
    });
  }
  return out;
}
