"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  CARTON_CBM_WARN,
  NO_INNER,
  PACKAGE_TYPES,
  cartonsPerContainer,
  checkInner,
  innerOptions,
  looksLikeColor,
  oversizedCarton,
  samePackageType,
  type PackageType,
} from "@/lib/carton";
import { parseNumberInput } from "@/lib/number-input";
import { DRAFT_RESTORE_EVENT } from "./form-draft-guard";
import { cx } from "./ui";

/*
 * Atalhos e conferências da caixa, ao vivo, para quem preenche a ficha de
 * compra, o cadastro do produto ou o item do sourcing:
 * - caixa inner: opções em um toque que fecham a master (os divisores) e
 *   "Sem caixa inner" (0); aviso quando o número não divide a master;
 * - medidas da caixa master improváveis (lado ≥ 120 cm ou ≥ 0,4 m³);
 * - tipo de embalagem: tipos comuns em um toque e aviso quando o texto é uma
 *   cor ("preto").
 * Os campos continuam sendo os do formulário (nada muda no envio); aqui só se
 * lê o que está digitado e, no toque, escreve-se no campo como se digitado.
 */

const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );

const chip = (on: boolean) =>
  cx(
    "min-w-8 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
    on
      ? "border-brand-600 bg-brand-600 text-white"
      : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
  );

const warnClass = "font-medium text-amber-800";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fieldOf(form: HTMLFormElement, name: string): Field | null {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
    ? el
    : null;
}

/** Escreve no campo como se a pessoa digitasse (rascunho, vermelho e contas acompanham). */
function writeField(form: HTMLFormElement | null, name: string, value: string) {
  const el = form ? fieldOf(form, name) : null;
  if (!el || el.disabled || el.value === value) return;
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Valores atuais de alguns campos do mesmo formulário. Começa com o que veio
 * do servidor (a primeira pintura é igual à do servidor) e acompanha o que se
 * digita, os atalhos e a volta do rascunho.
 */
function useFormFields(
  ref: RefObject<HTMLElement | null>,
  names: readonly string[],
  initial: Record<string, string>,
  /** Campos que valem vazios quando desabilitados (não vão no envio). */
  ignoreDisabled: readonly string[] = [],
) {
  const [values, setValues] = useState(initial);
  const key = names.join(" ");
  const skip = ignoreDisabled.join(" ");
  // A tela pode voltar do servidor sem remontar (ex.: ?saved=): com valores
  // novos nos campos, lê de novo.
  const served = JSON.stringify(initial);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const skipped = new Set(skip.split(" ").filter(Boolean));
    let timer = 0;
    // Depois do React tratar o evento (campos controlados já atualizados).
    const read = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next: Record<string, string> = {};
        for (const name of key.split(" ")) {
          const el = fieldOf(form, name);
          if (el) next[name] = el.disabled && skipped.has(name) ? "" : el.value;
        }
        setValues((prev) =>
          Object.keys(next).every((k) => prev[k] === next[k])
            ? prev
            : { ...prev, ...next },
        );
      }, 0);
    };
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    form.addEventListener(DRAFT_RESTORE_EVENT, read);
    // Digitado antes da hidratação (ou valores novos do servidor).
    read();
    // Hidratado: a tela (e o E2E) pode usar os atalhos com segurança.
    ref.current?.setAttribute("data-ready", "1");
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
      form.removeEventListener(DRAFT_RESTORE_EVENT, read);
    };
  }, [ref, key, skip, served]);
  return values;
}

const numberOf = (raw: string | undefined, int = false) => {
  const n = parseNumberInput(raw ?? "", { int });
  return n === null || !Number.isFinite(n) ? null : n;
};
const text = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

export interface InnerQtyTexts {
  none: string;
  noneTitle: string;
  options: string;
  /** "{boxes} caixas inner de {inner} na master" */
  optionTitle: string;
  isNone: string;
  /** "{boxes} caixas inner × {inner} = {master} peças por master." */
  fits: string;
  same: string;
  /** "{inner}", "{master}" */
  bigger: string;
  /** "{master}", "{inner}", "{rest}" */
  rest: string;
}

