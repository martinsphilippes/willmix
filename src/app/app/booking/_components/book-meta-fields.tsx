import type { Translate } from "@/i18n";
import { Field, Input } from "@/components/ui";

/*
 * Nº da loja, nome do supplier e Tipo de item do book (dono, 23 e
 * 24/11/2026; docs/BOOKING.md, "Dinâmica dos books"): os campos que quem
 * importa informa, na Wellmix e no parceiro, e que a Wellmix ajusta na tela
 * do book. Loja e supplier são campos abertos, só informativos (não mudam o
 * fornecedor do book); a Seleção de itens busca por eles. O tipo de item é
 * texto, com os já usados como sugestão (o mesmo texto junta os books na
 * trava por tipo).
 */
export function BookMetaFields({
  t,
  types,
  storeNumber = null,
  supplierName = null,
  itemType = null,
  required = true,
  listId = "book-item-types",
}: {
  t: Translate;
  /** Tipos de item já usados (sugestões). */
  types: readonly string[];
  storeNumber?: string | null;
  supplierName?: string | null;
  itemType?: string | null;
  /** Na importação o tipo de item é obrigatório; no book antigo, não. */
  required?: boolean;
  listId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t("bookWork.storeNumber")}>
        <Input
          name="storeNumber"
          maxLength={60}
          defaultValue={storeNumber ?? ""}
          autoComplete="off"
          data-book-store-number
        />
      </Field>
      <Field label={t("bookWork.supplierName")}>
        <Input
          name="supplierName"
          maxLength={160}
          defaultValue={supplierName ?? ""}
          autoComplete="off"
          data-book-supplier-name
        />
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
