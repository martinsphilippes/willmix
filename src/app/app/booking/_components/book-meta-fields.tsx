import { BOOKING_SOURCE_KINDS, type BookingSourceKind } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Field, Input, Select } from "@/components/ui";

/*
 * Loja/Fábrica e Tipo de item do book (dono, 23/11/2026; docs/BOOKING.md,
 * "Loja/Fábrica e Tipo de item"): os dois campos que quem importa informa,
 * na Wellmix e no parceiro, e que a Wellmix ajusta na tela do book. O tipo
 * de item é texto, com os já usados como sugestão (o mesmo texto junta os
 * books na trava por tipo).
 */
export function BookMetaFields({
  t,
  types,
  sourceKind = null,
  itemType = null,
  required = true,
  listId = "book-item-types",
}: {
  t: Translate;
  /** Tipos de item já usados (sugestões). */
  types: readonly string[];
  sourceKind?: BookingSourceKind | null;
  itemType?: string | null;
  /** Na importação os dois são obrigatórios; no book antigo, não. */
  required?: boolean;
  listId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("bookWork.sourceKind")}>
        <Select
          name="sourceKind"
          required={required}
          defaultValue={sourceKind ?? ""}
          data-book-source-kind
        >
          <option value="" disabled={required}>
            {t("common.select")}
          </option>
          {BOOKING_SOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`bookWork.sourceKind.${k}` as DictionaryKey)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("bookWork.itemType")} hint={t("bookWork.itemTypeHint")}>
        <Input
          name="itemType"
          required={required}
          maxLength={80}
          defaultValue={itemType ?? ""}
          list={listId}
          autoComplete="off"
          data-book-item-type
        />
        <datalist id={listId}>
          {types.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}