/**
 * Ao lado de "Peças por caixa inner": opções que fecham a master, "Sem caixa
 * inner" e a conferência com a master. Quem só lê vê só a conferência.
 */
export function InnerQtyHints({
  masterName,
  innerName,
  initialMaster,
  initialInner,
  disabled,
  intl,
  texts,
}: {
  masterName: string;
  innerName: string;
  initialMaster: number | null;
  initialInner: number | null;
  disabled?: boolean;
  intl: string;
  texts: InnerQtyTexts;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const values = useFormFields(ref, [masterName, innerName], {
    [masterName]: text(initialMaster),
    [innerName]: text(initialInner),
  });
  const master = numberOf(values[masterName], true);
  const inner = numberOf(values[innerName], true);
  const options = innerOptions(master);
  const check = checkInner(master, inner);
  const fmt = (n: number) => n.toLocaleString(intl);
  const message = (() => {
    if (!check) return null;
    const vars = {
      master: master !== null ? fmt(master) : "",
      inner: inner !== null ? fmt(inner) : "",
    };
    switch (check.kind) {
      case "none":
        return { warn: false, text: texts.isNone };
      case "fits":
        return {
          warn: false,
          text: fill(texts.fits, { ...vars, boxes: fmt(check.boxes) }),
        };
      case "same":
        return { warn: false, text: texts.same };
      case "bigger":
        return { warn: true, text: fill(texts.bigger, vars) };
      case "rest":
        return {
          warn: true,
          text: fill(texts.rest, { ...vars, rest: fmt(check.rest) }),
        };
    }
  })();
  const pick = (value: number) =>
    writeField(ref.current?.closest("form") ?? null, innerName, String(value));
  return (
    <span ref={ref} className="flex min-w-0 flex-col gap-1" data-inner-hints="">
      {!disabled ? (
        <span
          role="group"
          aria-label={texts.options}
          className="flex flex-wrap gap-1"
        >
          <button
            type="button"
            aria-pressed={inner === NO_INNER}
            title={texts.noneTitle}
            onClick={() => pick(NO_INNER)}
            data-inner-option="none"
            className={chip(inner === NO_INNER)}
          >
            {texts.none}
          </button>
          {master !== null
            ? options.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={inner === n}
                  title={fill(texts.optionTitle, {
                    boxes: fmt(master / n),
                    inner: fmt(n),
                  })}
                  onClick={() => pick(n)}
                  data-inner-option={n}
                  className={chip(inner === n)}
                >
                  {fmt(n)}
                </button>
              ))
            : null}
        </span>
      ) : null}
      {message ? (
        <span
          className={message.warn ? warnClass : "text-zinc-600"}
          data-inner-check={check?.kind}
          role={message.warn ? "status" : undefined}
        >
          {message.text}
        </span>
      ) : null}
    </span>
  );
}

export interface CartonSizeTexts {
  /** "{size}", "{cbm}" */
  size: string;
  /** "{side}" */
  side: string;
  /** "{cbm}" */
  cbm: string;
  /** "{type}", "{capacity}", "{n}" */
  fit: string;
}

/**
 * Aviso de caixa master grande demais (lado ≥ 120 cm ou ≥ 0,4 m³), junto das
 * medidas: com quantas caixas cabem num container, para dar a dimensão.
 */
