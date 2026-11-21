import type { SupplierRequest, User } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";

/*
 * Quem fala na negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Tela da negociação reorganizada"): o nome e o login de quem mandou cada
 * passo, de quem respondeu e de quem recebe o aviso de cada mensagem.
 *
 * O destinatário segue a regra do aviso, que não mudou
 * (`notifyOther`, supplier-request-negotiation.ts): o que a Wellmix manda
 * avisa os logins ativos do fornecedor da solicitação; o que o fornecedor
 * manda avisa o responsável (quem abriu a solicitação).
 *
 * Privacidade (dono, 18/11/2026; docs/CHAT_IDENTITY.md, decisão 2): quem é de
 * fora vê só o login de quem já conversa com ele. Aqui, a Wellmix vê todos;
 * o fornecedor vê os logins da própria empresa e, da Wellmix, só o de quem
 * mandou algum passo que ele vê nesta solicitação e o do responsável, que
 * recebe o que ele manda. Ninguém mais da equipe aparece para ele.
 */

export interface NegotiationPerson {
  userId: string;
  name: string;
  /** Login (e-mail); nulo quando quem vê não pode vê-lo. */
  login: string | null;
  side: "wellmix" | "supplier";
  /** Login ativo (nem desativado nem suspenso). */
  active: boolean;
}

export interface NegotiationPeople {
  /** Autores dos passos, quem respondeu, o responsável e (Wellmix) quem decidiu, por id. */
  byId: Record<string, NegotiationPerson>;
  /** Responsável da solicitação: recebe o aviso do que o fornecedor manda. */
  owner: NegotiationPerson | null;
  /** Logins ativos do fornecedor: recebem o aviso do que a Wellmix manda. */
  supplierLogins: NegotiationPerson[];
  /** Quem está vendo: o remetente do que enviar. */
  me: NegotiationPerson;
}

const personOf = (u: User, showLogin: boolean): NegotiationPerson => ({
  userId: u.id,
  name: u.name,
  login: showLogin ? u.email : null,
  side: isWellmix(u) ? "wellmix" : "supplier",
  active: u.active !== false && !u.loginSuspended,
});

export async function negotiationPeople(
  viewer: User,
  request: SupplierRequest,
): Promise<NegotiationPeople> {
  const viewerIsWellmix = isWellmix(viewer);
  // "Continuar negociando" é decisão interna: o fornecedor não vê o passo,
  // e o autor dele não entra entre quem conversa com ele.
  const steps = (request.negotiation ?? []).filter(
    (e) => viewerIsWellmix || e.kind !== "keep",
  );
  const ids = [
    ...new Set(
      [
        ...steps.map((e) => e.byUserId),
        request.respondedByUserId,
        request.createdByUserId,
        // Quem decidiu: só para a Wellmix ("Decidida em … por …").
        viewerIsWellmix ? request.decidedByUserId : null,
      ].filter((id): id is string => !!id),
    ),
  ];
  const store = getStore();
  const [users, supplierUsers] = await Promise.all([
    ids.length
      ? store.list("users", { filter: { id: ids } })
      : Promise.resolve([] as User[]),
    // Os mesmos logins que o aviso alcança (role supplier, empresa da
    // solicitação, ativos).
    store.list("users", {
      filter: { role: "supplier", partyId: request.supplierId, active: true },
    }),
  ]);
  // Todos os que estão aqui conversam nesta solicitação (passos, resposta e
  // responsável): o login aparece para os dois lados.
  const byId: Record<string, NegotiationPerson> = {};
  for (const u of users) byId[u.id] = personOf(u, true);
  const supplierLogins = supplierUsers
    .filter((u) => !u.loginSuspended)
    .map((u) => personOf(u, true))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    byId,
    owner: byId[request.createdByUserId] ?? null,
    supplierLogins,
    me: byId[viewer.id] ?? personOf(viewer, true),
  };
}
