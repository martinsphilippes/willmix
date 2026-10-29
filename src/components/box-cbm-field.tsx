"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { parseNumberInput } from "@/lib/number-input";
import { DRAFT_RESTORE_EVENT } from "./form-draft-guard";
import { cx, inputDenseClass } from "./ui";

/*
 * CBM da caixa master pelas medidas da caixa (C × L × A ÷ 1.000.000), ao vivo
 * e com a mesma conta do servidor: com as três medidas o campo mostra o
 * calculado e não se digita; faltando alguma, digita-se o CBM (e, ao apagar
 * uma medida, o último calculado fica no campo para ajustar). Quem só lê vê o
 * CBM salvo (é o que vale nas contas até alguém salvar a ficha de novo).
 */

/** CBM pelas medidas do mesmo formulário, ou nulo se faltar alguma. */
function readBoxCbm(form: HTMLFormElement): number | null {
  const v = (name: string) => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement ? parseNumberInput(el.value) : null;
  };
  return cbmFromDimensions(v("lengthCm"), v("widthCm"), v("heightCm"));
}

/** Acompanha as medidas digitadas (ou devolvidas pelo rascunho) no formulário. */
function useBoxCbm(
  ref: RefObject<HTMLElement | null>,
  initial: number | null,
  onLost?: (last: number) => void,
  onCalc?: (next: number) => void,
) {
  const [cbm, setCbm] = useState(initial);
  const last = useRef(initial);
  const lost = useRef(onLost);
  const calc = useRef(onCalc);
  useEffect(() => {
    lost.current = onLost;
    calc.current = onCalc;
  });
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let timer = 0;
    // Depois do React tratar o evento (campos controlados já atualizados).
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = readBoxCbm(form);
        if (last.current !== null && next === null)
          lost.current?.(last.current);
        else if (next !== null) calc.current?.(next);
        last.current = next;
        setCbm(next);
      }, 0);
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener(DRAFT_RESTORE_EVENT, update);
    // Medidas digitadas antes da hidratação.
    update();
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener(DRAFT_RESTORE_EVENT, update);
    };
  }, [ref]);
  return cbm;
}

export function BoxCbmInput({
  id,
  name,
  defaultValue,
  initialCbm,
  disabled,
}: {
  /** Vem do FieldRow (rótulo ligado pelo htmlFor). */
  id?: string;
  name: string;
  defaultValue: string;
  /** CBM pelas medidas salvas (o servidor calcula com a mesma conta). */
  initialCbm: number | null;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState(defaultValue);
  // Valor escrito no campo enquanto calculado (só a volta do rascunho faz
  // isso): vale quando uma medida some e o campo volta a ser digitado.
  const typed = useRef<string | null>(null);
  const cbm = useBoxCbm(
    ref,
    initialCbm,
    (prev) => {
      setManual(typed.current ?? String(prev));
      typed.current = null;
    },
    // Medidas completas de novo: o valor da volta do rascunho já não vale.
    () => {
      typed.current = null;
    },
  );
  // O valor muda sem tecla neste campo: avisa o formulário (programação,
  // containers e o vermelho de "Preencha este campo" leem daqui). Também ao
  // abrir, se o calculado não é o salvo (ex.: ficha sem CBM com medidas).
  const announced = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (disabled) return;
    const first = announced.current === undefined;
    if (!first && announced.current === cbm) return;
    if (first && (cbm === null || defaultValue === String(cbm))) {
      announced.current = cbm;
      return;
    }
    // Marcado só quando avisa (o efeito roda duas vezes em desenvolvimento).
    const id = window.setTimeout(() => {
      announced.current = cbm;
      ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }, 0);
    return () => window.clearTimeout(id);
  }, [cbm, defaultValue, disabled]);
  // Só leitura: o CBM salvo (o calculado aparece na dica, se for outro).
  const auto = cbm !== null && !disabled;
  const value = auto
    ? String(cbm)
    : disabled
      ? defaultValue || (cbm !== null ? String(cbm) : "")
      : manual;
  return (
    <input
      ref={ref}
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        if (auto) typed.current = e.target.value;
        else setManual(e.target.value);
      }}
      readOnly={auto}
      aria-readonly={auto || undefined}
      disabled={disabled}
      data-box-cbm={cbm !== null ? "auto" : "manual"}
      className={cx(
        inputDenseClass,
        "tabular-nums",
        auto && "cursor-default bg-zinc-50 text-zinc-700",
      )}
    />
  );
}

/**
 * Dica ao lado: calculado pelas medidas (e, se o salvo é outro, o que muda ao
 * salvar), ou como fazer para calcular. Quem só lê não recebe instrução.
 */
export function BoxCbmHint({
  initialCbm,
  stored,
  disabled,
  texts,
}: {
  initialCbm: number | null;
  /** CBM salvo na ficha. */
  stored: number | null;
  disabled?: boolean;
  texts: {
    auto: string;
    manual: string;
    /** "Salvo: {stored} m³; ao salvar, vale o das medidas." */
    willUpdate: string;
    /** "Pelas medidas: {cbm} m³" (quem só lê, salvo diferente). */
    fromSize: string;
  };
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const cbm = useBoxCbm(ref, initialCbm);
  const differs =
    cbm !== null && stored !== null && Math.abs(stored - cbm) > 1e-9;
  const text =
    cbm === null
      ? disabled
        ? null
        : texts.manual
      : disabled
        ? differs
          ? texts.fromSize.replace("{cbm}", String(cbm))
          : texts.auto
        : differs
          ? `${texts.auto}. ${texts.willUpdate.replace("{stored}", String(stored))}`
          : texts.auto;
  return (
    <span ref={ref} data-box-cbm-hint={cbm !== null ? "auto" : "manual"}>
      {text}
    </span>
  );
}
