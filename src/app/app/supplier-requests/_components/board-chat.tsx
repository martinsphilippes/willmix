import type { Translate } from "@/i18n";
import type {
  QuoteNegotiationEvent,
  SupplierRequest,
  User,
} from "@/lib/db/schema";
import { canPostMessage } from "@/lib/supplier-requests";
import { negotiationPeople } from "@/lib/services/supplier-request-people";
import { ActionForm } from "@/components/action-form";
import { cx } from "@/components/ui";
import { postQuoteMessageStateAction } from "../../actions/quotation";
import {
  NegotiationConversation,
  type ConversationMessage,
} from "./negotiation-conversation";
import { recipientText } from "./negotiation-sections";
import { dateTime } from "./negotiation";
import { ChatComposer } from "./chat-composer";

/*
 * Conversa do par fornecedor × produto no quadro comparativo (dono,
 * 22/11/2026; docs/QUOTATION.md), dentro de um modal. Numa solicitação ao
 * fornecedor, é a conversa de sempre dela; numa cotação de compra, as
 * mensagens gravadas na resposta do fornecedor.
 */

/** A conversa de uma solicitação ao fornecedor (a ligada ou a da tela). */
export async function RequestChat({
  user,
  request: r,
  supplierName,
  board,
  errors,
  fallbackError,
  t,
}: {
  user: User;
  request: SupplierRequest;
  supplierName: string;
  /** A solicitação da tela: o envio volta para ela. */
  board: string;
  errors: Record<string, string>;
  fallbackError: string;
  t: Translate;
}) {
  const people = await negotiationPeople(user, r);
  const loginOf = (p: typeof people.me) =>
    p.login ? `${p.name} (${p.login})` : p.name;
  const messages: ConversationMessage[] = (r.negotiation ?? [])
    .filter((e) => e.kind === "message")
    .map((e) => {
      const author = people.byId[e.byUserId];
      const sideLabel = t(`supplierRequests.negotiation.side.${e.side}`);
      return {
        id: e.id,
        mine: e.side === "wellmix",
        side: e.side,
        sideLabel,
        author: author
          ? author.userId === user.id
            ? `${author.name} · ${t("negotiationScreen.you")}`
            : author.name
          : sideLabel,
        login: author?.login ?? null,
        to: recipientText(e.side, people, supplierName, t),
        at: dateTime(e.at, t),
        text: e.text ?? null,
        documentId: e.documentId ?? null,
        fileName: e.fileName ?? null,
      };
    });
  return (
    <NegotiationConversation
      requestId={r.id}
      board={board}
      messages={messages}
      canPost={canPostMessage(r.status)}
      defaultOpen
      sendingAs={loginOf(people.me)}
      sendingTo={recipientText(people.me.side, people, supplierName, t)}
      errors={errors}
      fallbackError={fallbackError}
      labels={{
        title: t("negotiationScreen.chat.title", { n: messages.length }),
        who: t("negotiationScreen.chat.who"),
        empty: t("supplierRequests.chat.empty"),
        placeholder: t("supplierRequests.chat.placeholder"),
        attach: t("negotiationScreen.chat.attach"),
        send: t("negotiationScreen.chat.send"),
        sending: t("supplierRequests.negotiation.sending"),
        file: t("supplierRequests.negotiation.file"),
        closed: t("supplierRequests.chat.closed"),
        sendingAs: t("negotiationScreen.chat.sendingAs"),
        sendingTo: t("negotiationScreen.chat.sendingTo"),
        to: t("negotiationScreen.to"),
        login: t("negotiationScreen.login"),
      }}
    />
  );
}

/**
 * A conversa de um fornecedor numa cotação de compra, para os dois lados: a
 * Wellmix (no modal do quadro) e o fornecedor (na cotação dele).
 */
export function QuoteChat({
  quoteId,
  responseId,
  productId,
  messages,
  mySide,
  names,
  canPost,
  errors,
  fallbackError,
  t,
}: {
  quoteId: string;
  /** Só a Wellmix informa a resposta; o fornecedor fala na dele. */
  responseId: string | null;
  productId: string | null;
  messages: QuoteNegotiationEvent[];
  mySide: "wellmix" | "supplier";
  /** Nome de quem escreveu, por login (vazio: só o lado). */
  names: Record<string, string>;
  canPost: boolean;
  errors: Record<string, string>;
  fallbackError: string;
  t: Translate;
}) {
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white"
      data-quote-chat={responseId ?? "own"}
    >
      <ol
        className="max-h-[26rem] space-y-2 overflow-y-auto px-3 py-2"
        data-quote-chat-messages
      >
        {messages.length ? (
          messages.map((m) => {
            const mine = m.side === mySide;
            return (
              <li
                key={m.id}
                className={cx("flex", mine ? "justify-end" : "justify-start")}
                data-quote-chat-message={mine ? "mine" : "other"}
              >
                <div
                  className={cx(
                    "max-w-[85%] rounded-xl px-3 py-2 text-[13px] shadow-sm",
                    mine
                      ? "rounded-br-sm bg-brand-50 text-zinc-900 ring-1 ring-brand-100"
                      : "rounded-bl-sm bg-zinc-50 text-zinc-900 ring-1 ring-zinc-200",
                  )}
                >
                  <p className="text-xs">
                    {names[m.byUserId] ? (
                      <span className="font-semibold">{names[m.byUserId]}</span>
                    ) : null}
                    <span className="text-zinc-500">
                      {names[m.byUserId] ? " · " : ""}
                      {t(`supplierRequests.negotiation.side.${m.side}`)}
                    </span>
                  </p>
                  {m.text ? (
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      {m.text}
                    </p>
                  ) : null}
                  {m.documentId ? (
                    <a
                      href={`/api/files/${m.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block"
                      data-quote-chat-attachment
                    >
                      {m.mime?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
                        <img
                          src={`/api/files/${m.documentId}`}
                          alt={m.fileName ?? ""}
                          className="max-h-40 rounded-md border border-zinc-200 object-contain"
                        />
                      ) : (
                        <span className="text-sky-700 underline">
                          {m.fileName ?? t("supplierRequests.negotiation.file")}
                        </span>
                      )}
                    </a>
                  ) : null}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {dateTime(m.at, t)}
                  </p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="py-4 text-center text-xs text-zinc-500">
            {t("supplierRequests.chat.empty")}
          </li>
        )}
      </ol>
      {canPost ? (
        <ActionForm
          action={postQuoteMessageStateAction}
          errors={errors}
          fallbackError={fallbackError}
          pendingLabel={t("supplierRequests.negotiation.sending")}
          // Mensagem gravada: o formulário renasce vazio.
          key={messages.length}
          className="border-t border-zinc-200 p-2"
          data-quote-chat-form
        >
          <input type="hidden" name="quoteId" value={quoteId} />
          {responseId ? (
            <input type="hidden" name="responseId" value={responseId} />
          ) : null}
          {productId ? (
            <input type="hidden" name="product" value={productId} />
          ) : null}
          <ChatComposer
            labels={{
              placeholder: t("supplierRequests.chat.placeholder"),
              attach: t("negotiationScreen.chat.attach"),
              send: t("negotiationScreen.chat.send"),
            }}
          />
        </ActionForm>
      ) : (
        <p className="border-t border-zinc-200 p-3 text-center text-xs text-zinc-500">
          {t("supplierRequests.chat.closed")}
        </p>
      )}
    </div>
  );
}
