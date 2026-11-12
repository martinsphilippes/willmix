"use client";

import { useState, useTransition } from "react";
import {
  SaveCombobox,
  SaveInput,
  SaveSelect,
  type BookingRowFieldLabels,
} from "@/components/booking-row-fields";
import {
  setBookingItemFieldAction,
  setBookingLotDateAction,
  setBookingLotPartnerAction,
  setBookingLotSupplierAction,
} from "@/app/app/actions/booking-lots";
import { setBookingItemNcmAction } from "@/app/app/actions/booking-ncm";

/*
 * Booking por planilha: os campos do rascunho que gravam sozinhos (o
 * fornecedor e a data do booking e cada campo dos itens), com o aviso na
 * própria célula.
 */

export function BookingLotSupplierSelect({
  lotId,
  current,
  options,
  labels,
  placeholder,
  noMatch,
}: {
  lotId: string;
  current: string;
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
  placeholder: string;
  noMatch: string;
}) {
  // Com busca: clicar abre a lista e digitar vai filtrando os fornecedores.
  return (
    <SaveCombobox
      send={(value) => setBookingLotSupplierAction(lotId, value)}
      current={current}
      options={options}
      labels={labels}
      placeholder={placeholder}
      noMatch={noMatch}
      width="w-full max-w-sm"
      data-booking-lot-supplier={lotId}
    />
  );
}

/** Responsável pelo booking: com busca, salva ao escolher. */
export function BookingLotPartnerSelect({
  lotId,
  current,
  options,
  labels,
  placeholder,
  noMatch,
}: {
  lotId: string;
  current: string;
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
  placeholder: string;
  noMatch: string;
}) {
  return (
    <SaveCombobox
      send={(value) => setBookingLotPartnerAction(lotId, value)}
      current={current}
      options={options}
      labels={labels}
      placeholder={placeholder}
      noMatch={noMatch}
      width="w-full max-w-sm"
      data-booking-lot-partner={lotId}
    />
  );
}

export function BookingLotDateInput({
  lotId,
  saved,
  labels,
}: {
  lotId: string;
  /** AAAA-MM-DD ou "". */
  saved: string;
  labels: BookingRowFieldLabels;
}) {
  return (
    <SaveInput
      send={(value) => setBookingLotDateAction(lotId, value)}
      saved={saved}
      type="date"
      labels={labels}
      width="w-44"
      data-booking-lot-date={lotId}
    />
  );
}

export function BookingItemInput({
  lotId,
  itemId,
  field,
  saved,
  numeric,
  width,
  labels,
  required,
}: {
  lotId: string;
  itemId: string;
  field: string;
  saved: string;
  numeric?: boolean;
  width: string;
  labels: BookingRowFieldLabels;
  /** Obrigatório e vazio: a borda chama a atenção. */
  required?: boolean;
}) {
  return (
    <span
      className={
        required && !saved
          ? "block rounded-md ring-2 ring-amber-300 ring-offset-1"
          : "block"
      }
    >
      <SaveInput
        send={(value) => setBookingItemFieldAction(lotId, itemId, field, value)}
        saved={saved}
        numeric={numeric}
        labels={labels}
        width={width}
        data-booking-item-field={`${itemId}:${field}`}
      />
    </span>
  );
}

export function BookingItemSelect({
  lotId,
  itemId,
  field,
  current,
  options,
  labels,
  required,
}: {
  lotId: string;
  itemId: string;
  field: string;
  current: string;
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
  required?: boolean;
}) {
  return (
    <span
      className={
        required && !current
          ? "block rounded-md ring-2 ring-amber-300 ring-offset-1"
          : "block"
      }
    >
      <SaveSelect
        send={(value) => setBookingItemFieldAction(lotId, itemId, field, value)}
        current={current}
        options={options}
        labels={labels}
        width="w-20"
        data-booking-item-field={`${itemId}:${field}`}
      />
    </span>
  );
}

