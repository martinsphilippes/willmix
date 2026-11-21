"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Alert,
  Badge,
  Field,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { MoneyInput } from "@/components/money-input";
import { parseNumberInput } from "@/lib/number-input";
import { formatMoneyDigits, moneySeparators } from "@/lib/money-mask";
import {
  boxesForSheet,
  dimsCbm,
  draftChangedFields,
  missingSheet,
  sheetWarnings,
  type SheetRequirement,
  type SheetWarning,
  type SupplierSheetDraft,
} from "@/lib/supplier-sheet";
import type {
  SupplierSheetBaseline,
  SupplierSheetField,
} from "@/lib/db/schema";

/*
 * Resposta do fornecedor à cotação de compra (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação"): por produto, o
 * preço, a ficha técnica (na primeira vez do par) e a foto na balança
 * (opcional, sobe na hora); depois as condições comerciais, todas
 * obrigatórias. Os campos ficam fora do <form> (atributo `form`) para a
 * foto ter o próprio formulário no meio; o que falta aparece embaixo e o
 * envio só sai completo (o servidor confere de novo).
 *
 * Moeda e preço (dono, 20/11/2026; docs/PURCHASE_DEMAND.md, "Moeda e preço
 * na cotação"): a moeda fica ao lado do preço unitário (RMB por padrão,
 * Dólar, Euro e Real), uma só para todos os itens da cotação; o preço é
 * digitado só com números e a vírgula entra sozinha, com o símbolo e o
 * separador da moeda (4000 = ¥ 40.00).
 *
 * Rascunho automático (dono, 20/11/2026; docs/PURCHASE_DEMAND.md, "Rascunho
 * automático da cotação"): a cada pausa da digitação, tudo o que está na tela
 * vai para o servidor (por login) e volta quando a página abre de novo; a foto
 * na balança salva antes de subir. Assim, uma página recarregada (versão nova
 * do portal no ar, iPad que recarrega a aba) não perde nada.
 */

/** A ordem do seletor (dono, 20/11/2026): RMB, Dólar, Euro e Real. */
const CURRENCY_ORDER = ["RMB", "USD", "EUR", "BRL"];

export interface QuoteSheetProduct {
  productId: string;
  name: string;
  quantityText: string;
  specification: string | null;
  scheduleText: string | null;
  desiredText: string | null;
  price: string;
  /** Quantidade de cada programação (ou a quantidade toda). */
  rounds: number[];
  soldBefore: boolean;
  ask: boolean;
  own: boolean;
  settledText: string | null;
  rejectedNote: string | null;
  draft: SupplierSheetDraft;
  baseline: SupplierSheetBaseline | null;
  askPhoto: boolean;
  photoUrl: string | null;
}

export interface QuoteAnswerLabels {
  product: string;
  quantity: string;
  spec: string;
  schedule: string;
  desiredAt: string;
  unitPrice: string;
  /** "Digite só os números: {typed} vira {example}." */
  priceHint: string;
  /** Mais de um item: a moeda vale para todos. */
  currencyAll: string;
  /** Nome de cada moeda no seletor ("Yuan (RMB)"). */
  currencyNames: Record<string, string>;
  currency: string;
  incoterm: string;
  leadTime: string;
  port: string;
  moq: string;
  note: string;
  answer: string;
  decline: string;
  disclaimerTitle: string;
  disclaimerBody: string;
  sheetTitle: string;
  hintDeclare: string;
  hintConfirm: string;
  hintOwn: string;
  settledHint: string;
  rejected: string;
  fields: Record<
    | SupplierSheetField
    | "noInner"
    | "noFactoryCode"
    | "cbmHint"
    | "cbmFromDims"
    | "box",
    string
  >;
  ours: string;
  changed: string;
  confirm: string;
  confirmHint: string;
  warnings: Record<SheetWarning["key"], string>;
  toSend: string;
  missingPrice: string;
  missingConfirm: string;
  missingProduct: string;
  yourBox: string;
  photoTitle: string;
  photoHint: string;
  photoAdd: string;
  photoReplace: string;
  photoSending: string;
  photoSent: string;
  photoUploading: string;
  photoFailed: string;
  noInner: string;
  /** Ficha em linhas (dono, 21/11/2026): o nome de cada linha e os curtos. */
  rows: Record<"pieces" | "box" | "weight" | "material", string>;
  short: Record<
    | "master"
    | "inner"
    | "length"
    | "width"
    | "height"
    | "or"
    | "net"
    | "gross"
    | "code",
    string
  >;
  unitPieces: string;
  unitDays: string;
  /** Rascunho automático: recuperado, salvando, salvo às {time}, falhou. */
  draftRestored: string;
  draftHint: string;
  draftSaving: string;
  draftSaved: string;
  draftError: string;
}

