"use client";

import { TABLE_REVEAL_EVENT } from "@/lib/table-tools";

/*
 * Lista de pendências do Book (pedido do dono, 14/11/2026): quando "Fechar e
 * analisar" para por campos obrigatórios vazios, o aviso lista os itens
 * incompletos e, embaixo de cada um, os campos que faltam (com os nomes das
 * colunas da tabela). Tocar num campo leva até ele: a tabela mostra a linha
 * (limpa a busca que a esconde e vai à página dela), a tela rola até o campo,
 * que recebe o foco e fica destacado por alguns segundos. Nada é recarregado:
 * o que já foi digitado nos outros campos continua lá (cada campo grava
 * sozinho ao sair dele, e a lista se atualiza com a tela).
 */

export interface PendingItemView {
  itemId: string;
  /** Nome e código do item; sem os dois, a linha. */
  label: string;
  fields: Array<{
    /** Campo do item (o mesmo da validação): "price", "ncm"... */
    field: string;
    /** Nome do campo como na tabela. */
    label: string;
    /** Texto para leitores de tela ("Ir para o campo Preço — item"). */
    title: string;
  }>;
}

/** O campo do item na tabela (o NCM tem o próprio atributo). */
function fieldSelector(itemId: string, field: string) {
  return field === "ncm"
    ? `[data-booking-item-ncm="${CSS.escape(itemId)}"]`
    : `[data-booking-item-field="${CSS.escape(`${itemId}:${field}`)}"]`;
}

const FLASH_MS = 2600;

/** Mostra a linha do item, rola até o campo, dá o foco e destaca a célula. */
export function goToBookingField(itemId: string, field: string) {
  const row = document.querySelector<HTMLTableRowElement>(
    `tr[data-booking-item="${CSS.escape(itemId)}"]`,
  );
  if (!row) return;
  row.dispatchEvent(new CustomEvent(TABLE_REVEAL_EVENT, { bubbles: true }));
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let tries = 0;
  // A tabela troca de página no próximo quadro: espera a linha aparecer.
  const step = () => {
    const target = row.querySelector<HTMLElement>(fieldSelector(itemId, field));
    if ((row.hidden || !target) && tries++ < 60) {
      requestAnimationFrame(step);
      return;
    }
    if (!target) return;
    target.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: smooth ? "smooth" : "auto",
    });
    target.focus({ preventScroll: true });
    const cell = target.closest("td");
    if (!cell) return;
    cell.setAttribute("data-booking-field-target", "");
    window.setTimeout(
      () => cell.removeAttribute("data-booking-field-target"),
      FLASH_MS,
    );
  };
  requestAnimationFrame(step);
}

export function BookingPendingList({ items }: { items: PendingItemView[] }) {
  return (
    // Em colunas e com rolagem própria: um book grande não empurra a tela.
    <ol
      className="mt-2 grid max-h-[26rem] gap-x-6 gap-y-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
      data-booking-pending-list
    >
      {items.map((item) => (
        <li key={item.itemId} data-booking-pending-item={item.itemId}>
          <span className="block font-medium text-zinc-900">{item.label}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {item.fields.map((f) => (
              <button
                key={f.field}
                type="button"
                title={f.title}
                aria-label={f.title}
                onClick={() => goToBookingField(item.itemId, f.field)}
                data-booking-pending-field={`${item.itemId}:${f.field}`}
                className="rounded-full border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-800 underline-offset-2 transition hover:border-red-400 hover:bg-red-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {f.label}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}
