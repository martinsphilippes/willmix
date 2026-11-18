import type { ReactNode } from "react";
import type { ChatIdentity, ChatPerson } from "@/lib/services/messages";
import { cx } from "./ui";

/*
 * Quem envia e quem recebe em toda conversa do portal (dono, 18/11/2026;
 * docs/CHAT_IDENTITY.md): o cabeçalho "Enviando como" / "Destinatário",
 * o autor e o destinatário de cada mensagem e o "Enviando para" acima do
 * campo de envio. Mesmo componente no painel lateral e na tela de Mensagens
 * (sem estado: serve ao servidor e ao navegador). Os dados vêm do serviço
 * (sessão conferida no servidor); a conversa antiga mostra "Destinatário não
 * identificado no histórico". Nomes e logins longos quebram a linha em vez
 * de sumir.
 */

export interface ChatIdentityLabels {
  sendingAs: string;
  recipient: string;
  participants: string;
  /** "Login: {login}". */
  login: string;
  you: string;
  wellmix: string;
  inactive: string;
  sendingTo: string;
  to: string;
  unknownRecipient: string;
  /** "Conversa privada entre {a} e {b}." */
  private: string;
  readOnly: { legacy: string; observer: string; peer_inactive: string };
  choose: string;
  chooseHint: string;
  pickFirst: string;
  noPeers: string;
  existing: string;
  fresh: string;
  all: string;
  owner: string;
  legacy: string;
}

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

/** Empresa ou equipe da pessoa ("Wellmix", "Loja do João"…). */
export const orgOf = (p: ChatPerson, labels: ChatIdentityLabels) =>
  p.side === "wellmix" ? labels.wellmix : (p.org ?? "");

/** "Login: x@y.com · Empresa" (o login só quando a pessoa pode vê-lo). */
export function PersonSub({
  person,
  labels,
  className,
}: {
  person: ChatPerson;
  labels: ChatIdentityLabels;
  className?: string;
}) {
  const org = orgOf(person, labels);
  return (
    <span className={cx("block break-words text-xs", className)}>
      {person.login ? (
        <span className="break-all" data-chat-login>
          {fill(labels.login, { login: person.login })}
        </span>
      ) : null}
      {person.login && org ? " · " : null}
      {org ? <span data-chat-org>{org}</span> : null}
      {!person.active ? (
        <span className="ml-1 rounded bg-zinc-200 px-1 text-[10px] font-semibold uppercase text-zinc-600">
          {labels.inactive}
        </span>
      ) : null}
    </span>
  );
}

function Block({
  title,
  children,
  marker,
}: {
  title: string;
  children: ReactNode;
  marker: string;
}) {
  return (
    <div className="min-w-0" data-chat-identity-block={marker}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function PersonBlock({
  person,
  you,
  labels,
}: {
  person: ChatPerson;
  you?: boolean;
  labels: ChatIdentityLabels;
}) {
  return (
    <div className="mt-0.5 min-w-0 text-sm text-zinc-900">
      <span className="break-words font-semibold" data-chat-person-name>
        {person.name}
      </span>
      {you ? <span className="text-zinc-500"> · {labels.you}</span> : null}
      <PersonSub person={person} labels={labels} className="text-zinc-500" />
    </div>
  );
}

/**
 * Cabeçalho da conversa: "Enviando como" (quem vê) e "Destinatário" (a outra
 * pessoa); o administrador lendo vê os dois participantes; a conversa antiga
 * diz que é só leitura. `action`: o botão "Escolher conversa" (painel).
 */
export function ChatIdentityHeader({
  identity,
  labels,
  action,
  recipientFallback,
}: {
  identity: ChatIdentity;
  labels: ChatIdentityLabels;
  action?: ReactNode;
  /** No lugar do destinatário quando ainda não há conversa escolhida. */
  recipientFallback?: ReactNode;
}) {
  const [a, b] = identity.members;
  const notice =
    identity.readOnly === "legacy"
      ? labels.readOnly.legacy
      : identity.readOnly === "observer" && a && b
        ? fill(labels.readOnly.observer, { a: a.name, b: b.name })
        : identity.readOnly === "peer_inactive" && identity.peer
          ? fill(labels.readOnly.peer_inactive, { name: identity.peer.name })
          : null;
  return (
    <div
      className="space-y-2"
      data-chat-identity
      data-chat-mode={identity.mode}
    >
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {identity.readOnly === "observer" ? (
          <Block title={labels.participants} marker="participants">
            {identity.members.map((p) => (
              <PersonBlock key={p.userId} person={p} labels={labels} />
            ))}
          </Block>
        ) : (
          <>
            <Block title={labels.sendingAs} marker="me">
              <PersonBlock person={identity.me} you labels={labels} />
            </Block>
            <Block title={labels.recipient} marker="recipient">
              {identity.peer ? (
                <PersonBlock person={identity.peer} labels={labels} />
              ) : (
                (recipientFallback ?? (
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {labels.unknownRecipient}
                  </p>
                ))
              )}
            </Block>
          </>
        )}
      </div>
      {action ? <div>{action}</div> : null}
      {notice ? (
        <p
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800"
          data-chat-readonly={identity.readOnly ?? ""}
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Linha de cima de cada mensagem: autor (com "Você"), login e empresa ou
 * equipe, a data e hora; embaixo, para quem foi (ou "Destinatário não
 * identificado no histórico").
 */
export function ChatMessageMeta({
  author,
  recipients,
  mine,
  when,
  labels,
}: {
  author: ChatPerson;
  recipients: ChatPerson[] | null;
  mine: boolean;
  when: string;
  labels: ChatIdentityLabels;
}) {
  const muted = mine ? "text-white/80" : "text-zinc-500";
  const org = orgOf(author, labels);
  return (
    <div className={cx("mb-1 text-[11px] leading-snug", muted)} data-chat-meta>
      <div className="flex flex-wrap items-baseline gap-x-1">
        <span className="break-words font-semibold" data-chat-author>
          {author.name}
          {mine ? ` · ${labels.you}` : ""}
        </span>
        {org ? <span>· {org}</span> : null}
        <span className="tabular-nums">· {when}</span>
      </div>
      {author.login ? (
        <div className="break-all" data-chat-author-login>
          {fill(labels.login, { login: author.login })}
        </div>
      ) : null}
      <div className="break-words" data-chat-recipient>
        {labels.to}:{" "}
        {recipients?.length
          ? recipients
              .map((r) => (r.login ? `${r.name} (${r.login})` : r.name))
              .join(", ")
          : labels.unknownRecipient}
      </div>
    </div>
  );
}

/** "Enviando para" acima do campo de mensagem. */
export function ChatSendingTo({
  peer,
  labels,
}: {
  peer: ChatPerson | null;
  labels: ChatIdentityLabels;
}) {
  if (!peer) return null;
  const org = orgOf(peer, labels);
  return (
    <p
      className="mb-1.5 break-words text-xs text-zinc-600"
      data-chat-sending-to={peer.userId}
    >
      <span className="font-semibold uppercase tracking-wide text-zinc-500">
        {labels.sendingTo}
      </span>{" "}
      <span className="font-semibold text-zinc-900">{peer.name}</span>
      {peer.login ? (
        <span className="break-all">
          {" · "}
          {fill(labels.login, { login: peer.login })}
        </span>
      ) : null}
      {org ? ` · ${org}` : ""}
    </p>
  );
}