/** O que o rascunho guarda: os campos pelo nome do formulário, só texto. */
export type QuoteDraftValues = Record<string, string>;

type DraftSave = (input: {
  quoteId: string;
  values: QuoteDraftValues;
}) => Promise<{ ok: boolean; savedAt: string | null }>;

/** Espera depois da última tecla para salvar o rascunho. */
const DRAFT_DELAY_MS = 700;
/** Depois de enviar a resposta, nada de rascunho (o envio o apaga). */
const DRAFT_PAUSE_AFTER_SEND_MS = 8000;

const TEXT_SHEET_KEYS = [
  "masterBoxQty",
  "innerBoxQty",
  "boxLengthCm",
  "boxWidthCm",
  "boxHeightCm",
  "cbm",
  "netWeightKg",
  "grossWeightBoxKg",
  "material",
  "factoryItemCode",
] as const;
const FLAG_SHEET_KEYS = ["noInner", "noFactoryCode", "confirm"] as const;

const noSubscribe = () => () => {};

/**
 * Salva o rascunho a cada pausa (só quando algo mudou desde o último salvo)
 * e devolve a situação para a tela, mais `flush` (salvar já: antes da foto)
 * e `pause` (a resposta foi enviada).
 */
function useDraftAutosave(
  quoteId: string,
  values: QuoteDraftValues,
  save: DraftSave | null,
  restoredAt: string | null,
) {
  const snapshot = JSON.stringify(values);
  const latest = useRef(values);
  // O que já está no servidor (a tela aberta não salva sem mudança).
  const saved = useRef(snapshot);
  const inFlight = useRef<string | null>(null);
  const pausedAt = useRef(0);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    restoredAt ? "saved" : "idle",
  );
  const [savedAt, setSavedAt] = useState<string | null>(restoredAt);
  // O mesmo `saved`, para a tela: há mudança ainda não salva?
  const [savedSnap, setSavedSnap] = useState(snapshot);

  const flush = useCallback(async () => {
    if (!save) return;
    if (Date.now() - pausedAt.current < DRAFT_PAUSE_AFTER_SEND_MS) return;
    const current = latest.current;
    const snap = JSON.stringify(current);
    if (snap === saved.current || snap === inFlight.current) return;
    inFlight.current = snap;
    setStatus("saving");
    const result = await save({ quoteId, values: current }).catch(() => null);
    if (inFlight.current === snap) inFlight.current = null;
    if (result?.ok) {
      saved.current = snap;
      setSavedSnap(snap);
      if (result.savedAt) setSavedAt(result.savedAt);
      setStatus("saved");
    } else setStatus("error");
  }, [quoteId, save]);

  useEffect(() => {
    latest.current = values;
    if (!save || snapshot === saved.current) return;
    const timer = setTimeout(() => void flush(), DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot, values, save, flush]);

  const pause = useCallback(() => {
    pausedAt.current = Date.now();
  }, []);
  return { status, savedAt, flush, pause, dirty: snapshot !== savedSnap };
}

type SheetText = {
  masterBoxQty: string;
  innerBoxQty: string;
  noInner: boolean;
  boxLengthCm: string;
  boxWidthCm: string;
  boxHeightCm: string;
  cbm: string;
  netWeightKg: string;
  grossWeightBoxKg: string;
  material: string;
  factoryItemCode: string;
  noFactoryCode: boolean;
  confirm: boolean;
};

type NumberKey =
  | "masterBoxQty"
  | "innerBoxQty"
  | "boxLengthCm"
  | "boxWidthCm"
  | "boxHeightCm"
  | "cbm"
  | "netWeightKg"
  | "grossWeightBoxKg";

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

function readNumber(raw: string, int = false): number | null {
  const v = parseNumberInput(raw, { int });
  return v === null || !Number.isFinite(v) || v < 0 ? null : v;
}

function toDraft(s: SheetText): SupplierSheetDraft {
  return {
    masterBoxQty: readNumber(s.masterBoxQty, true),
    innerBoxQty: readNumber(s.innerBoxQty, true),
    noInner: s.noInner,
    boxLengthCm: readNumber(s.boxLengthCm),
    boxWidthCm: readNumber(s.boxWidthCm),
    boxHeightCm: readNumber(s.boxHeightCm),
    cbm: readNumber(s.cbm),
    netWeightKg: readNumber(s.netWeightKg),
    grossWeightBoxKg: readNumber(s.grossWeightBoxKg),
    material: s.material,
    factoryItemCode: s.factoryItemCode,
    noFactoryCode: s.noFactoryCode,
  };
}

