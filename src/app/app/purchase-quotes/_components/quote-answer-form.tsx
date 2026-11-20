"use client";

import { useState, type FormEvent } from "react";
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
import { parseNumberInput } from "@/lib/number-input";
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
 */

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
}: {
  quoteId: string;
  action: (form: FormData) => void | Promise<void>;
  photoAction: (form: FormData) => void | Promise<void>;
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
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.productId, p.price])),
  );
  const [sheets, setSheets] = useState<Record<string, SheetText>>(() =>
    Object.fromEntries(
      products.map((p) => [
        p.productId,
        {
          masterBoxQty: fmt(p.draft.masterBoxQty),
          innerBoxQty: fmt(p.draft.innerBoxQty),
          noInner: p.draft.noInner,
          boxLengthCm: fmt(p.draft.boxLengthCm),
          boxWidthCm: fmt(p.draft.boxWidthCm),
          boxHeightCm: fmt(p.draft.boxHeightCm),
          cbm: fmt(p.draft.cbm),
          netWeightKg: fmt(p.draft.netWeightKg),
          grossWeightBoxKg: fmt(p.draft.grossWeightBoxKg),
          material: p.draft.material,
          factoryItemCode: p.draft.factoryItemCode,
          noFactoryCode: p.draft.noFactoryCode,
          confirm: false,
        },
      ]),
    ),
  );
  const [terms, setTerms] = useState(commercial);
  const [tried, setTried] = useState(false);
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
    if (submitter?.getAttribute("name") === "decline") return;
    if (!missing.length) return;
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
    <div className="space-y-4" data-quote-answer-form data-quote-form={quoteId}>
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
        const numberInput = (
          key: NumberKey,
          int = false,
          disabled = false,
          lacking = false,
        ) => (
          <Input
            form={formId}
            name={`sheet.${p.productId}.${key}`}
            inputMode={int ? "numeric" : "decimal"}
            value={s[key]}
            disabled={disabled}
            onChange={(e) => setSheet(p.productId, { [key]: e.target.value })}
            data-sheet-field={`${p.productId}.${key}`}
            data-missing={lacking ? "true" : undefined}
            className={cx(
              changed.has(key) && "border-amber-400 bg-amber-50",
              lacking && "border-red-400 bg-red-50",
            )}
          />
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
              <div className="w-40 shrink-0">
                <Field label={L.unitPrice}>
                  <input
                    type="hidden"
                    form={formId}
                    name="productId"
                    value={p.productId}
                  />
                  <Input
                    form={formId}
                    name={`price.${p.productId}`}
                    inputMode="decimal"
                    value={prices[p.productId] ?? ""}
                    onChange={(e) =>
                      setPrices((all) => ({
                        ...all,
                        [p.productId]: e.target.value,
                      }))
                    }
                    data-quote-price={p.productId}
                    data-missing={
                      lacks(`${p.productId}.price`) ? "true" : undefined
                    }
                    className={cx(
                      lacks(`${p.productId}.price`) &&
                        "border-red-400 bg-red-50",
                    )}
                  />
                </Field>
              </div>
            </div>

            {p.ask ? (
              <div
                className="mt-3 border-t border-zinc-100 pt-3"
                data-quote-sheet={p.productId}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900">
                    {L.sheetTitle}
                  </p>
                  {changed.size ? (
                    <Badge tone="warning">{L.changed}</Badge>
                  ) : null}
                </div>
                <p className="mb-2 text-xs text-zinc-600">
                  {p.own
                    ? L.hintOwn
                    : p.soldBefore
                      ? L.hintConfirm
                      : L.hintDeclare}
                </p>
                {p.rejectedNote ? (
                  <div className="mb-2" data-sheet-rejected={p.productId}>
                    <Alert tone="warning">
                      {fill(L.rejected, { note: p.rejectedNote })}
                    </Alert>
                  </div>
                ) : null}
                <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label={L.fields.masterBoxQty}
                    hint={hintFor("masterBoxQty")}
                  >
                    {numberInput(
                      "masterBoxQty",
                      true,
                      false,
                      lacks(`${p.productId}.masterBoxQty`),
                    )}
                  </Field>
                  <div className="min-w-0">
                    <Field
                      label={L.fields.innerBoxQty}
                      hint={hintFor("innerBoxQty")}
                    >
                      {numberInput(
                        "innerBoxQty",
                        true,
                        s.noInner,
                        lacks(`${p.productId}.innerBoxQty`),
                      )}
                    </Field>
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        form={formId}
                        name={`sheet.${p.productId}.noInner`}
                        value="1"
                        checked={s.noInner}
                        onChange={(e) =>
                          setSheet(p.productId, { noInner: e.target.checked })
                        }
                        data-sheet-no-inner={p.productId}
                      />
                      {L.fields.noInner}
                    </label>
                  </div>
                  <Field
                    label={L.fields.netWeightKg}
                    hint={hintFor("netWeightKg")}
                  >
                    {numberInput(
                      "netWeightKg",
                      false,
                      false,
                      lacks(`${p.productId}.netWeightKg`),
                    )}
                  </Field>
                  <Field
                    label={L.fields.grossWeightBoxKg}
                    hint={hintFor("grossWeightBoxKg")}
                  >
                    {numberInput(
                      "grossWeightBoxKg",
                      false,
                      false,
                      lacks(`${p.productId}.grossWeightBoxKg`),
                    )}
                  </Field>
                  <Field
                    label={L.fields.boxLengthCm}
                    hint={hintFor("boxLengthCm")}
                  >
                    {numberInput(
                      "boxLengthCm",
                      false,
                      false,
                      lacks(`${p.productId}.box`),
                    )}
                  </Field>
                  <Field label={L.fields.boxWidthCm}>
                    {numberInput(
                      "boxWidthCm",
                      false,
                      false,
                      lacks(`${p.productId}.box`),
                    )}
                  </Field>
                  <Field label={L.fields.boxHeightCm}>
                    {numberInput(
                      "boxHeightCm",
                      false,
                      false,
                      lacks(`${p.productId}.box`),
                    )}
                  </Field>
                  <Field
                    label={L.fields.cbm}
                    hint={
                      hintFor("cbm") ??
                      (fromDims !== null
                        ? fill(L.fields.cbmFromDims, { cbm: show(fromDims, 4) })
                        : L.fields.cbmHint)
                    }
                  >
                    {numberInput(
                      "cbm",
                      false,
                      false,
                      lacks(`${p.productId}.box`),
                    )}
                  </Field>
                  <Field label={L.fields.material} hint={hintFor("material")}>
                    <Input
                      form={formId}
                      name={`sheet.${p.productId}.material`}
                      value={s.material}
                      maxLength={200}
                      onChange={(e) =>
                        setSheet(p.productId, { material: e.target.value })
                      }
                      data-sheet-field={`${p.productId}.material`}
                      data-missing={
                        lacks(`${p.productId}.material`) ? "true" : undefined
                      }
                      className={cx(
                        changed.has("material") &&
                          "border-amber-400 bg-amber-50",
                        lacks(`${p.productId}.material`) &&
                          "border-red-400 bg-red-50",
                      )}
                    />
                  </Field>
                  <div className="min-w-0">
                    <Field
                      label={L.fields.factoryItemCode}
                      hint={hintFor("factoryItemCode")}
                    >
                      <Input
                        form={formId}
                        name={`sheet.${p.productId}.factoryItemCode`}
                        value={s.factoryItemCode}
                        maxLength={80}
                        disabled={s.noFactoryCode}
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
                          changed.has("factoryItemCode") &&
                            "border-amber-400 bg-amber-50",
                          lacks(`${p.productId}.factoryItemCode`) &&
                            "border-red-400 bg-red-50",
                        )}
                      />
                    </Field>
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-zinc-700">
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
                  </div>
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={L.currency}>
            <Select
              form={formId}
              name="currency"
              value={terms.currency}
              onChange={(e) => setTerms({ ...terms, currency: e.target.value })}
              data-quote-currency
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L.incoterm}>
            <Select
              form={formId}
              name="incoterm"
              value={terms.incoterm}
              onChange={(e) => setTerms({ ...terms, incoterm: e.target.value })}
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
            <Input
              form={formId}
              name="leadTimeDays"
              inputMode="numeric"
              value={terms.leadTimeDays}
              onChange={(e) =>
                setTerms({ ...terms, leadTimeDays: e.target.value })
              }
              data-quote-lead
              data-missing={lacks("leadTimeDays") ? "true" : undefined}
              className={cx(
                lacks("leadTimeDays") && "border-red-400 bg-red-50",
              )}
            />
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
              className={cx(lacks("port") && "border-red-400 bg-red-50")}
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
              className={cx(lacks("moq") && "border-red-400 bg-red-50")}
            />
          </Field>
        </div>
        <div className="mt-3">
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
          <div className="flex flex-wrap gap-2">
            <SubmitButton data-quote-submit>{L.answer}</SubmitButton>
            <SubmitButton
              name="decline"
              value="1"
              variant="secondary"
              data-quote-decline
            >
              {L.decline}
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
