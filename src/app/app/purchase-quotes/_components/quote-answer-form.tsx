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
import { Alert, Badge, Select, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { MoneyInput } from "@/components/money-input";
import { FxNoteLine, loadFx, prefetchFx } from "@/components/fx-conversion";
import { convertAmount, convertedText, sameCurrency } from "@/lib/fx-convert";
import { CURRENCY_SYMBOL } from "@/lib/workflow/money";
import { parseNumberInput } from "@/lib/number-input";
import {
  formatMoneyDigits,
  moneyDigitsOfValue,
  moneySeparators,
} from "@/lib/money-mask";
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
import type { QuoteInnerState } from "@/lib/quote-inner";
import type {
  SupplierSheetBaseline,
  SupplierSheetField,
} from "@/lib/db/schema";
import { MaterialPicker, type MaterialPickerOption } from "./material-picker";

/*
 * Resposta do fornecedor à cotação de compra (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação"): por produto, o
 * preço, a ficha técnica (na primeira vez do par) e a foto na balança
 * (opcional, sobe na hora); depois as condições comerciais, todas
 * obrigatórias. Os campos ficam fora do <form> (atributo `form`) para a
 * foto ter o próprio formulário no meio; o que falta aparece embaixo e o
 * envio só sai completo (o servidor confere de novo).
 *
 * Tela em duas colunas (dono, 21/11/2026; docs/PURCHASE_DEMAND.md, "Inner
 * do cliente, material do catálogo e Sem peso"): à esquerda, um terço com o
 * resumo do produto, a especificação e as programações; à direita, o preço,
 * a moeda e a ficha técnica em linhas (peças, código e material; as medidas
 * e o CBM da caixa master; os pesos com "Sem peso"); embaixo, os termos
 * comerciais e o envio. Controles de 36 px. O inner só aparece quando o
 * cliente exige (travado); o material vem só do catálogo.
 *
 * Moeda e preço (dono, 20/11/2026): a moeda fica ao lado do preço unitário
 * (RMB por padrão, Dólar, Euro e Real), uma só para todos os itens da
 * cotação; o preço é digitado só com números e a vírgula entra sozinha.
 *
 * Rascunho automático (dono, 20/11/2026): a cada pausa da digitação, tudo o
 * que está na tela vai para o servidor (por login) e volta quando a página
 * abre de novo; a foto na balança salva antes de subir.
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
  /** Caixa inner exigida pelo cliente (nada, travada ou a definir). */
  inner: QuoteInnerState;
  /** Material de texto livre de antes do catálogo (para ele escolher de novo). */
  legacyMaterial: string | null;
}

/** Um material do catálogo na tela (o nome no idioma dela e o português). */
export interface QuoteMaterialOption extends MaterialPickerOption {
  namePt: string;
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
  /** Aviso "Atualização da ficha do produto" (dono, 21/11/2026). */
  noticeTitle: string;
  noticeBody: string;
  termsTitle: string;
  sheetTitle: string;
  hintDeclare: string;
  hintConfirm: string;
  hintOwn: string;
  settledHint: string;
  rejected: string;
  fields: Record<
    SupplierSheetField | "noFactoryCode" | "cbmHint" | "cbmFromDims" | "box",
    string
  >;
  /** Os rótulos curtos dos campos da ficha, acima de cada um. */
  f: Record<
    | "master"
    | "code"
    | "material"
    | "length"
    | "width"
    | "height"
    | "cbm"
    | "net"
    | "gross",
    string
  >;
  grossUnknown: string;
  grossUnknownHint: string;
  grossNotGiven: string;
  inner: string;
  innerRequired: string;
  innerRequiredHint: string;
  innerPending: string;
  material: {
    placeholder: string;
    empty: string;
    missing: string;
    remove: string;
    /** "Material digitado antes: {text}. Escolha no catálogo." */
    legacy: string;
  };
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
  "boxLengthCm",
  "boxWidthCm",
  "boxHeightCm",
  "cbm",
  "netWeightKg",
  "grossWeightBoxKg",
  "factoryItemCode",
] as const;
const FLAG_SHEET_KEYS = ["grossUnknown", "noFactoryCode", "confirm"] as const;

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
  boxLengthCm: string;
  boxWidthCm: string;
  boxHeightCm: string;
  cbm: string;
  netWeightKg: string;
  /** O número digitado; com "Sem peso" fica guardado (desmarcar devolve). */
  grossWeightBoxKg: string;
  grossUnknown: boolean;
  materialIds: string[];
  factoryItemCode: string;
  noFactoryCode: boolean;
  confirm: boolean;
};

