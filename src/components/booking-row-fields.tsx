"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { cx, inputDenseClass } from "@/components/ui";
import {
  setBookingCustomerAction,
  setBookingProductFieldAction,
  setBookingQuantityAction,
} from "@/app/app/actions/booking";

/*
 * Booking: os campos direto na tabela (cliente, quantidade reservada e os
 * dados do produto: preço, MOQ, pesos, medidas, fornecedor...). Cada um grava
 * sozinho (escolheu na lista; digitou e saiu do campo, ou Enter), sem marcar
 * a linha nem ir à barra de cima, e avisa na própria célula: gravando,
 * gravado ou por que não gravou. A tela é só atualizada, não recarregada: o
 * que a pessoa digitou nas outras linhas continua lá.
 */

export interface BookingRowFieldLabels {
  /** Nome do campo para leitores de tela ("Cliente de <produto>"). */
  field: string;
  saving: string;
  saved: string;
  /** Sem rede ou sessão vencida: nada foi gravado. */
  failed: string;
}

type Result = { ok: true } | { ok: false; message: string };
type Note = { text: string; ok: boolean } | null;

const subscribeNothing = () => () => {};

/** Grava e devolve se deu certo; o aviso da célula acompanha. */
function useRowSave(labels: BookingRowFieldLabels) {
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const save = (send: () => Promise<Result>, onRefused: () => void) => {
    setNote(null);
    start(async () => {
      let result: Result;
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
        "mt-0.5 block text-left text-[11px] leading-tight whitespace-normal",
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

/** Lista que grava ao escolher; recusada, volta para o que está gravado. */
export function SaveSelect({
  send,
  current,
  options,
  labels,
  width,
  ...data
}: {
  send: (value: string) => Promise<Result>;
  /** O que está gravado. */
  current: string;
  /** Na ordem da lista; o valor é o que a ação recebe. */
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
  width: string;
  [data: `data-${string}`]: string;
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
      () => send(next),
      () => setValue(current),
    );
  }

  return (
    <span className={cx("block", width)} {...data}>
      <select
        value={value}
        onChange={(e) => choose(e.target.value)}
        disabled={pending || !ready}
        aria-busy={pending}
        aria-label={labels.field}
        className={cx(inputDenseClass, width, pending && "opacity-60")}
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
 * Campo que grava ao sair dele ou no Enter. Recusado (valor que não dá para
 * ler, abaixo do pedido mínimo...), o que foi digitado fica para corrigir.
 * Gravado, o campo passa a mostrar o valor como ficou no servidor.
 */
export function SaveInput({
  send,
  saved,
  labels,
  width,
  numeric,
  type,
  placeholder,
  form,
  name,
  wrap = true,
  ...data
}: {
  send: (value: string) => Promise<Result>;
  /** O que está gravado, como a pessoa digita ("" quando não há). */
  saved: string;
  labels: BookingRowFieldLabels;
  width: string;
  numeric?: boolean;
  type?: string;
  placeholder?: string;
  /** Quando o campo também vai no envio de um formulário da tela. */
  form?: string;
  name?: string;
  /** Falso: vários campos na mesma célula (o aviso fica embaixo de cada). */
  wrap?: boolean;
  [data: `data-${string}`]: string;
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
      () => send(next),
      // Não gravou: sair do campo de novo tenta outra vez.
      () => setSent(saved),
    );
  }

  return (
    <span className={cx(wrap ? "block" : "inline-block align-top", width)}>
      <input
        // O valor gravado mudou (esta gravação, a troca do fornecedor que
        // traz os dados dele, outra pessoa): o campo mostra o novo.
        key={saved}
        form={form}
        name={name}
        defaultValue={saved}
        type={type ?? "text"}
        inputMode={numeric ? "decimal" : undefined}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={labels.field}
        aria-busy={pending}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          // Enter grava o campo (em vez de enviar um formulário da tela).
          if (e.key !== "Enter") return;
          e.preventDefault();
          commit(e.currentTarget.value);
        }}
        className={cx(inputDenseClass, width, numeric && "text-right")}
        {...data}
      />
      <RowNote note={note} pending={pending} saving={labels.saving} />
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
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
}) {
  return (
    <SaveSelect
      send={(value) => setBookingCustomerAction(bookingId, value)}
      current={current}
      options={options}
      labels={labels}
      width="w-40"
      data-booking-customer={bookingId}
    />
  );
}

/**
 * A quantidade reservada da linha. Continua sendo um campo do formulário da
 * barra (`qty_<id>`): numa ação em várias linhas, vale o que está digitado.
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
  return (
    <SaveInput
      send={(value) => setBookingQuantityAction(bookingId, value)}
      saved={saved}
      labels={labels}
      width="w-24 min-w-24"
      numeric
      placeholder={placeholder}
      form={formId}
      name={`qty_${bookingId}`}
      data-booking-qty={bookingId}
    />
  );
}

/** Um dado do produto (preço, MOQ, pesos, medidas, código, cores...). */
export function BookingProductInput({
  productId,
  field,
  saved,
  labels,
  width = "w-24",
  numeric,
  type,
  wrap,
}: {
  productId: string;
  /** Nome do campo que a ação recebe (os mesmos do "Salvar dados"). */
  field: string;
  saved: string;
  labels: BookingRowFieldLabels;
  width?: string;
  numeric?: boolean;
  type?: string;
  wrap?: boolean;
}) {
  return (
    <SaveInput
      send={(value) => setBookingProductFieldAction(productId, field, value)}
      saved={saved}
      labels={labels}
      width={width}
      numeric={numeric}
      type={type}
      wrap={wrap}
      data-booking-edit={field}
    />
  );
}

/** Um dado do produto escolhido em lista (fornecedor, moeda). */
export function BookingProductSelect({
  productId,
  field,
  current,
  options,
  labels,
  width,
}: {
  productId: string;
  field: string;
  current: string;
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
  width: string;
}) {
  return (
    <SaveSelect
      send={(value) => setBookingProductFieldAction(productId, field, value)}
      current={current}
      options={options}
      labels={labels}
      width={width}
      data-booking-edit={field}
    />
  );
}
