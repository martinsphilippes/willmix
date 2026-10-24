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
 * os campos são controlados, então o que se digita enquanto grava não some,
 * e acompanham o valor do servidor quando ele muda (ex.: outra aba) e o
 * campo não tem nada por gravar. O aviso de erro é o do último resultado.
 */
export function CartLineForm({
  action,
  itemId,
  productId,
  quantity,
  moq = null,
  notes,
  labels,
}: {
  action: LineAction;
  itemId: string;
  productId: string;
  quantity: number;
  /** Pedido mínimo do produto: a quantidade não desce dele. */
  moq?: number | null;
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
  const [state, dispatch] = useActionState(action, { error: null });
  const server = { quantity: String(quantity), notes: notes ?? "" };
  // Último valor do servidor já aplicado e último valor enviado (ou aplicado).
  const [seen, setSeen] = useState(server);
  const [saved, setSaved] = useState(server);
  const [q, setQ] = useState(server.quantity);
  const [n, setN] = useState(server.notes);
  if (seen.quantity !== server.quantity || seen.notes !== server.notes) {
    // O servidor mudou: o campo sem nada por gravar acompanha.
    setSeen(server);
    const next = { ...saved };
    if (q === saved.quantity) {
      setQ(server.quantity);
      next.quantity = server.quantity;
    }
    if (n === saved.notes) {
      setN(server.notes);
      next.notes = server.notes;
    }
    setSaved(next);
  }
  const formRef = useRef<HTMLFormElement>(null);
  // Piso: o mínimo (item antigo já abaixo dele pode ficar como está).
  const min = moq && moq > 0 ? Math.min(moq, quantity) : 1;
  const saveIfChanged = () => {
    const form = formRef.current;
    if (!form) return;
    // Digitou menos que o mínimo: volta ao mínimo antes de gravar.
    const typed = Math.round(Number(q));
    if (q !== "" && Number.isFinite(typed) && typed < min) setQ(String(min));
    if (q === saved.quantity && n === saved.notes) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    form.requestSubmit();
  };
  const input =
    "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    <>
      <form
        ref={formRef}
        action={dispatch}
        onSubmit={() => setSaved({ quantity: q, notes: n })}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="op" value="update" />
        <label className="text-xs font-medium text-zinc-700">
          <span className="mb-1 block">{labels.quantity}</span>
          <input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={min}
            max={10_000_000}
            step={1}
            required
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={saveIfChanged}
            className={cx(input, "w-28 tabular-nums")}
            data-cart-quantity={productId}
            data-cart-min={min}
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
      {state.error ? (
        <p
          role="alert"
          className="mt-2 text-xs font-medium text-red-700"
          data-cart-line-error={state.error}
        >
          {labels.errors[state.error] ?? labels.errors.unexpected}
        </p>
      ) : null}
      <form action={dispatch} className="mt-1">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="op" value="remove" />
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
