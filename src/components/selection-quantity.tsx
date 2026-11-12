"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import {
  RequestScheduleFields,
  type ScheduleLabels,
} from "@/components/request-schedule";
import type { RequestSchedule } from "@/lib/db/schema";
import { MAX_PURCHASE_ROUNDS } from "@/lib/purchase-rounds";

/*
 * Quantidade da escolha do grupo com a programação de compra
 * (docs/PURCHASE_SCHEDULE.md): sem programação, a quantidade digitada (em
 * branco = a da planilha); com ela, rodadas com peças e intervalo, e a
 * quantidade passa a ser a soma das rodadas (o campo fica só para leitura).
 */
export function SelectionQuantity({
  label,
  hint,
  scheduledHint,
  defaultQuantity,
  schedule,
  labels,
}: {
  label: string;
  hint: string;
  /** Dica do campo quando a programação está ligada. */
  scheduledHint: string;
  defaultQuantity: number | null;
  schedule: RequestSchedule | null;
  labels: ScheduleLabels;
}) {
  const [qty, setQty] = useState(
    defaultQuantity === null ? "" : String(defaultQuantity),
  );
  const [scheduled, setScheduled] = useState(!!schedule?.items.length);
  return (
    <div className="space-y-3 md:col-span-3" data-selection-quantity-block>
      <label className="block max-w-xs space-y-1">
        <span className="block text-sm font-medium text-zinc-700">{label}</span>
        <Input
          name={scheduled ? undefined : "quantity"}
          inputMode="numeric"
          autoComplete="off"
          value={qty}
          readOnly={scheduled}
          onChange={(e) => setQty(e.target.value)}
          data-selection-quantity
        />
        <span className="block text-xs text-zinc-500">
          {scheduled ? scheduledHint : hint}
        </span>
      </label>
      <div>
        <RequestScheduleFields
          prefix=""
          total={qty}
          unit="pcs"
          onTotalChange={(total) => setQty(total)}
          labels={labels}
          max={MAX_PURCHASE_ROUNDS}
          initial={schedule}
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
          onToggle={setScheduled}
        />
      </div>
    </div>
  );
}