/**
 * NCM do item (docs/BOOKING.md, "NCM do item"): grava ao sair do campo,
 * também com o booking fechado (a análise do item é refeita).
 */
export function BookingItemNcmInput({
  lotId,
  itemId,
  saved,
  labels,
  suggestions = [],
  suggestLabel = "",
  recommendedLabel = "",
  fillLabel = "",
  othersLabel = "",
}: {
  lotId: string;
  itemId: string;
  saved: string;
  labels: BookingRowFieldLabels;
  /** NCMs prováveis (sem NCM gravado): um clique grava. */
  suggestions?: Array<{ ncm: string; title: string; pct?: number }>;
  suggestLabel?: string;
  /** Textos do destaque: "Recomendado", o botão e o título das demais. */
  recommendedLabel?: string;
  fillLabel?: string;
  othersLabel?: string;
}) {
  return (
    <span className="block">
      <span
        className={
          saved
            ? "block"
            : "block rounded-md ring-2 ring-amber-300 ring-offset-1"
        }
      >
        <SaveInput
          send={(value) => setBookingItemNcmAction(lotId, itemId, value)}
          saved={saved}
          numeric
          labels={labels}
          width="w-28"
          data-booking-item-ncm={itemId}
        />
      </span>
      {suggestions.length ? (
        <NcmSuggestionChips
          lotId={lotId}
          itemId={itemId}
          suggestions={suggestions}
          label={suggestLabel}
          failed={labels.failed}
          recommendedLabel={recommendedLabel || suggestLabel}
          fillLabel={fillLabel || suggestLabel}
          othersLabel={othersLabel}
        />
      ) : null}
    </span>
  );
}

/**
 * Sugestões de NCM do item (já em ordem, a primeira é a mais bem qualificada):
 * a recomendada vem em destaque com o botão "Preencher com o recomendado";
 * as demais seguem como opções. Clicar grava (a tela se atualiza com o NCM).
 */
function NcmSuggestionChips({
  lotId,
  itemId,
  suggestions,
  label,
  failed,
  recommendedLabel,
  fillLabel,
  othersLabel,
}: {
  lotId: string;
  itemId: string;
  suggestions: Array<{ ncm: string; title: string; pct?: number }>;
  label: string;
  failed: string;
  recommendedLabel: string;
  fillLabel: string;
  othersLabel: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const choose = (ncm: string) =>
    start(async () => {
      setError(null);
      try {
        const r = await setBookingItemNcmAction(lotId, itemId, ncm);
        if (!r.ok) setError(r.message);
      } catch {
        setError(failed);
      }
    });
  const [best, ...others] = suggestions;
  return (
    <span
      className="mt-1 block w-40"
      data-booking-item-ncm-suggestions={itemId}
    >
      <span
        className="block rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-1"
        title={best.title}
        data-booking-item-ncm-recommended={best.ncm}
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          {recommendedLabel}
        </span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-[13px] font-semibold tabular-nums text-zinc-900">
            {best.ncm}
          </span>
          {best.pct !== undefined ? (
            <span className="text-[11px] text-emerald-700">{best.pct}%</span>
          ) : null}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(best.ncm)}
          className="mt-1 w-full rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          data-booking-item-ncm-suggestion={best.ncm}
          data-booking-item-ncm-fill={itemId}
        >
          {fillLabel}
        </button>
      </span>
      {others.length ? (
        <>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {othersLabel || label}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-1">
            {others.map((sg) => (
              <button
                key={sg.ncm}
                type="button"
                title={sg.title}
                disabled={pending}
                onClick={() => choose(sg.ncm)}
                className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand-800 hover:bg-brand-100 disabled:opacity-50"
                data-booking-item-ncm-suggestion={sg.ncm}
              >
                {sg.ncm}
              </button>
            ))}
          </span>
        </>
      ) : null}
      {error ? (
        <span role="alert" className="mt-0.5 block text-[11px] text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
