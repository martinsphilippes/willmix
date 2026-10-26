import { openChatAction } from "@/app/app/actions/messages";
import { SubmitButton } from "./submit-button";

/*
 * "Conversar com a Wellmix" / "Conversar com a empresa" na solicitação e no
 * pedido: cada botão abre (ou cria) o assunto da solicitação/do pedido na
 * conversa da empresa e leva até ele. Quem é de fora tem um botão (a própria
 * empresa); a Wellmix, um por empresa participante.
 */

export interface ChatTarget {
  /** Empresa da conversa (Wellmix escolhe); vazio = a do próprio login. */
  partyId?: string | null;
  label: string;
  /** Texto de apoio (ex.: nome da empresa). */
  title?: string;
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4 shrink-0"
    >
      <path d="M4 5h16v11H9l-5 4V5Z" />
    </svg>
  );
}

export function ChatButtons({
  back,
  requestId,
  orderId,
  targets,
  prefix,
}: {
  /** Tela de volta em caso de erro (a própria solicitação/o pedido). */
  back: string;
  requestId?: string;
  orderId?: string;
  targets: ChatTarget[];
  /** Rótulo antes dos botões (ex.: "Conversar com:"). */
  prefix?: string;
}) {
  if (!targets.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-chat-buttons>
      {prefix ? (
        <span className="text-xs font-medium text-zinc-500">{prefix}</span>
      ) : null}
      {targets.map((target) => (
        <form key={target.partyId ?? "own"} action={openChatAction}>
          <input type="hidden" name="back" value={back} />
          {requestId ? (
            <input type="hidden" name="requestId" value={requestId} />
          ) : null}
          {orderId ? (
            <input type="hidden" name="orderId" value={orderId} />
          ) : null}
          {target.partyId ? (
            <input type="hidden" name="partyId" value={target.partyId} />
          ) : null}
          <SubmitButton
            variant="secondary"
            className="px-2.5 py-1 text-xs"
            title={target.title}
            data-chat-target={target.partyId ?? "own"}
          >
            <ChatIcon />
            {target.label}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}
