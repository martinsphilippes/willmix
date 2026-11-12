"use client";

import {
  SaveInput,
  SaveSelect,
  type BookingRowFieldLabels,
} from "@/components/booking-row-fields";
import { setPartnerBookingItemFieldAction } from "@/app/app/actions/booking-lots";

/*
 * Booking que o parceiro lança (docs/BOOKING.md, "Booking do Trading"): os
 * campos dos itens enquanto ele confere a planilha. Cada um grava ao sair
 * dele, com o aviso na própria célula, como na tela da Wellmix; a ação é a
 * do parceiro (só o booking dele, só antes de enviar).
 */

/** Campo que a Wellmix exige para fechar e está em branco: a borda chama a atenção. */
const frame = (blank: boolean) =>
  blank ? "block rounded-md ring-2 ring-amber-300 ring-offset-1" : "block";

export function PartnerItemInput({
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
  required?: boolean;
}) {
  return (
    <span
      className={frame(!!required && !saved)}
      data-partner-item-blank={required && !saved ? field : undefined}
    >
      <SaveInput
        send={(value) =>
          setPartnerBookingItemFieldAction(lotId, itemId, field, value)
        }
        saved={saved}
        numeric={numeric}
        labels={labels}
        width={width}
        data-partner-item-field={`${itemId}:${field}`}
      />
    </span>
  );
}

export function PartnerItemSelect({
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
      className={frame(!!required && !current)}
      data-partner-item-blank={required && !current ? field : undefined}
    >
      <SaveSelect
        send={(value) =>
          setPartnerBookingItemFieldAction(lotId, itemId, field, value)
        }
        current={current}
        options={options}
        labels={labels}
        width="w-20"
        data-partner-item-field={`${itemId}:${field}`}
      />
    </span>
  );
}
