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
 * uma medida, o último calculado fica no campo para ajustar).
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
) {
  const [cbm, setCbm] = useState(initial);
  const last = useRef(initial);
  const lost = useRef(onLost);
  useEffect(() => {
    lost.current = onLost;
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
        if (last.current !== null && next === null) lost.current?.(last.current);
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
  const cbm = useBoxCbm(ref, initialCbm, (prev) => setManual(String(prev)));
  // O valor muda sem tecla neste campo: avisa o formulário (programação,
  // containers e o vermelho de "Preencha este campo" leem daqui).
  const announced = useRef(cbm);
  useEffect(() => {
    if (announced.current === cbm) return;
    announced.current = cbm;
    ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [cbm]);
  const auto = cbm !== null;
  return (
    <input
      ref={ref}
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      value={auto ? String(cbm) : manual}
      onChange={(e) => {
        if (!auto) setManual(e.target.value);
      }}
      readOnly={auto}
      aria-readonly={auto || undefined}
      disabled={disabled}
      data-box-cbm={auto ? "auto" : "manual"}
      className={cx(
        inputDenseClass,
        "tabular-nums",
        auto && "cursor-default bg-zinc-50 text-zinc-700",
      )}
    />
  );
}

/** Dica ao lado: calculado pelas medidas, ou como fazer para calcular. */
export function BoxCbmHint({
  initialCbm,
  auto,
  manual,
}: {
  initialCbm: number | null;
  auto: string;
  manual: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const cbm = useBoxCbm(ref, initialCbm);
  return (
    <span ref={ref} data-box-cbm-hint={cbm !== null ? "auto" : "manual"}>
      {cbm !== null ? auto : manual}
    </span>
  );
}
