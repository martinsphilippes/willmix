"use client";

import { useRef } from "react";
import { SubmitButton } from "./submit-button";
import { cx } from "./ui";

/**
 * Quantidade e personalização de um item do carrinho. Salva sozinho ao sair
 * do campo (ou com Enter / "Atualizar"): quem muda a quantidade e vai direto
 * em "Solicitar orçamento" não perde a mudança (as ações rodam em fila, a
 * gravação antes do envio). A ação grava sem trocar de tela.
 */
export function CartLineForm({
  action,
  itemId,
  productId,
  quantity,
  notes,
  labels,
}: {
  action: (form: FormData) => Promise<void>;
  itemId: string;
  productId: string;
  quantity: number;
  notes: string | null;
  labels: {
    quantity: string;
    notes: string;
    notesPlaceholder: string;
    update: string;
  };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saved = useRef({ quantity: String(quantity), notes: notes ?? "" });
  const saveIfChanged = () => {
    const form = formRef.current;
    if (!form) return;
    const q = (form.elements.namedItem("quantity") as HTMLInputElement).value;
    const n = (form.elements.namedItem("notes") as HTMLInputElement).value;
    if (q === saved.current.quantity && n === saved.current.notes) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    saved.current = { quantity: q, notes: n };
    form.requestSubmit();
  };
  const input =
    "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    <form
      ref={formRef}
      action={action}
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
          step={1}
          required
          defaultValue={quantity}
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
          defaultValue={notes ?? ""}
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
  );
}