export function QuoteAnswerForm({
  quoteId,
  action,
  photoAction,
  products,
  commercial,
  currencies,
  incoterms,
  labels: L,
  intl,
  cbmTolerancePercent,
  draft = null,
  draftAction = null,
}: {
  quoteId: string;
  action: (form: FormData) => void | Promise<void>;
  photoAction: (form: FormData) => void | Promise<void>;
  /** O rascunho salvo deste login (volta para a tela). */
  draft?: { values: QuoteDraftValues; savedAt: string } | null;
  /** Salva o rascunho (sem recarregar a página). */
  draftAction?: DraftSave | null;
  products: QuoteSheetProduct[];
  commercial: {
    currency: string;
    incoterm: string;
    leadTimeDays: string;
    port: string;
    moq: string;
    note: string;
  };
  currencies: readonly string[];
  incoterms: readonly string[];
  labels: QuoteAnswerLabels;
  intl: string;
  cbmTolerancePercent: number;
}) {
  const formId = `quote-answer-${quoteId}`;
  const fmt = (n: number | null | undefined, digits = 6) =>
    n === null || n === undefined
      ? ""
      : n.toLocaleString(intl, {
          maximumFractionDigits: digits,
          useGrouping: false,
        });
  const show = (n: number, digits = 4) =>
    n.toLocaleString(intl, { maximumFractionDigits: digits });
  // O rascunho deste login, quando há, vale mais que o que veio do servidor
  // (é o que estava na tela por último; enviar a resposta o apaga).
  const restored = draft?.values ?? {};
  const pick = (key: string, fallback: string) =>
    typeof restored[key] === "string" ? restored[key] : fallback;
  const pickFlag = (key: string, fallback: boolean) =>
    typeof restored[key] === "string" ? restored[key] === "1" : fallback;
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => [p.productId, pick(`price.${p.productId}`, p.price)]),
    ),
  );
  const [sheets, setSheets] = useState<Record<string, SheetText>>(() =>
    Object.fromEntries(
      products.map((p) => {
        const k = (field: string) => `sheet.${p.productId}.${field}`;
        return [
          p.productId,
          {
            masterBoxQty: pick(k("masterBoxQty"), fmt(p.draft.masterBoxQty)),
            innerBoxQty: pick(k("innerBoxQty"), fmt(p.draft.innerBoxQty)),
            noInner: pickFlag(k("noInner"), p.draft.noInner),
            boxLengthCm: pick(k("boxLengthCm"), fmt(p.draft.boxLengthCm)),
            boxWidthCm: pick(k("boxWidthCm"), fmt(p.draft.boxWidthCm)),
            boxHeightCm: pick(k("boxHeightCm"), fmt(p.draft.boxHeightCm)),
            cbm: pick(k("cbm"), fmt(p.draft.cbm)),
            netWeightKg: pick(k("netWeightKg"), fmt(p.draft.netWeightKg)),
            grossWeightBoxKg: pick(
              k("grossWeightBoxKg"),
              fmt(p.draft.grossWeightBoxKg),
            ),
            material: pick(k("material"), p.draft.material),
            factoryItemCode: pick(
              k("factoryItemCode"),
              p.draft.factoryItemCode,
            ),
            noFactoryCode: pickFlag(k("noFactoryCode"), p.draft.noFactoryCode),
            confirm: pickFlag(k("confirm"), false),
          },
        ];
      }),
    ),
  );
  const [terms, setTerms] = useState(() => ({
    currency: currencies.includes(pick("currency", ""))
      ? pick("currency", "")
      : commercial.currency,
    incoterm: incoterms.includes(pick("incoterm", ""))
      ? pick("incoterm", "")
      : commercial.incoterm,
    leadTimeDays: pick("leadTimeDays", commercial.leadTimeDays),
    port: pick("port", commercial.port),
    moq: pick("moq", commercial.moq),
    note: pick("note", commercial.note),
  }));
  const [tried, setTried] = useState(false);
  // Tudo o que está na tela, pelo nome do formulário (o rascunho).
  const draftValues = useMemo(() => {
    const out: QuoteDraftValues = { ...terms };
    for (const [pid, price] of Object.entries(prices))
      out[`price.${pid}`] = price;
    for (const [pid, sheet] of Object.entries(sheets)) {
      for (const key of TEXT_SHEET_KEYS)
        out[`sheet.${pid}.${key}`] = sheet[key];
      for (const key of FLAG_SHEET_KEYS)
        out[`sheet.${pid}.${key}`] = sheet[key] ? "1" : "0";
    }
    return out;
  }, [prices, sheets, terms]);
  const autosave = useDraftAutosave(
    quoteId,
    draftValues,
    draftAction,
    draft?.savedAt ?? null,
  );
  // A hora do rascunho no fuso de quem vê: só depois de abrir no aparelho.
  const onClient = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const savedTime =
    onClient && autosave.savedAt
      ? new Date(autosave.savedAt).toLocaleTimeString(intl, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const currencyOptions = [
    ...CURRENCY_ORDER.filter((c) => currencies.includes(c)),
    ...currencies.filter((c) => !CURRENCY_ORDER.includes(c)),
  ];
  // Exemplo da digitação na moeda escolhida: 4000 → 40.00 (ou 40,00).
  const priceHint = fill(L.priceHint, {
    typed: "4000",
    example: formatMoneyDigits("4000", moneySeparators(terms.currency)),
  });
  const setSheet = (pid: string, patch: Partial<SheetText>) =>
    setSheets((all) => ({ ...all, [pid]: { ...all[pid], ...patch } }));

  const reqLabel = (r: SheetRequirement) =>
    r === "box" ? L.fields.box : L.fields[r];

  // O que falta, por produto e nas condições comerciais.
  const missing: string[] = [];
  const missingKeys = new Set<string>();
  for (const p of products) {
    const parts: string[] = [];
    if (readNumber(prices[p.productId] ?? "") === null) {
      parts.push(L.missingPrice);
      missingKeys.add(`${p.productId}.price`);
    }
    if (p.ask) {
      const s = sheets[p.productId];
      for (const r of missingSheet(toDraft(s))) {
        parts.push(reqLabel(r));
        missingKeys.add(`${p.productId}.${r}`);
      }
      if (p.soldBefore && !s.confirm) {
        parts.push(L.missingConfirm);
        missingKeys.add(`${p.productId}.confirm`);
      }
    }
    if (parts.length)
      missing.push(
        fill(L.missingProduct, { product: p.name, fields: parts.join(", ") }),
      );
  }
  const lead = readNumber(terms.leadTimeDays, true);
  if (lead === null || !Number.isInteger(lead)) {
    missing.push(L.leadTime);
    missingKeys.add("leadTimeDays");
  }
  if (!terms.port.trim()) {
    missing.push(L.port);
    missingKeys.add("port");
  }
  const moq = readNumber(terms.moq);
  if (moq === null || moq <= 0) {
    missing.push(L.moq);
    missingKeys.add("moq");
  }
  const lacks = (key: string) => tried && missingKeys.has(key);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter?.getAttribute("name") === "decline") {
      autosave.pause();
      return;
    }
    if (!missing.length) {
      // Vai enviar: o rascunho para (o envio o apaga no servidor).
      autosave.pause();
      return;
    }
    event.preventDefault();
    setTried(true);
    // Leva até o primeiro campo que falta (depois de a tela marcar).
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-quote-form="${quoteId}"] [data-missing="true"]`,
        )
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }

  const showsDisclaimer = products.some((p) => p.ask && p.soldBefore);

  return (
    <div
      className="space-y-4"
      data-quote-answer-form
      data-quote-form={quoteId}
      // Campos com a letra da tela também no iPad (13px), como na Estratégia
      // de compra; no iPhone seguem com 16px (globals.css).
      data-compact-fields=""
    >
      {draft ? (
        <div data-quote-draft-restored>
          <Alert tone="info">{L.draftRestored}</Alert>
        </div>
      ) : null}
      {showsDisclaimer ? (
        <div data-quote-disclaimer>
          <Alert tone="brand">
            <p className="font-semibold">{L.disclaimerTitle}</p>
            <p className="mt-1">{L.disclaimerBody}</p>
          </Alert>
        </div>
      ) : null}

      {products.map((p) => {
        const s = sheets[p.productId];
        const draft = toDraft(s);
        const changed = p.soldBefore
          ? new Set(draftChangedFields(draft, p.baseline))
          : new Set<SupplierSheetField>();
        const warnings = p.ask
          ? sheetWarnings(draft, { cbmPercent: cbmTolerancePercent })
          : [];
        const fromDims = dimsCbm(
          draft.boxLengthCm,
          draft.boxWidthCm,
          draft.boxHeightCm,
        );
        const cbm = draft.cbm ?? fromDims;
        const box =
          draft.masterBoxQty && cbm
            ? boxesForSheet(p.rounds, { masterBoxQty: draft.masterBoxQty, cbm })
            : null;
        const oursText = (field: SupplierSheetField): string | null => {
          const b = p.baseline;
          if (!b) return null;
          if (field === "innerBoxQty")
            return b.innerBoxQty === null
              ? null
              : b.innerBoxQty === 0
                ? L.noInner
                : show(b.innerBoxQty, 0);
          if (
            field === "boxLengthCm" ||
            field === "boxWidthCm" ||
            field === "boxHeightCm"
          )
            return b.boxLengthCm !== null &&
              b.boxWidthCm !== null &&
              b.boxHeightCm !== null
              ? `${show(b.boxLengthCm, 2)} × ${show(b.boxWidthCm, 2)} × ${show(b.boxHeightCm, 2)}`
              : null;
          const v = b[field];
          if (v === null) return null;
          return typeof v === "number" ? show(v, field === "cbm" ? 4 : 3) : v;
        };
        const hintFor = (field: SupplierSheetField) =>
          changed.has(field) && oursText(field) !== null ? (
            <span
              className="text-amber-800"
              data-sheet-ours={`${p.productId}.${field}`}
            >
              {fill(L.ours, { value: oursText(field)! })}
            </span>
          ) : undefined;
        // Campo de número estreito, com a unidade dentro (dono, 21/11/2026:
        // card mais enxuto). O nome completo do campo vai para o leitor de
        // tela; amarelo = mudou do nosso cadastro; vermelho = falta.
        const cell = (
          key: NumberKey,
          opts: {
            width: string;
            unit?: string;
            int?: boolean;
            disabled?: boolean;
            lacking: boolean;
            placeholder?: string;
          },
        ) => (
          <span
            className={cx(
              "inline-flex h-8 items-center rounded-md border shadow-sm transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
              opts.lacking
                ? "border-red-400 bg-red-50"
                : changed.has(key)
                  ? "border-amber-400 bg-amber-50"
                  : "border-zinc-300 bg-white",
              opts.disabled && "opacity-50",
            )}
          >
            <input
              form={formId}
              name={`sheet.${p.productId}.${key}`}
              inputMode={opts.int ? "numeric" : "decimal"}
              value={s[key]}
              disabled={opts.disabled}
              placeholder={opts.placeholder}
              aria-label={L.fields[key]}
              title={L.fields[key]}
              onChange={(e) => setSheet(p.productId, { [key]: e.target.value })}
              data-sheet-field={`${p.productId}.${key}`}
              data-missing={opts.lacking ? "true" : undefined}
              className={cx(
                "h-full min-w-0 rounded-md border-0 bg-transparent px-2 text-right text-[13px] tabular-nums text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed",
                opts.width,
              )}
            />
            {opts.unit ? (
              <span className="pr-2 text-xs text-zinc-500">{opts.unit}</span>
            ) : null}
          </span>
        );
        // Uma linha da ficha: o nome à esquerda e os campos lado a lado.
        const row = (label: string, children: ReactNode, key: string) => (
          <div
            className="grid gap-1.5 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3"
            data-sheet-row={key}
          >
            {/* Alinhado com a primeira fileira de campos (h-8). */}
            <p className="text-xs font-medium text-zinc-600 sm:pt-2">{label}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {children}
            </div>
          </div>
        );
        const sub = (text: string, children: ReactNode) => (
          <label className="inline-flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">{text}</span>
            {children}
          </label>
        );
        return (
          <section
            key={p.productId}
            className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4"
            data-quote-item={p.productId}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">{p.name}</p>
                <p className="text-xs text-zinc-600">
                  {L.quantity}: {p.quantityText}
                </p>
                {p.specification ? (
                  <p
                    className="whitespace-pre-line text-xs text-zinc-600"
                    data-quote-item-spec
                  >
                    {L.spec}: {p.specification}
                  </p>
                ) : null}
                {p.scheduleText ? (
                  <p className="text-xs text-zinc-600" data-quote-item-schedule>
                    {L.schedule}: {p.scheduleText}
                  </p>
                ) : null}
                {p.desiredText ? (
                  <p className="text-xs text-zinc-600">
                    {L.desiredAt}: {p.desiredText}
                  </p>
                ) : null}
              </div>
              <div
                className="w-full shrink-0 space-y-1 sm:w-72"
                data-quote-price-box={p.productId}
              >
                {/* Rótulo só do preço: a moeda tem o próprio nome (aria). */}
                <label
                  htmlFor={`quote-price-${p.productId}`}
                  className="block text-xs font-medium leading-5 text-zinc-700"
                >
                  {L.unitPrice}
                </label>
                <input
                  type="hidden"
                  form={formId}
                  name="productId"
                  value={p.productId}
                />
                <div
                  className="flex items-center gap-2"
                  data-missing={
                    lacks(`${p.productId}.price`) ? "true" : undefined
                  }
                >
                  <Select
                    value={terms.currency}
                    onChange={(e) =>
                      setTerms({ ...terms, currency: e.target.value })
                    }
                    aria-label={L.currency}
                    className="w-auto shrink-0"
                    data-quote-currency={p.productId}
                  >
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {L.currencyNames[c] ?? c}
                      </option>
                    ))}
                  </Select>
                  <MoneyInput
                    id={`quote-price-${p.productId}`}
                    name={`price.${p.productId}`}
                    form={formId}
                    currency={terms.currency}
                    autoDecimal
                    value={prices[p.productId] ?? ""}
                    onValueChange={(v) =>
                      setPrices((all) => ({ ...all, [p.productId]: v }))
                    }
                    error={lacks(`${p.productId}.price`)}
                    inputData={{ "data-quote-price": p.productId }}
                    className="min-w-0 flex-1"
                  />
                </div>
                <p
                  className="text-xs text-zinc-500"
                  data-quote-price-hint={p.productId}
                >
                  {priceHint}
                  {products.length > 1 ? ` ${L.currencyAll}` : null}
                </p>
              </div>
            </div>

            {p.ask ? (
              <div
                className="mt-3 border-t border-zinc-100 pt-3"
                data-quote-sheet={p.productId}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold text-zinc-900">
                    {L.sheetTitle}
                  </p>
                  {changed.size ? (
                    <Badge tone="warning">{L.changed}</Badge>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    {p.own
                      ? L.hintOwn
                      : p.soldBefore
                        ? L.hintConfirm
                        : L.hintDeclare}
                  </p>
                </div>
                {p.rejectedNote ? (
                  <div className="mb-2" data-sheet-rejected={p.productId}>
                    <Alert tone="warning">
                      {fill(L.rejected, { note: p.rejectedNote })}
                    </Alert>
                  </div>
                ) : null}
                <div className="mt-1 divide-y divide-zinc-100">
                  {row(
                    L.rows.pieces,
                    <>
                      {sub(
                        L.short.master,
                        cell("masterBoxQty", {
                          width: "w-14",
                          unit: L.unitPieces,
                          int: true,
                          lacking: lacks(`${p.productId}.masterBoxQty`),
                        }),
                      )}
                      {hintFor("masterBoxQty")}
                      {sub(
                        L.short.inner,
                        cell("innerBoxQty", {
                          width: "w-14",
                          unit: L.unitPieces,
                          int: true,
                          disabled: s.noInner,
                          lacking: lacks(`${p.productId}.innerBoxQty`),
                        }),
                      )}
                      <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          form={formId}
                          name={`sheet.${p.productId}.noInner`}
                          value="1"
                          checked={s.noInner}
                          onChange={(e) =>
                            setSheet(p.productId, {
                              noInner: e.target.checked,
                            })
                          }
                          data-sheet-no-inner={p.productId}
                        />
                        {L.fields.noInner}
                      </label>
                      {hintFor("innerBoxQty")}
                    </>,
                    "pieces",
                  )}
                  {row(
                    L.rows.box,
                    <>
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        {cell("boxLengthCm", {
                          width: "w-12",
                          placeholder: L.short.length,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                        ×
                        {cell("boxWidthCm", {
                          width: "w-12",
                          placeholder: L.short.width,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                        ×
                        {cell("boxHeightCm", {
                          width: "w-12",
                          placeholder: L.short.height,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                        <span className="text-zinc-500">cm</span>
                      </span>
                      {hintFor("boxLengthCm")}
                      <span className="text-xs text-zinc-400">
                        {L.short.or}
                      </span>
                      {sub(
                        "CBM",
                        cell("cbm", {
                          width: "w-16",
                          unit: "m³",
                          lacking: lacks(`${p.productId}.box`),
                        }),
                      )}
                      {hintFor("cbm") ?? (
                        <span className="text-xs text-zinc-500">
                          {fromDims !== null
                            ? fill(L.fields.cbmFromDims, {
                                cbm: show(fromDims, 4),
                              })
                            : L.fields.cbmHint}
                        </span>
                      )}
                    </>,
                    "box",
                  )}
                  {row(
                    L.rows.weight,
                    <>
                      {sub(
                        L.short.net,
                        cell("netWeightKg", {
                          width: "w-14",
                          unit: "kg",
                          lacking: lacks(`${p.productId}.netWeightKg`),
                        }),
                      )}
                      {hintFor("netWeightKg")}
                      {sub(
                        L.short.gross,
                        cell("grossWeightBoxKg", {
                          width: "w-14",
                          unit: "kg",
                          lacking: lacks(`${p.productId}.grossWeightBoxKg`),
                        }),
                      )}
                      {hintFor("grossWeightBoxKg")}
                    </>,
                    "weight",
                  )}
                  {row(
                    L.rows.material,
                    <>
                      <Input
                        form={formId}
                        name={`sheet.${p.productId}.material`}
                        value={s.material}
                        maxLength={200}
                        aria-label={L.fields.material}
                        placeholder={L.fields.material}
                        onChange={(e) =>
                          setSheet(p.productId, { material: e.target.value })
                        }
                        data-sheet-field={`${p.productId}.material`}
                        data-missing={
                          lacks(`${p.productId}.material`) ? "true" : undefined
                        }
                        className={cx(
                          "w-36",
                          changed.has("material") &&
                            "border-amber-400 bg-amber-50",
                          lacks(`${p.productId}.material`) &&
                            "border-red-400 bg-red-50",
                        )}
                      />
                      {hintFor("material")}
                      {sub(
                        L.short.code,
                        <Input
                          form={formId}
                          name={`sheet.${p.productId}.factoryItemCode`}
                          value={s.factoryItemCode}
                          maxLength={80}
                          disabled={s.noFactoryCode}
                          aria-label={L.fields.factoryItemCode}
                          onChange={(e) =>
                            setSheet(p.productId, {
                              factoryItemCode: e.target.value,
                            })
                          }
                          data-sheet-field={`${p.productId}.factoryItemCode`}
                          data-missing={
                            lacks(`${p.productId}.factoryItemCode`)
                              ? "true"
                              : undefined
                          }
                          className={cx(
                            "w-28",
                            changed.has("factoryItemCode") &&
                              "border-amber-400 bg-amber-50",
                            lacks(`${p.productId}.factoryItemCode`) &&
                              "border-red-400 bg-red-50",
                          )}
                        />,
                      )}
                      <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          form={formId}
                          name={`sheet.${p.productId}.noFactoryCode`}
                          value="1"
                          checked={s.noFactoryCode}
                          onChange={(e) =>
                            setSheet(p.productId, {
                              noFactoryCode: e.target.checked,
                            })
                          }
                          data-sheet-no-code={p.productId}
                        />
                        {L.fields.noFactoryCode}
                      </label>
                      {hintFor("factoryItemCode")}
                    </>,
                    "material",
                  )}
                </div>
                {box ? (
                  <p
                    className="mt-2 text-xs text-zinc-600"
                    data-sheet-your-box={p.productId}
                  >
                    {fill(L.yourBox, {
                      boxes: show(box.boxes, 0),
                      cbm: show(box.cbm, 3),
                    })}
                  </p>
                ) : null}
                {warnings.length ? (
                  <ul
                    className="mt-2 space-y-1"
                    data-sheet-warnings={p.productId}
                  >
                    {warnings.map((w) => (
                      <li
                        key={w.key}
                        className="text-xs text-amber-800"
                        data-sheet-warning={w.key}
                      >
                        ⚠{" "}
                        {fill(L.warnings[w.key], {
                          dims:
                            w.key === "cbm_dims_mismatch"
                              ? show(w.dimsCbm, 4)
                              : "",
                          cbm:
                            w.key === "cbm_dims_mismatch" ? show(w.cbm, 4) : "",
                          net:
                            w.key === "gross_below_net"
                              ? show(w.netBoxKg, 3)
                              : "",
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {p.soldBefore ? (
                  <label
                    className={cx(
                      "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                      lacks(`${p.productId}.confirm`)
                        ? "border-red-400 bg-red-50"
                        : "border-zinc-200 bg-zinc-50",
                    )}
                    data-missing={
                      lacks(`${p.productId}.confirm`) ? "true" : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      form={formId}
                      name={`sheet.${p.productId}.confirm`}
                      value="1"
                      checked={s.confirm}
                      onChange={(e) =>
                        setSheet(p.productId, { confirm: e.target.checked })
                      }
                      className="mt-0.5"
                      data-sheet-confirm={p.productId}
                    />
                    <span>
                      <span className="font-medium text-zinc-900">
                        {L.confirm}
                      </span>
                      <span className="block text-xs text-zinc-600">
                        {L.confirmHint}
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>
            ) : p.settledText ? (
              <p
                className="mt-2 text-xs text-zinc-600"
                data-sheet-settled={p.productId}
              >
                ✓ {p.settledText} {L.settledHint}
              </p>
            ) : null}

            {p.askPhoto || p.photoUrl ? (
              <div
                className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3"
                data-quote-photo={p.productId}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {L.photoTitle}
                  </p>
                  <p className="text-xs text-zinc-600">{L.photoHint}</p>
                </div>
                {p.photoUrl ? (
                  <a
                    href={p.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-emerald-300"
                    title={L.photoSent}
                    data-quote-photo-sent={p.productId}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                    <img
                      src={p.photoUrl}
                      alt={L.photoSent}
                      className="h-12 w-12 object-cover"
                    />
                  </a>
                ) : null}
                <form
                  action={photoAction}
                  // Antes de a foto subir, o rascunho vai para o servidor: se
                  // a página recarregar, o que foi digitado volta.
                  onSubmit={() => void autosave.flush()}
                  className="shrink-0"
                  data-quote-photo-form={p.productId}
                >
                  <input type="hidden" name="quoteId" value={quoteId} />
                  <input type="hidden" name="productId" value={p.productId} />
                  <PhotoInput
                    name="photos"
                    multiple={false}
                    label={p.photoUrl ? L.photoReplace : L.photoAdd}
                    pendingLabel={L.photoSending}
                    capture={false}
                    maxDimension={1400}
                    quality={0.78}
                    autoSubmit
                    compact
                    dense
                    direct
                    uploadingLabel={L.photoUploading}
                    failedLabel={L.photoFailed}
                  />
                </form>
              </div>
            ) : null}
          </section>
        );
      })}

      <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
        {/* A moeda fica ao lado do preço de cada item (uma para todos).
            Campos do tamanho do que se digita, numa linha (dono, 21/11/2026). */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label={L.incoterm}>
            <Select
              form={formId}
              name="incoterm"
              value={terms.incoterm}
              onChange={(e) => setTerms({ ...terms, incoterm: e.target.value })}
              className="w-24"
              data-quote-incoterm
            >
              {incoterms.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L.leadTime}>
            <span
              className={cx(
                "inline-flex h-8 items-center rounded-md border shadow-sm transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
                lacks("leadTimeDays")
                  ? "border-red-400 bg-red-50"
                  : "border-zinc-300 bg-white",
              )}
            >
              <input
                form={formId}
                name="leadTimeDays"
                inputMode="numeric"
                value={terms.leadTimeDays}
                onChange={(e) =>
                  setTerms({ ...terms, leadTimeDays: e.target.value })
                }
                data-quote-lead
                data-missing={lacks("leadTimeDays") ? "true" : undefined}
                className="h-full w-14 min-w-0 rounded-md border-0 bg-transparent px-2 text-right text-[13px] tabular-nums text-zinc-900 focus:outline-none"
              />
              <span className="pr-2 text-xs text-zinc-500">{L.unitDays}</span>
            </span>
          </Field>
          <Field label={L.port}>
            <Input
              form={formId}
              name="port"
              maxLength={120}
              value={terms.port}
              onChange={(e) => setTerms({ ...terms, port: e.target.value })}
              data-quote-port
              data-missing={lacks("port") ? "true" : undefined}
              className={cx(
                "w-48",
                lacks("port") && "border-red-400 bg-red-50",
              )}
            />
          </Field>
          <Field label={L.moq}>
            <Input
              form={formId}
              name="moq"
              inputMode="numeric"
              value={terms.moq}
              onChange={(e) => setTerms({ ...terms, moq: e.target.value })}
              data-quote-moq
              data-missing={lacks("moq") ? "true" : undefined}
              className={cx(
                "w-28 text-right tabular-nums",
                lacks("moq") && "border-red-400 bg-red-50",
              )}
            />
          </Field>
        </div>
        <div className="mt-3 max-w-2xl">
          <Field label={L.note}>
            <Textarea
              form={formId}
              name="note"
              rows={2}
              maxLength={2000}
              value={terms.note}
              onChange={(e) => setTerms({ ...terms, note: e.target.value })}
            />
          </Field>
        </div>
        <form
          id={formId}
          action={action}
          onSubmit={onSubmit}
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="currency" value={terms.currency} />
          {missing.length ? (
            <div
              className={cx(
                "rounded-lg border px-3 py-2 text-xs",
                tried
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700",
              )}
              data-sheet-missing
            >
              <p className="font-medium">{L.toSend}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton data-quote-submit>{L.answer}</SubmitButton>
            <SubmitButton
              name="decline"
              value="1"
              variant="secondary"
              data-quote-decline
            >
              {L.decline}
            </SubmitButton>
            <p
              className={cx(
                "text-xs",
                autosave.status === "error"
                  ? "text-amber-800"
                  : "text-zinc-500",
              )}
              role="status"
              aria-live="polite"
              data-quote-draft-status={autosave.status}
              data-quote-draft-dirty={autosave.dirty ? "1" : "0"}
            >
              {autosave.status === "saving"
                ? L.draftSaving
                : autosave.status === "error"
                  ? L.draftError
                  : autosave.status === "saved" && savedTime
                    ? fill(L.draftSaved, { time: savedTime })
                    : L.draftHint}
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
