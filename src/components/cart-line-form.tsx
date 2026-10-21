"use client";

import { useActionState, useRef, useState } from "react";
import type { CartLineState } from "@/app/app/actions/cart";
import { SubmitButton } from "./submit-button";
import { cx } from "./ui";

type LineAction = (
  prev: CartLineState,
  form: FormData,
) => Promise<CartLineState>;

/**
 * Quantidade, personalização e "Remover" de um item do carrinho. Salva
 * sozinho ao sair do campo (ou com Enter / "Atualizar"): quem muda a
 * quantidade e vai direto em "Solicitar orçamento" não perde a mudança (as
 * ações rodam em fila, a gravação antes do envio). Grava sem trocar de tela;
 * os campos são controlados, então o que se digita enquanto grava não some.
 * Erro aparece no próprio item e some no próximo acerto.
 */
export function CartLineForm({
  update,
  remove,
  itemId,
  productId,
  quantity,
  notes,
  labels,
}: {
  update: LineAction;
  remove: LineAction;
  itemId: string;
  productId: string;
  quantity: number;
  notes: string | null;
  labels: {
    quantity: string;
    notes: string;
    notesPlaceholder: string;
    update: string;
    remove: string;
    /** Texto por código de erro; "unexpected" é o padrão. */
    errors: Record<string, string>;
  };
}) {
  const [updateState, updateAction] = useActionState(update, { error: null });
  const [removeState, removeAction] = useActionState(remove, { error: null });
  const [q, setQ] = useState(String(quantity));
  const [n, setN] = useState(notes ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const saved = useRef({ quantity: String(quantity), notes: notes ?? "" });
  const saveIfChanged = () => {
    const form = formRef.current;
    if (!form) return;
    if (q === saved.current.quantity && n === saved.current.notes) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    saved.current = { quantity: q, notes: n };
    form.requestSubmit();
  };
  const error = updateState.error ?? removeState.error;
  const input =
    "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    <>
      <form
        ref={formRef}
        action={updateAction}
        onSubmit={() => {
          saved.current = { quantity: q, notes: n };
        }}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="itemId" value={itemId} />
        <label className="text-xs font-medium text-zinc-700">
          <span className="mb-1 block">{labels.quantity}</span>
          <input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={10_000_000}
            step={1}
            required
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={saveIfChanged}
            className={cx(input, "w-28 tabular-nums")}
            data-cart-quantity={productId}
          />
        </label>
        <label className="min-w-0 flex-1 basis-48 text-xs font-medium text-zinc-700">
          <span className="mb-1 block">{labels.notes}</span>
          <input
            name="notes"
            maxLength={500}
            value={n}
            onChange={(e) => setN(e.target.value)}
            placeholder={labels.notesPlaceholder}
            onBlur={saveIfChanged}
            className={cx(input, "w-full")}
          />
        </label>
        <SubmitButton
          variant="secondary"
          className="rounded-xl"
          data-cart-update={productId}
        >
          {labels.update}
        </SubmitButton>
      </form>
      {error ? (
        <p
          role="alert"
          className="mt-2 text-xs font-medium text-red-700"
          data-cart-line-error={error}
        >
          {labels.errors[error] ?? labels.errors.unexpected}
        </p>
      ) : null}
      <form action={removeAction} className="mt-1">
        <input type="hidden" name="itemId" value={itemId} />
        <SubmitButton
          variant="ghost"
          className="-ml-2 px-2 py-2 text-xs font-semibold text-zinc-500 hover:text-red-700"
          data-cart-remove={productId}
        >
          {labels.remove}
        </SubmitButton>
      </form>
    </>
  );
}
