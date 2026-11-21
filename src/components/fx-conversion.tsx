"use client";

import { useCallback, useRef, useState } from "react";
import {
  convertAmount,
  convertedText,
  sameCurrency,
  type FxPayload,
} from "@/lib/fx-convert";
import { cx } from "./ui";

/*
 * Conversão do valor ao trocar a moeda (dono, 21/11/2026): o campo vai para a
 * moeda nova pelo câmbio do dia do portal (`/api/fx`), na hora, com o aviso
 * "Convertido de US$ 1,0194 · câmbio de 21/11/2026" e o botão "Manter", que
 * volta ao número de antes na moeda nova (a moeda estava errada e o número
 * certo). Sem câmbio da moeda, o valor fica e o aviso diz isso. A conversão
 * sai do evento de troca da moeda, nunca de uma moeda posta pelo sistema
 * (rascunho restaurado, valor inicial).
 */

let pending: Promise<FxPayload | null> | null = null;

/** Câmbio do portal: uma busca por página; se falhou, a próxima troca tenta de novo. */
export function loadFx(): Promise<FxPayload | null> {
  if (!pending) {
    pending = fetch("/api/fx", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((res) => (res.ok ? (res.json() as Promise<FxPayload>) : null))
      .catch(() => null)
      .then((payload) => {
        if (!payload) pending = null;
        return payload;
      });
  }
  return pending;
}

/**
 * O portal está devolvendo valores ao formulário (rascunho restaurado,
 * `FormDraftGuard`): a moeda que volta não converte o valor.
 */
export function restoringForm(el: Element | null | undefined) {
  return Boolean(el?.closest("form")?.dataset.draftRestoring);
}

/** Busca o câmbio antes da troca (foco no seletor de moeda): a conversão sai na hora. */
export function prefetchFx() {
  void loadFx();
}

export interface FxNote {
  /** "Convertido de US$ 1,0194 · câmbio de 21/11/2026" ou "Sem câmbio…". */
  text: string;
  /** "Manter R$ 1,0194"; sem conversão, null. */
  keep: string | null;
}

/**
 * Um campo de valor: `convert(de, para, valor, gravar)` busca o câmbio (em
 * memória depois da primeira vez), grava o valor convertido e mostra o aviso;
 * `keep()` volta ao número de antes; `clear()` tira o aviso (a pessoa
 * digitou). `format` escreve o valor com a moeda ("US$ 1,0194").
 */
export function useFxConversion({
  decimals,
  format,
}: {
  decimals: number;
  format: (amount: number, currency: string) => string;
}) {
  const [note, setNote] = useState<FxNote | null>(null);
  const seq = useRef(0);
  const undo = useRef<(() => void) | null>(null);

  const convert = useCallback(
    (
      from: string,
      to: string,
      amount: number | null,
      apply: (value: number) => void,
    ) => {
      const id = ++seq.current;
      undo.current = null;
      if (
        !from ||
        !to ||
        sameCurrency(from, to) ||
        amount === null ||
        !(amount > 0)
      ) {
        setNote(null);
        return;
      }
      void loadFx().then((fx) => {
        if (id !== seq.current) return;
        if (!fx) {
          setNote(null);
          return;
        }
        const converted = convertAmount(amount, from, to, fx.rates, decimals);
        if (converted === null) {
          setNote({ text: fx.labels.none, keep: null });
          return;
        }
        apply(converted);
        undo.current = () => apply(amount);
        setNote({
          text: convertedText(fx, format(amount, from)),
          keep: fx.labels.keep.replaceAll("{amount}", format(amount, to)),
        });
      });
    },
    [decimals, format],
  );

  const clear = useCallback(() => {
    seq.current++;
    undo.current = null;
    setNote(null);
  }, []);

  const keep = useCallback(() => {
    undo.current?.();
    clear();
  }, [clear]);

  return { note, convert, clear, keep };
}

/**
 * Linha do aviso embaixo do campo. Num campo em linha (flex com quebra), ocupa
 * a linha de baixo sem alargar o campo (`contain: inline-size`).
 */
export function FxNoteLine({
  note,
  onKeep,
  className,
}: {
  note: FxNote | null;
  onKeep: () => void;
  className?: string;
}) {
  if (!note) return null;
  return (
    <span
      role="status"
      className={cx(
        "block basis-full text-[11px] leading-4 text-zinc-500 [contain:inline-size]",
        className,
      )}
      data-fx-note=""
    >
      {note.text}
      {note.keep ? (
        <>
          {" · "}
          <button
            type="button"
            onClick={onKeep}
            className="font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
            data-fx-keep=""
          >
            {note.keep}
          </button>
        </>
      ) : null}
    </span>
  );
}