export function CartonSizeWarning({
  sideNames,
  cbmName,
  initialSides,
  initialCbm,
  containerName,
  initialContainer = null,
  containers = [],
  intl,
  texts,
}: {
  /** Os três campos de medida (cm), em qualquer ordem. */
  sideNames: readonly [string, string, string];
  /** CBM digitado (vale quando faltam medidas). */
  cbmName?: string;
  initialSides: ReadonlyArray<number | null | undefined>;
  initialCbm: number | null;
  /** Tipo de container escolhido no formulário (para "cabem só ~N caixas"). */
  containerName?: string;
  initialContainer?: string | null;
  containers?: ReadonlyArray<{ code: string; capacityCbm: number }>;
  intl: string;
  texts: CartonSizeTexts;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const names = [
    ...sideNames,
    ...(cbmName ? [cbmName] : []),
    ...(containerName ? [containerName] : []),
  ];
  const values = useFormFields(
    ref,
    names,
    {
      [sideNames[0]]: text(initialSides[0]),
      [sideNames[1]]: text(initialSides[1]),
      [sideNames[2]]: text(initialSides[2]),
      ...(cbmName ? { [cbmName]: text(initialCbm) } : {}),
      ...(containerName ? { [containerName]: initialContainer ?? "" } : {}),
    },
    // CBM desabilitado (calculado pelas medidas salvas) não vai no envio.
    cbmName ? [cbmName] : [],
  );
  const check = oversizedCarton(
    sideNames.map((n) => numberOf(values[n])),
    cbmName ? numberOf(values[cbmName]) : initialCbm,
  );
  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(intl, { maximumFractionDigits: digits });
  let message: string | null = null;
  if (check) {
    const container =
      containers.find(
        (c) => containerName && c.code === values[containerName],
      ) ??
      containers.find((c) => c.code === "40HC") ??
      [...containers].sort((a, b) => b.capacityCbm - a.capacityCbm)[0] ??
      null;
    // "Cabem só ~N caixas" só quando o volume é o problema: caixa comprida e
    // fina (150 × 10 × 10) avisa pelo lado, sem um número que a contradiga.
    const cbm =
      check.kind !== "side" && check.cbm >= CARTON_CBM_WARN ? check.cbm : null;
    const n = cartonsPerContainer(container?.capacityCbm, cbm);
    const fit =
      container && n !== null
        ? " " +
          fill(texts.fit, {
            type: container.code,
            capacity: fmt(container.capacityCbm, 0),
            n: fmt(n, 0),
          })
        : "";
    message =
      check.kind === "size"
        ? fill(texts.size, {
            size: check.sides.map((s) => fmt(s)).join(" × "),
            cbm: fmt(check.cbm, 4),
          }) + fit
        : check.kind === "side"
          ? fill(texts.side, { side: fmt(check.side) })
          : fill(texts.cbm, { cbm: fmt(check.cbm, 4) }) + fit;
  }
  return (
    <span ref={ref} className={message ? "block" : "hidden"}>
      {message ? (
        <span
          className="block rounded-md bg-amber-50 px-2.5 py-1.5 text-[13px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200"
          role="status"
          data-carton-size-warning=""
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}

export interface PackageTypeTexts {
  options: string;
  /** "{value}" */
  colorLike: string;
  /** Nome traduzido de cada tipo (dica do atalho). */
  names: Record<PackageType, string>;
}

/**
 * Ao lado de "Embalagem": tipos comuns em um toque (o termo das fábricas) e
 * aviso quando o que foi digitado é uma cor.
 */
export function PackageTypeHints({
  name,
  initial,
  disabled,
  texts,
}: {
  name: string;
  initial: string | null;
  disabled?: boolean;
  texts: PackageTypeTexts;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const values = useFormFields(ref, [name], { [name]: initial ?? "" });
  const value = values[name] ?? "";
  const colorLike = looksLikeColor(value);
  const pick = (type: PackageType) =>
    writeField(ref.current?.closest("form") ?? null, name, type);
  return (
    <span
      ref={ref}
      className="flex min-w-0 flex-col gap-1"
      data-package-hints=""
    >
      {!disabled ? (
        <span
          role="group"
          aria-label={texts.options}
          className="flex flex-wrap gap-1"
        >
          {PACKAGE_TYPES.map((type) => {
            const on = samePackageType(value, type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                title={texts.names[type]}
                onClick={() => pick(type)}
                data-package-option={type}
                className={chip(on)}
              >
                {type}
              </button>
            );
          })}
        </span>
      ) : null}
      {colorLike ? (
        <span className={warnClass} role="status" data-package-color="">
          {fill(texts.colorLike, { value: value.trim() })}
        </span>
      ) : null}
    </span>
  );
}
