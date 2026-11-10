"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { cx, inputDenseClass } from "@/components/ui";
import {
  setBookingCustomerAction,
  setBookingQuantityAction,
} from "@/app/app/actions/booking";

/*
 * Booking: o cliente e a quantidade reservada direto na linha da tabela.
 * Gravam sozinhos (escolheu o cliente; digitou a quantidade e saiu do campo),
 * sem marcar a linha nem ir à barra de cima, e avisam na própria célula:
 * gravando, gravado ou por que não gravou. A tela é só atualizada, não
 * recarregada: o que a pessoa digitou nas outras linhas continua lá.
 */

export interface BookingRowFieldLabels {
  /** Nome do campo para leitores de tela ("Cliente de <produto>"). */
  field: string;
  saving: string;
  saved: string;
  /** Sem rede ou sessão vencida: nada foi gravado. */
  failed: string;
}

type Note = { text: string; ok: boolean } | null;

const subscribeNothing = () => () => {};

/** Grava e devolve se deu certo; o aviso da célula acompanha. */
function useRowSave(labels: BookingRowFieldLabels) {
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const save = (
    send: () => Promise<{ ok: true } | { ok: false; message: string }>,
    onRefused: () => void,
  ) => {
    setNote(null);
    start(async () => {
      let result: Awaited<ReturnType<typeof send>>;
      try {
        result = await send();
      } catch {
        onRefused();
        setNote({ text: labels.failed, ok: false });
        return;
      }
      if (!result.ok) {
        onRefused();
        setNote({ text: result.message, ok: false });
        return;
      }
      // A resposta da gravação já traz a tela atualizada (revalidatePath).
      setNote({ text: labels.saved, ok: true });
    });
  };
  return { note, pending, save };
}

function RowNote({
  note,
  pending,
  saving,
}: {
  note: Note;
  pending: boolean;
  saving: string;
}) {
  if (!pending && !note) return null;
  return (
    <span
      role="status"
      className={cx(
        "mt-0.5 block text-[11px] leading-tight whitespace-normal",
        pending
          ? "text-zinc-500"
          : note?.ok
            ? "text-emerald-700"
            : "text-red-700",
      )}
      data-booking-row-note={pending ? "saving" : note?.ok ? "saved" : "error"}
    >
      {pending ? saving : note?.text}
    </span>
  );
}

export function BookingCustomerSelect({
  bookingId,
  current,
  options,
  labels,
}: {
  bookingId: string;
  /** Cliente gravado na linha ("-" quando não há). */
  current: string;
  /** Na ordem da lista; o valor é o que a ação recebe. */
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
}) {
  const [value, setValue] = useState(current);
  // O que o servidor diz que está gravado mudou (esta gravação ou a de outra
  // pessoa): a lista acompanha.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setValue(current);
  }
  const { note, pending, save } = useRowSave(labels);
  // Enquanto a página ainda está abrindo, a lista fica travada: uma escolha
  // feita antes da hora ficaria na tela sem ter sido gravada.
  const ready = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  function choose(next: string) {
    if (next === value) return;
    setValue(next);
    save(
      () => setBookingCustomerAction(bookingId, next),
      // Não gravou: a lista volta para o que está gravado.
      () => setValue(current),
    );
  }

  return (
    <span className="block w-40" data-booking-customer={bookingId}>
      <select
        value={value}
        onChange={(e) => choose(e.target.value)}
        disabled={pending || !ready}
        aria-busy={pending}
        aria-label={labels.field}
        className={cx(inputDenseClass, "w-40", pending && "opacity-60")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <RowNote note={note} pending={pending} saving={labels.saving} />
    </span>
  );
}

/**
 * A quantidade reservada da linha. Continua sendo um campo do formulário da
 * barra (`qty_<id>`): numa ação em várias linhas, vale o que está digitado.
 * Sozinha, grava ao sair do campo ou no Enter. Recusada (abaixo do pedido
 * mínimo, por exemplo), o número digitado fica para a pessoa corrigir.
 */
export function BookingQuantityInput({
  bookingId,
  formId,
  saved,
  placeholder,
  labels,
}: {
  bookingId: string;
  formId: string;
  /** Quantidade gravada na linha ("" quando não há). */
  saved: string;
  placeholder: string;
  labels: BookingRowFieldLabels;
}) {
  const { note, pending, save } = useRowSave(labels);
  // O último valor mandado gravar: sair do campo de novo sem mexer não regrava.
  const [sent, setSent] = useState(saved);
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setSent(saved);
  }

  function commit(typed: string) {
    const next = typed.trim();
    if (next === sent) return;
    setSent(next);
    save(
      () => setBookingQuantityAction(bookingId, next),
      // Não gravou: sair do campo de novo tenta outra vez.
      () => setSent(saved),
    );
  }

  return (
    <span className="block w-24 min-w-24" data-booking-qty-cell={bookingId}>
      <input
        form={formId}
        name={`qty_${bookingId}`}
        defaultValue={saved}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={labels.field}
        aria-busy={pending}
        data-booking-qty={bookingId}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          // Enter grava a linha (em vez de acionar o primeiro botão da barra).
          if (e.key !== "Enter") return;
          e.preventDefault();
          commit(e.currentTarget.value);
        }}
        className={cx(inputDenseClass, "w-24 min-w-24 text-right")}
      />
      <RowNote note={note} pending={pending} saving={labels.saving} />
    </span>
  );
}
