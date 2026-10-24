import "server-only";

import {
  getStore,
  type Notification,
  type NotificationActor,
  type NotificationKind,
  type Role,
  type User,
} from "@/lib/db";
import type { NewRow } from "@/lib/db/store";
import { WELLMIX_ROLES } from "@/lib/auth/permissions";
import { isLocale, translator, type Translate } from "@/i18n";

export interface NotifyTarget {
  /** Usuários específicos. */
  userIds?: string[];
  /** Todos os usuários ativos de um papel (opcionalmente restritos a um parceiro). */
  role?: Role | Role[];
  partyId?: string | null;
}

/**
 * Avisos ao cliente sobre uma solicitação/pedido: só o login solicitante (outros
 * logins da mesma empresa não veem o pedido). Sem solicitante, ninguém do cliente.
 */
export function requesterTarget(
  userId: string | null | undefined,
): NotifyTarget {
  return { userIds: userId ? [userId] : [] };
}

export interface NotifyText {
  subject: string;
  body: string;
}

/**
 * Mensagem de um aviso. `kind` diz o que ele pede de quem recebe: "action"
 * (precisa de você), "alert" (atenção: atraso, problema, cancelamento),
 * "info" (novidade) ou "done" (algo concluído). `actor` diz com quem está o
 * assunto agora: "recipient" (quem recebe; padrão quando `kind` é "action"),
 * "wellmix", um papel parceiro ou null (nada a fazer). `text` monta assunto e
 * corpo no idioma de cada destinatário; `subject`/`body` fixos servem para os
 * avisos só da equipe Wellmix.
 */
export type NotifyMessage = {
  link?: string;
  kind?: NotificationKind;
  actor?: NotificationActor | null;
} & (
  | { subject: string; body: string; text?: undefined }
  | { text: (t: Translate) => NotifyText; subject?: undefined; body?: undefined }
);

/**
 * NotificationService. Canais: in-app (sempre), e-mail e WhatsApp.
 * E-mail e WhatsApp estão em modo mock: registram a notificação com status
 * "mock" para inspeção. Quando houver provedor, substituir sendEmail/sendWhatsapp.
 */
export async function notify(target: NotifyTarget, message: NotifyMessage) {
  const users = await resolveUsers(target);
  const kind = message.kind ?? "info";
  const actor =
    message.actor === undefined
      ? kind === "action"
        ? "recipient"
        : null
      : message.actor;
  for (const user of users) {
    const text = textFor(user, message);
    const row = {
      userId: user.id,
      partyId: user.partyId,
      role: user.role,
      subject: text.subject.slice(0, 200),
      body: text.body,
      link: message.link ?? null,
      readAt: null,
      kind,
      actor,
    };
    await createNotification({ ...row, channel: "inapp", status: "sent" });
    await createNotification({
      ...row,
      channel: "email",
      status: await sendEmail(user, text),
    });
    await createNotification({
      ...row,
      channel: "whatsapp",
      status: await sendWhatsapp(user, text),
    });
  }
  return users.length;
}

/** Texto no idioma do destinatário (preferência do cadastro; sem ela, pt). */
function textFor(user: User, message: NotifyMessage): NotifyText {
  if (message.text)
    return message.text(translator(isLocale(user.locale) ? user.locale : "pt"));
  return { subject: message.subject, body: message.body };
}

/**
 * Grava o aviso. Banco ainda sem as colunas `kind`/`actor` (esquema não
 * publicado): grava sem elas, para o aviso não derrubar a operação que o
 * gerou; até lá a tela infere o tipo pelo assunto.
 */
async function createNotification(row: NewRow<Notification>) {
  const store = getStore();
  try {
    return await store.create("notifications", row);
  } catch (error) {
    if (!isUnknownColumn(error)) throw error;
    if (process.env.NODE_ENV !== "test")
      console.warn(
        "[notifications] banco sem as colunas kind/actor: publique o esquema (npm run appwrite:push)",
      );
    const legacy: Record<string, unknown> = { ...row };
    delete legacy.kind;
    delete legacy.actor;
    return store.create(
      "notifications",
      legacy as unknown as NewRow<Notification>,
    );
  }
}

function isUnknownColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown attribute/i.test(message);
}

/** Atalho: avisa a equipe Wellmix (admin e operadores). */
export const notifyWellmix = (message: NotifyMessage) =>
  notify({ role: WELLMIX_ROLES }, message);

/** Papéis de empresas parceiras: só recebem com a empresa (partyId) definida. */
const PARTNER_ROLES: Role[] = [
  "customer",
  "supplier",
  "agency",
  "broker",
  "shipping_line",
  "carrier",
];

async function resolveUsers(target: NotifyTarget): Promise<User[]> {
  const store = getStore();
  const found = new Map<string, User>();
  if (target.userIds?.length) {
    for (const id of target.userIds) {
      const user = await store.get("users", id);
      if (user?.active) found.set(user.id, user);
    }
  }
  if (target.role) {
    let roles = Array.isArray(target.role) ? target.role : [target.role];
    // Parceiro sem empresa definida (ex.: pedido sem agência): ninguém de
    // fora recebe, em vez de todos os usuários daquele papel (isolamento).
    if ("partyId" in target && !target.partyId)
      roles = roles.filter((r) => !PARTNER_ROLES.includes(r));
    if (!roles.length) return [...found.values()];
    const filter: Record<string, unknown> = { role: roles, active: true };
    if (target.partyId) filter.partyId = target.partyId;
    const users = await store.list("users", { filter });
    for (const user of users) found.set(user.id, user);
  }
  return [...found.values()];
}

async function sendEmail(
  user: User,
  message: NotifyText,
): Promise<"sent" | "mock" | "failed"> {
  // EXTERNAL DEPENDENCY PENDING: provedor de e-mail (ex.: Resend). Sem chave, modo mock.
  if (process.env.NODE_ENV !== "test") {
    console.info(`[email:mock] para ${user.email}: ${message.subject}`);
  }
  return "mock";
}

async function sendWhatsapp(
  user: User,
  message: NotifyText,
): Promise<"sent" | "mock" | "failed"> {
  // EXTERNAL DEPENDENCY PENDING: WhatsApp Business API. Modo mock.
  void user;
  void message;
  return "mock";
}

/**
 * Abre um aviso da própria lista: marca como lido e devolve o link para
 * seguir (só caminhos do portal). Aviso de outra pessoa: null, nada muda.
 */
export async function openNotification(
  user: User,
  id: string,
): Promise<string | null> {
  const store = getStore();
  const row = await store.get("notifications", id);
  if (!row || row.userId !== user.id || row.channel !== "inapp") return null;
  if (!row.readAt)
    await store.update("notifications", id, {
      readAt: new Date().toISOString(),
    });
  return row.link && /^\/app(?:[/?#]|$)/.test(row.link) ? row.link : null;
}

/**
 * Exclui avisos da lista do portal (canal in-app) do próprio usuário: os de
 * `ids` ou, sem `ids`, todos. O filtro por userId garante o isolamento (id de
 * outra pessoa simplesmente não é encontrado). Os registros de e-mail e
 * WhatsApp do mesmo aviso ficam, como histórico do envio.
 */
export async function deleteInAppNotifications(
  user: User,
  ids?: string[],
): Promise<number> {
  if (ids && ids.length === 0) return 0;
  const store = getStore();
  const mine = await store.list("notifications", {
    filter: {
      userId: user.id,
      channel: "inapp",
      ...(ids ? { id: ids } : {}),
    },
  });
  // Em lotes, para "Excluir todas" com muitos avisos não estourar o tempo.
  for (let i = 0; i < mine.length; i += 20)
    await Promise.all(
      mine.slice(i, i + 20).map((n) => store.remove("notifications", n.id)),
    );
  if (mine.length) {
    const { audit } = await import("./audit");
    await audit(
      user,
      "notification.delete",
      "notification",
      ids?.length === 1 ? ids[0] : "inapp",
      `${mine.length} aviso(s) excluído(s) da lista`,
      null,
      { count: mine.length, all: !ids },
    );
  }
  return mine.length;
}