type NumberKey =
  | "masterBoxQty"
  | "boxLengthCm"
  | "boxWidthCm"
  | "boxHeightCm"
  | "cbm"
  | "netWeightKg"
  | "grossWeightBoxKg";

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

/** "US$ 1.02": o preço como aparece no campo (separador da moeda). */
function moneyText(n: number, code: string) {
  const c = code === "RMB" ? "CNY" : code;
  const symbol = (CURRENCY_SYMBOL as Record<string, string>)[c] ?? code;
  return `${symbol} ${formatMoneyDigits(moneyDigitsOfValue(n, 2), moneySeparators(code), 2)}`;
}

function readNumber(raw: string, int = false): number | null {
  const v = parseNumberInput(raw, { int });
  return v === null || !Number.isFinite(v) || v < 0 ? null : v;
}

function toDraft(s: SheetText): SupplierSheetDraft {
  return {
    masterBoxQty: readNumber(s.masterBoxQty, true),
    boxLengthCm: readNumber(s.boxLengthCm),
    boxWidthCm: readNumber(s.boxWidthCm),
    boxHeightCm: readNumber(s.boxHeightCm),
    cbm: readNumber(s.cbm),
    netWeightKg: readNumber(s.netWeightKg),
    grossWeightBoxKg: readNumber(s.grossWeightBoxKg),
    grossUnknown: s.grossUnknown,
    materialIds: s.materialIds,
    factoryItemCode: s.factoryItemCode,
    noFactoryCode: s.noFactoryCode,
  };
}

/** Rótulo de campo da tela (pequeno, legível, acima do controle). */
function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-medium leading-4 text-zinc-700"
    >
      {children}
    </label>
  );
}

const textBox =
  "block h-9 w-full min-w-0 rounded-md border px-2.5 text-[13px] text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

