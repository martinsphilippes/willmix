import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import {
  MESSAGE_MAX_LENGTH,
  PARTY_TYPES,
  type PartyType,
  type Role,
} from "@/lib/db/schema";
import {
  chatDirectory,
  getConversationView,
  listConversationsFor,
  topicLabel,
  type ConversationSummary,
  type ConversationView,
  type TopicSummary,
} from "@/lib/services/messages";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { ActionError } from "@/components/action-error";
import {
  Badge,
  Card,
  Empty,
  Field,
  PageHeader,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  MarkTopicRead,
  MessagesAutoRefresh,
} from "@/components/messages-live";
import {
  postMessageAction,
  startConversationAction,
} from "../actions/messages";

/*
 * Mensagens: chat da Wellmix com as empresas parceiras. Duas colunas no
 * computador (lista à esquerda, conversa à direita), uma embaixo da outra no
 * celular. Wellmix: lista de conversas (todas as empresas) e "Nova conversa";
 * quem é de fora: os assuntos da conversa da própria empresa. A conversa se
 * atualiza sozinha a cada 20 s e o assunto aberto é marcado como lido pela
 * tela (Server Action), não pela leitura da página.
 */

/** Ordem dos grupos na escolha da empresa. */
const PICKER_ORDER: PartyType[] = [
  "customer",
  "supplier",
  "shipping_line",
  "carrier",
  "agency",
  "broker",
  "legal",
];

function typeLabel(t: Translate, type: PartyType | Role | null) {
  return type && (PARTY_TYPES as readonly string[]).includes(type)
    ? t(`messages.type.${type as PartyType}`)
    : "";
}

