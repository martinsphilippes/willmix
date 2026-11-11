"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { cx, inputDenseClass } from "@/components/ui";

/*
 * Campos que gravam sozinhos direto na tabela (o booking por planilha usa
 * nos campos do rascunho). Cada um grava ao escolher na lista ou ao sair do
 * campo (ou Enter), sem ir a uma barra de cima, e avisa na própria célula:
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

/** Sem acento e em minúsculas: "São Paulo" casa com "sao pau". */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Lista com busca: ao clicar, abre as opções; digitar vai filtrando (todas
 * as palavras, sem acento) até sobrar a que a pessoa quer; clicar nela (ou
 * Enter) grava. Esc ou sair do campo sem escolher volta para o gravado.
 * Recusada, volta para o que está gravado, como a lista simples.
 */
export function SaveCombobox({
  send,
  current,
  options,
  labels,
  width,
  placeholder,
  noMatch,
  ...data
}: {
  send: (value: string) => Promise<Result>;
  current: string;
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
  width: string;
  placeholder: string;
  /** Texto quando nada casa com o que foi digitado. */
  noMatch: string;
  [data: `data-${string}`]: string;
}) {
  const [value, setValue] = useState(current);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setValue(current);
  }
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { note, pending, save } = useRowSave(labels);
  const ready = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const listId = useId();

  const label = options.find((o) => o.value === value)?.label ?? "";
  const words = fold(query).split(/\s+/).filter(Boolean);
  const matches = words.length
    ? options.filter((o) => {
        const l = fold(o.label);
        return words.every((w) => l.includes(w));
      })
    : options;

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function choose(next: string) {
    close();
    if (next === value) return;
    setValue(next);
    save(
      () => send(next),
      () => setValue(current),
    );
  }

  return (
    <span className={cx("relative block", width)} {...data}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={labels.field}
        aria-busy={pending}
        autoComplete="off"
        disabled={pending || !ready}
        placeholder={open ? placeholder : undefined}
        value={open ? query : label}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          setActive(0);
        }}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const pick = matches[active];
            if (open && pick) choose(pick.value);
          } else if (e.key === "Escape") {
            close();
            e.currentTarget.blur();
          }
        }}
        className={cx(inputDenseClass, width, pending && "opacity-60")}
        data-combobox-input
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
        >
          {matches.length ? (
            matches.map((o, i) => (
              <li
                key={o.value || "-"}
                role="option"
                aria-selected={o.value === value}
                // mousedown: escolhe antes de o campo perder o foco.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.value);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "cursor-pointer px-3 py-1.5",
                  i === active && "bg-brand-50",
                  o.value === value && "font-semibold",
                )}
                data-combobox-option={o.value}
              >
                {o.label}
              </li>
            ))
          ) : (
            <li className="px-3 py-1.5 text-zinc-500">{noMatch}</li>
          )}
        </ul>
      ) : null}
      <RowNote note={note} pending={pending} saving={labels.saving} />
    </span>
  );
}