export function QuoteAnswerForm({
  quoteId,
  action,
  photoAction,
  products,
  materials,
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
  /** O catálogo de materiais ativo (dono, 21/11/2026). */
  materials: QuoteMaterialOption[];
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
  const catalog = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials],
  );
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
            boxLengthCm: pick(k("boxLengthCm"), fmt(p.draft.boxLengthCm)),
            boxWidthCm: pick(k("boxWidthCm"), fmt(p.draft.boxWidthCm)),
            boxHeightCm: pick(k("boxHeightCm"), fmt(p.draft.boxHeightCm)),
            cbm: pick(k("cbm"), fmt(p.draft.cbm)),
            netWeightKg: pick(k("netWeightKg"), fmt(p.draft.netWeightKg)),
            grossWeightBoxKg: pick(
              k("grossWeightBoxKg"),
              fmt(p.draft.grossWeightBoxKg),
            ),
            grossUnknown: pickFlag(k("grossUnknown"), p.draft.grossUnknown),
            // Só ids do catálogo ativo voltam para a escolha.
            materialIds: pick(k("materialIds"), p.draft.materialIds.join(","))
              .split(",")
              .filter((id) => catalog.has(id)),
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
  // Trocar a moeda converte os preços já digitados (dono, 21/11/2026): pelo
  // câmbio do dia do portal, com o aviso em cada preço e "Manter os valores
  // digitados" (volta aos números de antes, na moeda nova).
  const [fxNote, setFxNote] = useState<{
    before: Record<string, string>;
    texts: Record<string, string>;
    keep: string | null;
  } | null>(null);
  const fxSeq = useRef(0);
  function changeCurrency(next: string) {
    const from = terms.currency;
    setTerms({ ...terms, currency: next });
    const id = ++fxSeq.current;
    const before = prices;
    const typed = Object.entries(before).flatMap(([pid, v]) => {
      const n = readNumber(v);
      return n !== null && n > 0 ? [[pid, n] as const] : [];
    });
    if (!from || sameCurrency(from, next) || typed.length === 0) {
      setFxNote(null);
      return;
    }
    void loadFx().then((fx) => {
      if (id !== fxSeq.current || !fx) return;
      const after = { ...before };
      const texts: Record<string, string> = {};
      for (const [pid, n] of typed) {
        const converted = convertAmount(n, from, next, fx.rates, 2);
        if (converted === null) {
          setFxNote({
            before,
            texts: Object.fromEntries(typed.map(([p]) => [p, fx.labels.none])),
            keep: null,
          });
          return;
        }
        after[pid] = converted.toFixed(2);
        texts[pid] = convertedText(fx, moneyText(n, from));
      }
      setPrices(after);
      setFxNote({ before, texts, keep: fx.labels.keepAll });
    });
  }
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
      out[`sheet.${pid}.materialIds`] = sheet.materialIds.join(",");
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
      for (const r of missingSheet(toDraft(s), catalog)) {
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

  // O aviso vale para quem preenche a ficha de algum produto.
  const showsNotice = products.some((p) => p.ask);

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

      {products.map((p) => {
        const s = sheets[p.productId];
        const draft = toDraft(s);
        const materialTextPt = s.materialIds
          .map((id) => catalog.get(id)?.namePt)
          .filter(Boolean)
          .join(" / ");
        const changed = p.soldBefore
          ? new Set(draftChangedFields(draft, p.baseline, materialTextPt))
          : new Set<SupplierSheetField>();
        const innerRequired = p.inner.kind === "required" ? p.inner.qty : null;
        const warnings = p.ask
          ? sheetWarnings(
              draft,
              { cbmPercent: cbmTolerancePercent },
              innerRequired,
            )
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
            <p
              className="mt-1 text-xs text-amber-800"
              data-sheet-ours={`${p.productId}.${field}`}
            >
              {fill(L.ours, { value: oursText(field)! })}
            </p>
          ) : null;
        const legacy =
          !s.materialIds.length &&
          (restored[`sheet.${p.productId}.material`] || p.legacyMaterial)
            ? restored[`sheet.${p.productId}.material`] || p.legacyMaterial
            : null;
        // Campo de número com a unidade dentro, 36 px. Amarelo = mudou do
        // nosso cadastro; vermelho = falta.
        const numberBox = (
          key: NumberKey,
          opts: {
            label: string;
            unit?: string;
            int?: boolean;
            disabled?: boolean;
            lacking: boolean;
            /** Mostra vazio (o valor continua guardado). */
            blank?: boolean;
            placeholder?: string;
          },
        ) => {
          const id = `quote-${p.productId}-${key}`;
          return (
            <div className="min-w-0">
              <FieldLabel htmlFor={id}>{opts.label}</FieldLabel>
              <span
                className={cx(
                  "flex h-9 items-center rounded-md border shadow-sm transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
                  opts.lacking
                    ? "border-red-400 bg-red-50"
                    : opts.disabled
                      ? "border-zinc-200 bg-zinc-100"
                      : changed.has(key)
                        ? "border-amber-400 bg-amber-50"
                        : "border-zinc-300 bg-white",
                )}
              >
                <input
                  id={id}
                  form={formId}
                  name={`sheet.${p.productId}.${key}`}
                  inputMode={opts.int ? "numeric" : "decimal"}
                  autoComplete="off"
                  value={opts.blank ? "" : s[key]}
                  disabled={opts.disabled}
                  placeholder={opts.placeholder}
                  onChange={(e) =>
                    setSheet(p.productId, { [key]: e.target.value })
                  }
                  data-sheet-field={`${p.productId}.${key}`}
                  data-missing={opts.lacking ? "true" : undefined}
                  className="h-full w-full min-w-0 rounded-md border-0 bg-transparent px-2.5 text-right text-[13px] tabular-nums text-zinc-900 placeholder:text-left placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed"
                />
                {opts.unit ? (
                  <span className="shrink-0 pr-2.5 text-xs text-zinc-500">
                    {opts.unit}
                  </span>
                ) : null}
              </span>
            </div>
          );
        };
        return (
          <section
            key={p.productId}
            className="rounded-xl border border-zinc-200 bg-white"
            data-quote-item={p.productId}
          >
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              {/* Coluna esquerda (um terço): o produto pedido. */}
              <div
                className="min-w-0 space-y-2 border-b border-zinc-100 p-3 sm:p-4 md:border-b-0 md:border-r"
                data-quote-item-summary={p.productId}
              >
                <p className="font-semibold leading-5 text-zinc-900">
                  {p.name}
                </p>
                <p className="text-sm text-zinc-700">
                  <span className="font-medium">{L.quantity}:</span>{" "}
                  {p.quantityText}
                </p>
                {p.specification ? (
                  <p
                    className="whitespace-pre-line text-xs leading-5 text-zinc-600"
                    data-quote-item-spec
                  >
                    {p.specification}
                  </p>
                ) : null}
                {p.scheduleText ? (
                  <div
                    className="border-t border-zinc-100 pt-2 text-xs text-zinc-700"
                    data-quote-item-schedule
                  >
                    <p className="font-medium text-zinc-800">{L.schedule}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {p.scheduleText.split(" · ").map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {p.desiredText ? (
                  <p className="text-xs text-zinc-600">
                    {L.desiredAt}: {p.desiredText}
                  </p>
                ) : null}
              </div>

              {/* Coluna direita: preço, moeda e ficha técnica. */}
              <div className="min-w-0 space-y-3 p-3 sm:p-4">
                {showsNotice && p === products.find((x) => x.ask) ? (
                  <div
                    className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    data-quote-sheet-notice
                    data-quote-disclaimer
                  >
                    <span aria-hidden className="text-sm text-amber-700">
                      ⓘ
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">
                        {L.noticeTitle}
                      </p>
                      <p className="text-xs leading-5 text-zinc-700">
                        {L.noticeBody}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]"
                  data-quote-price-box={p.productId}
                >
                  <input
                    type="hidden"
                    form={formId}
                    name="productId"
                    value={p.productId}
                  />
                  <div
                    className="min-w-0"
                    data-missing={
                      lacks(`${p.productId}.price`) ? "true" : undefined
                    }
                  >
                    <FieldLabel htmlFor={`quote-price-${p.productId}`}>
                      {L.unitPrice}
                    </FieldLabel>
                    <MoneyInput
                      id={`quote-price-${p.productId}`}
                      name={`price.${p.productId}`}
                      form={formId}
                      currency={terms.currency}
                      autoDecimal
                      value={prices[p.productId] ?? ""}
                      onValueChange={(v) => {
                        fxSeq.current++;
                        setFxNote(null);
                        setPrices((all) => ({ ...all, [p.productId]: v }));
                      }}
                      error={lacks(`${p.productId}.price`)}
                      inputData={{ "data-quote-price": p.productId }}
                      className="min-w-0"
                    />
                    <p
                      className="mt-1 text-xs text-zinc-500"
                      data-quote-price-hint={p.productId}
                    >
                      {priceHint}
                      {products.length > 1 ? ` ${L.currencyAll}` : null}
                    </p>
                    {fxNote?.texts[p.productId] ? (
                      <FxNoteLine
                        note={{
                          text: fxNote.texts[p.productId],
                          keep: fxNote.keep,
                        }}
                        onKeep={() => {
                          setPrices(fxNote.before);
                          setFxNote(null);
                        }}
                        className="mt-1"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <FieldLabel htmlFor={`quote-currency-${p.productId}`}>
                      {L.currency}
                    </FieldLabel>
                    <Select
                      id={`quote-currency-${p.productId}`}
                      value={terms.currency}
                      onFocus={prefetchFx}
                      onChange={(e) => changeCurrency(e.target.value)}
                      className="h-9! w-full"
                      data-quote-currency={p.productId}
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>
                          {L.currencyNames[c] ?? c}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {p.ask ? (
                  <div
                    className="space-y-3 border-t border-zinc-100 pt-3"
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
                      <div data-sheet-rejected={p.productId}>
                        <Alert tone="warning">
                          {fill(L.rejected, { note: p.rejectedNote })}
                        </Alert>
                      </div>
                    ) : null}

                    {/* Linha 1: peças por master, código na fábrica e material. */}
                    <div
                      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.5fr)]"
                      data-sheet-row="pieces"
                    >
                      <div className="min-w-0">
                        {numberBox("masterBoxQty", {
                          label: L.f.master,
                          unit: L.unitPieces,
                          int: true,
                          lacking: lacks(`${p.productId}.masterBoxQty`),
                        })}
                        {hintFor("masterBoxQty")}
                      </div>
                      <div className="min-w-0">
                        <FieldLabel htmlFor={`quote-${p.productId}-code`}>
                          {L.f.code}
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                          <input
                            id={`quote-${p.productId}-code`}
                            form={formId}
                            name={`sheet.${p.productId}.factoryItemCode`}
                            value={s.noFactoryCode ? "" : s.factoryItemCode}
                            maxLength={80}
                            disabled={s.noFactoryCode}
                            autoComplete="off"
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
                              textBox,
                              lacks(`${p.productId}.factoryItemCode`)
                                ? "border-red-400 bg-red-50"
                                : changed.has("factoryItemCode")
                                  ? "border-amber-400 bg-amber-50"
                                  : "border-zinc-300 bg-white",
                            )}
                          />
                          <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-zinc-700">
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
                              className="h-4 w-4 accent-brand-700"
                              data-sheet-no-code={p.productId}
                            />
                            {L.fields.noFactoryCode}
                          </label>
                        </div>
                        {hintFor("factoryItemCode")}
                      </div>
                      <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                        <FieldLabel>{L.f.material}</FieldLabel>
                        <MaterialPicker
                          options={materials}
                          value={s.materialIds}
                          onChange={(ids) =>
                            setSheet(p.productId, { materialIds: ids })
                          }
                          name={`sheet.${p.productId}.materialIds`}
                          form={formId}
                          lacking={lacks(`${p.productId}.material`)}
                          changed={changed.has("material")}
                          labels={{ field: L.f.material, ...L.material }}
                          dataField={`${p.productId}.material`}
                        />
                        {legacy ? (
                          <p
                            className="mt-1 text-xs text-amber-800"
                            data-material-legacy={p.productId}
                          >
                            {fill(L.material.legacy, { text: legacy })}
                          </p>
                        ) : null}
                        {hintFor("material")}
                      </div>
                    </div>
                    {/* Caixa inner só quando o cliente exige (dono, 21/11/2026):
                        travada, numa linha própria. */}
                    {innerRequired ? (
                      <div
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5"
                        data-quote-inner={p.productId}
                        data-quote-inner-qty={innerRequired}
                      >
                        <label
                          htmlFor={`quote-${p.productId}-inner`}
                          className="text-xs font-medium text-zinc-700"
                        >
                          {L.inner}
                        </label>
                        <span className="flex h-9 w-28 items-center rounded-md border border-zinc-200 bg-zinc-100">
                          <input
                            id={`quote-${p.productId}-inner`}
                            value={show(innerRequired, 0)}
                            readOnly
                            aria-readonly
                            tabIndex={-1}
                            className="h-full w-full min-w-0 border-0 bg-transparent px-2.5 text-right text-[13px] font-semibold tabular-nums text-zinc-900 focus:outline-none"
                          />
                          <span className="shrink-0 pr-2.5 text-xs text-zinc-500">
                            {L.unitPieces}
                          </span>
                        </span>
                        <Badge tone="info">{L.innerRequired}</Badge>
                        <span className="text-xs text-zinc-600">
                          {L.innerRequiredHint}
                        </span>
                      </div>
                    ) : p.inner.kind === "pending" ? (
                      <p
                        className="text-xs text-zinc-600"
                        data-quote-inner-pending={p.productId}
                      >
                        {L.innerPending}
                      </p>
                    ) : null}

                    {/* Linha 2: a caixa master, três medidas em cm ou o CBM. */}
                    <div data-sheet-row="box">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {numberBox("boxLengthCm", {
                          label: L.f.length,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                        {numberBox("boxWidthCm", {
                          label: L.f.width,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                        {numberBox("boxHeightCm", {
                          label: L.f.height,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                        {numberBox("cbm", {
                          label: L.f.cbm,
                          lacking: lacks(`${p.productId}.box`),
                        })}
                      </div>
                      {hintFor("boxLengthCm")}
                      {hintFor("cbm") ?? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {fromDims !== null
                            ? fill(L.fields.cbmFromDims, {
                                cbm: show(fromDims, 4),
                              })
                            : L.fields.cbmHint}
                        </p>
                      )}
                    </div>

                    {/* Linha 3: pesos, com "Sem peso" ao lado do bruto. */}
                    <div
                      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      data-sheet-row="weight"
                    >
                      <div className="min-w-0">
                        {numberBox("netWeightKg", {
                          label: L.f.net,
                          unit: "kg",
                          lacking: lacks(`${p.productId}.netWeightKg`),
                        })}
                        {hintFor("netWeightKg")}
                      </div>
                      <div className="min-w-0">
                        {numberBox("grossWeightBoxKg", {
                          label: L.f.gross,
                          unit: "kg",
                          disabled: s.grossUnknown,
                          blank: s.grossUnknown,
                          lacking: lacks(`${p.productId}.grossWeightBoxKg`),
                        })}
                        {s.grossUnknown ? (
                          <p
                            className="mt-1 text-xs text-zinc-600"
                            data-sheet-gross-unknown-text={p.productId}
                          >
                            {L.grossNotGiven}
                          </p>
                        ) : (
                          hintFor("grossWeightBoxKg")
                        )}
                      </div>
                      <div className="min-w-0 sm:pt-5">
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 text-[13px] font-medium text-zinc-800">
                          <input
                            type="checkbox"
                            form={formId}
                            name={`sheet.${p.productId}.grossUnknown`}
                            value="1"
                            checked={s.grossUnknown}
                            onChange={(e) =>
                              setSheet(p.productId, {
                                grossUnknown: e.target.checked,
                              })
                            }
                            aria-describedby={`quote-${p.productId}-gross-hint`}
                            className="h-4 w-4 accent-brand-700"
                            data-sheet-gross-unknown={p.productId}
                          />
                          {L.grossUnknown}
                        </label>
                        <p
                          id={`quote-${p.productId}-gross-hint`}
                          className="max-w-[14rem] text-xs text-zinc-500"
                        >
                          {L.grossUnknownHint}
                        </p>
                      </div>
                    </div>

                    {box ? (
                      <p
                        className="text-xs text-zinc-600"
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
                        className="space-y-1"
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
                                w.key === "cbm_dims_mismatch"
                                  ? show(w.cbm, 4)
                                  : "",
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
                          "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
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
                          className="mt-0.5 h-4 w-4 accent-brand-700"
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
                ) : (
                  <>
                    {p.settledText ? (
                      <p
                        className="text-xs text-zinc-600"
                        data-sheet-settled={p.productId}
                      >
                        ✓ {p.settledText} {L.settledHint}
                      </p>
                    ) : null}
                    {innerRequired ? (
                      <p
                        className="text-xs text-zinc-700"
                        data-quote-inner={p.productId}
                        data-quote-inner-qty={innerRequired}
                      >
                        <Badge tone="info">{L.innerRequired}</Badge> {L.inner}:{" "}
                        {show(innerRequired, 0)} {L.unitPieces}.{" "}
                        {L.innerRequiredHint}
                      </p>
                    ) : p.inner.kind === "pending" ? (
                      <p
                        className="text-xs text-zinc-600"
                        data-quote-inner-pending={p.productId}
                      >
                        {L.innerPending}
                      </p>
                    ) : null}
                  </>
                )}

                {p.askPhoto || p.photoUrl ? (
                  <div
                    className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3"
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
                      // Antes de a foto subir, o rascunho vai para o servidor:
                      // se a página recarregar, o que foi digitado volta.
                      onSubmit={() => void autosave.flush()}
                      className="shrink-0"
                      data-quote-photo-form={p.productId}
                    >
                      <input type="hidden" name="quoteId" value={quoteId} />
                      <input
                        type="hidden"
                        name="productId"
                        value={p.productId}
                      />
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
              </div>
            </div>
          </section>
        );
      })}

      <section
        className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4"
        data-quote-terms
      >
        <p className="mb-2 text-sm font-semibold text-zinc-900">
          {L.termsTitle}
        </p>
        {/* A moeda fica ao lado do preço de cada item (uma para todos). */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <FieldLabel htmlFor={`quote-${quoteId}-incoterm`}>
              {L.incoterm}
            </FieldLabel>
            <Select
              id={`quote-${quoteId}-incoterm`}
              form={formId}
              name="incoterm"
              value={terms.incoterm}
              onChange={(e) => setTerms({ ...terms, incoterm: e.target.value })}
              className="h-9! w-full"
              data-quote-incoterm
            >
              {incoterms.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor={`quote-${quoteId}-lead`}>
              {L.leadTime}
            </FieldLabel>
            <span
              className={cx(
                "flex h-9 items-center rounded-md border shadow-sm transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
                lacks("leadTimeDays")
                  ? "border-red-400 bg-red-50"
                  : "border-zinc-300 bg-white",
              )}
            >
              <input
                id={`quote-${quoteId}-lead`}
                form={formId}
                name="leadTimeDays"
                inputMode="numeric"
                autoComplete="off"
                value={terms.leadTimeDays}
                onChange={(e) =>
                  setTerms({ ...terms, leadTimeDays: e.target.value })
                }
                data-quote-lead
                data-missing={lacks("leadTimeDays") ? "true" : undefined}
                className="h-full w-full min-w-0 rounded-md border-0 bg-transparent px-2.5 text-right text-[13px] tabular-nums text-zinc-900 focus:outline-none"
              />
              <span className="shrink-0 pr-2.5 text-xs text-zinc-500">
                {L.unitDays}
              </span>
            </span>
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor={`quote-${quoteId}-port`}>{L.port}</FieldLabel>
            <input
              id={`quote-${quoteId}-port`}
              form={formId}
              name="port"
              maxLength={120}
              autoComplete="off"
              value={terms.port}
              onChange={(e) => setTerms({ ...terms, port: e.target.value })}
              data-quote-port
              data-missing={lacks("port") ? "true" : undefined}
              className={cx(
                textBox,
                lacks("port")
                  ? "border-red-400 bg-red-50"
                  : "border-zinc-300 bg-white",
              )}
            />
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor={`quote-${quoteId}-moq`}>{L.moq}</FieldLabel>
            <span
              className={cx(
                "flex h-9 items-center rounded-md border shadow-sm transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
                lacks("moq")
                  ? "border-red-400 bg-red-50"
                  : "border-zinc-300 bg-white",
              )}
            >
              <input
                id={`quote-${quoteId}-moq`}
                form={formId}
                name="moq"
                inputMode="numeric"
                autoComplete="off"
                value={terms.moq}
                onChange={(e) => setTerms({ ...terms, moq: e.target.value })}
                data-quote-moq
                data-missing={lacks("moq") ? "true" : undefined}
                className="h-full w-full min-w-0 rounded-md border-0 bg-transparent px-2.5 text-right text-[13px] tabular-nums text-zinc-900 focus:outline-none"
              />
              <span className="shrink-0 pr-2.5 text-xs text-zinc-500">
                {L.unitPieces}
              </span>
            </span>
          </div>
        </div>
        <div className="mt-3">
          <FieldLabel htmlFor={`quote-${quoteId}-note`}>{L.note}</FieldLabel>
          <Textarea
            id={`quote-${quoteId}-note`}
            form={formId}
            name="note"
            rows={2}
            maxLength={2000}
            value={terms.note}
            onChange={(e) => setTerms({ ...terms, note: e.target.value })}
          />
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