function formatWhen(value: string | null | undefined, intl: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(intl, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const param = (v: string | string[] | undefined) =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null;

function UnreadPill({ n, t }: { n: number; t: Translate }) {
  if (n <= 0) return null;
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold leading-5 text-white"
      title={t("messages.unread", { n })}
      aria-label={t("messages.unread", { n })}
      data-unread={n}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default async function MessagesPage({
  searchParams,
}: PageProps<"/app/messages">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const sp = await searchParams;
  const { error, fields: invalidFields, at: errorToken } = sp;
  const wellmix = isWellmix(user);
  const conversations = await listConversationsFor(user);
  const selectedId = param(sp.c) ?? conversations[0]?.id ?? null;
  let view: ConversationView | null = null;
  if (selectedId) {
    try {
      view = await getConversationView(user, selectedId, param(sp.t));
    } catch (e) {
      if (e instanceof ForbiddenError) notFound();
      throw e;
    }
  }
  const directory = wellmix ? await chatDirectory(user) : null;
  const errorText = !error
    ? null
    : error === "invalid_input"
      ? t("messages.error.message_empty")
      : t(`messages.error.${error}` as DictionaryKey) !==
          `messages.error.${error}`
        ? t(`messages.error.${error}` as DictionaryKey)
        : fallbackError(t, String(error));
  const lastMessage = view?.messages[view.messages.length - 1];

  return (
    <>
      <MessagesAutoRefresh />
      {view && lastMessage && view.topic.unread > 0 ? (
        <MarkTopicRead
          conversationId={view.conversation.id}
          topicId={view.topic.id}
          lastMessageId={lastMessage.id}
        />
      ) : null}
      <PageHeader
        title={t("messages.title")}
        subtitle={
          wellmix
            ? t("messages.subtitle.wellmix")
            : t("messages.subtitle.external")
        }
      />
      <ActionError
        t={t}
        code={error}
        text={errorText}
        fields={invalidFields}
        token={errorToken}
      />
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {directory ? (
            <Card dense title={t("messages.new")}>
              <form
                action={startConversationAction}
                className="flex flex-wrap items-end gap-2"
                data-new-conversation
              >
                <div className="min-w-0 flex-1">
                  <Field label={t("messages.new.pick")}>
                    <Select name="target" required defaultValue="">
                      <option value="" disabled>
                        {t("messages.new.choose")}
                      </option>
                      {PICKER_ORDER.map((type) => {
                        const list = directory.parties.filter(
                          (p) => p.type === type,
                        );
                        return list.length ? (
                          <optgroup key={type} label={typeLabel(t, type)}>
                            {list.map((p) => (
                              <option key={p.id} value={`party:${p.id}`}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null;
                      })}
                      {directory.users.length ? (
                        <optgroup label={t("messages.new.noParty")}>
                          {directory.users.map((u) => (
                            <option key={u.id} value={`user:${u.id}`}>
                              {u.name}
                              {typeLabel(t, u.role)
                                ? ` · ${typeLabel(t, u.role)}`
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </Select>
                  </Field>
                </div>
                <SubmitButton variant="secondary">
                  {t("messages.new.open")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
          {wellmix ? (
            <ConversationList
              t={t}
              conversations={conversations}
              selectedId={view?.conversation.id ?? null}
            />
          ) : view ? (
            <Card dense title={t("messages.topics")}>
              <TopicLinks t={t} view={view} vertical />
            </Card>
          ) : null}
        </div>
        <div className="min-w-0">
          {view ? (
            <Thread t={t} view={view} wellmix={wellmix} />
          ) : (
            <Empty>
              {wellmix
                ? t("messages.empty.conversations")
                : t("messages.empty.select")}
            </Empty>
          )}
        </div>
      </div>
    </>
  );
}

function ConversationList({
  t,
  conversations,
  selectedId,
}: {
  t: Translate;
  conversations: ConversationSummary[];
  selectedId: string | null;
}) {
  return (
    <Card dense title={t("messages.conversations")}>
      {conversations.length ? (
        <ul className="-mx-1 space-y-0.5" data-conversations>
          {conversations.map((c) => {
            const current = c.id === selectedId;
            return (
              <li key={c.id}>
                <Link
                  href={`/app/messages?c=${c.id}`}
                  aria-current={current ? "page" : undefined}
                  data-conversation={c.id}
                  className={cx(
                    "block rounded-lg px-2 py-1.5 transition",
                    current ? "bg-brand-50" : "hover:bg-zinc-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cx(
                        "min-w-0 flex-1 truncate text-sm",
                        c.unread > 0 || current
                          ? "font-semibold text-zinc-900"
                          : "text-zinc-800",
                      )}
                    >
                      {c.name}
                    </span>
                    <UnreadPill n={c.unread} t={t} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    {typeLabel(t, c.type) ? (
                      <span className="shrink-0">{typeLabel(t, c.type)}</span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">
                      {c.lastMessagePreview ?? ""}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatWhen(c.lastMessageAt, t.intl)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>{t("messages.empty.conversations")}</Empty>
      )}
    </Card>
  );
}

/** Assuntos da conversa: abas (Wellmix, em cima da conversa) ou lista (quem é de fora). */
function TopicLinks({
  t,
  view,
  vertical,
}: {
  t: Translate;
  view: ConversationView;
  vertical?: boolean;
}) {
  const link = (topic: TopicSummary) => {
    const current = topic.id === view.topic.id;
    return (
      <Link
        key={topic.id}
        href={`/app/messages?c=${view.conversation.id}&t=${topic.id}`}
        aria-current={current ? "page" : undefined}
        data-topic={topic.kind}
        className={cx(
          "inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition",
          vertical ? "flex w-full" : "",
          current
            ? "bg-brand-600 font-semibold text-white"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{topicLabel(t, topic)}</span>
        {topic.unread > 0 ? (
          <span
            className={cx(
              "rounded-full px-1.5 text-[11px] font-bold leading-5",
              current ? "bg-white text-brand-700" : "bg-brand-600 text-white",
            )}
            aria-label={t("messages.unread", { n: topic.unread })}
            data-unread={topic.unread}
          >
            {topic.unread}
          </span>
        ) : null}
      </Link>
    );
  };
  return (
    <nav
      aria-label={t("messages.topics")}
      className={cx(vertical ? "space-y-1" : "flex flex-wrap gap-1.5")}
    >
      {view.topics.map(link)}
    </nav>
  );
}

function Thread({
  t,
  view,
  wellmix,
}: {
  t: Translate;
  view: ConversationView;
  wellmix: boolean;
}) {
  const type = typeLabel(t, view.conversation.type);
  return (
    <Card
      dense
      title={
        <span className="flex flex-wrap items-center gap-2">
          {wellmix ? view.conversation.name : t("messages.side.wellmix")}
          {wellmix && type ? <Badge>{type}</Badge> : null}
          <span className="text-sm font-normal text-zinc-500">
            · {topicLabel(t, view.topic)}
          </span>
        </span>
      }
    >
      {wellmix ? (
        <div className="mb-3">
          <TopicLinks t={t} view={view} />
        </div>
      ) : null}
      {/* Coluna invertida: a conversa abre já no fim (mensagens mais novas). */}
      <div
        className="flex max-h-[60vh] min-h-40 flex-col-reverse overflow-y-auto rounded-xl bg-zinc-50 p-2 sm:p-3"
        data-thread
      >
        {view.messages.length ? (
          <ol className="space-y-2">
            {view.messages.map((m) => (
              <li
                key={m.id}
                className={cx("flex", m.mine ? "justify-end" : "justify-start")}
                data-message={m.authorSide}
              >
                <div
                  className={cx(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.mine
                      ? "bg-brand-600 text-white"
                      : m.authorSide === "wellmix"
                        ? "border border-brand-200 bg-white text-zinc-900"
                        : "border border-zinc-200 bg-white text-zinc-900",
                  )}
                >
                  <div
                    className={cx(
                      "mb-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]",
                      m.mine ? "text-white/80" : "text-zinc-500",
                    )}
                  >
                    <span className="font-semibold">
                      {m.mine ? t("messages.you") : m.authorName}
                    </span>
                    <span>
                      ·{" "}
                      {m.authorSide === "wellmix"
                        ? t("messages.side.wellmix")
                        : view.conversation.name}
                    </span>
                    <span className="tabular-nums">
                      · {formatWhen(m.createdAt, t.intl)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">
            {t("messages.empty.thread")}
          </p>
        )}
      </div>
      <form action={postMessageAction} className="mt-3 space-y-2" data-composer>
        <input type="hidden" name="conversationId" value={view.conversation.id} />
        <input type="hidden" name="topicId" value={view.topic.id} />
        <Field
          label={t("messages.body.label")}
          hint={t("messages.body.hint", {
            max: MESSAGE_MAX_LENGTH.toLocaleString(t.intl),
          })}
        >
          <Textarea
            name="body"
            required
            rows={3}
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder={t("messages.body.placeholder")}
          />
        </Field>
        <div className="flex justify-end">
          <SubmitButton pendingText={t("messages.sending")}>
            {t("messages.send")}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
