"use client";

import {
  SaveInput,
  SaveSelect,
  type BookingRowFieldLabels,
} from "@/components/booking-row-fields";
import {
  setBookingItemFieldAction,
  setBookingLotDateAction,
  setBookingLotSupplierAction,
} from "@/app/app/actions/booking-lots";
import { setBookingItemNcmAction } from "@/app/app/actions/booking-ncm";

/*
 * Booking por planilha: os campos do rascunho que gravam sozinhos (o
 * fornecedor e a data do booking e cada campo dos itens), com o aviso na
 * própria célula, como na fila de produtos do Booking.
 */

export function BookingLotSupplierSelect({
  lotId,
  current,
  options,
  labels,
}: {
  lotId: string;
  current: string;
  options: { value: string; label: string }[];
  labels: BookingRowFieldLabels;
}) {
  return (
    <SaveSelect
      send={(value) => setBookingLotSupplierAction(lotId, value)}
      current={current}
      options={options}
      labels={labels}
      width="w-full max-w-sm"
      data-booking-lot-supplier={lotId}
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
}: {
  lotId: string;
  itemId: string;
  saved: string;
  labels: BookingRowFieldLabels;
}) {
  return (
    <span
      className={
        saved ? "block" : "block rounded-md ring-2 ring-amber-300 ring-offset-1"
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
  );
}
