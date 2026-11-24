import type { Translate } from "@/i18n";
import { Field, Input } from "@/components/ui";

/**
 * Campos do card "Planilha do book" compacto (dono, 24/11/2026): 36 px de
 * altura (40 px em tela de toque), cantos de 10 px e letra de 14 px. Nos
 * aparelhos da Apple a regra global de 16 px segue valendo (sem o zoom do
 * Safari ao tocar).
 */
export const BOOK_COMPACT_FIELD =
  "h-9 rounded-[10px] px-3 text-sm pointer-coarse:h-10";

/*
 * Nº da loja, nome do supplier e Tipo de item do book (dono, 23 e
 * 24/11/2026; docs/BOOKING.md, "Dinâmica dos books"): os campos que quem
 * importa informa, na Wellmix e no parceiro, e que a Wellmix ajusta na tela
 * do book. Loja e supplier são campos abertos, só informativos (não mudam o
 * fornecedor do book); a Seleção de itens busca por eles. O tipo de item é
 * texto, com os já usados como sugestão (o mesmo texto junta os books na
 * trava por tipo).
 *
 * `layout="inline"` (card "Planilha do book" da Wellmix, 24/11/2026): só os
 * três campos, compactos, para a linha de quem chama (Moeda padrão | Nº da
 * loja | Nome do supplier | Tipo de item); a dica do tipo de item fica abaixo
 * da linha, com o id em `itemTypeHintId`.
 */
export function BookMetaFields({
  t,
  types,
  storeNumber = null,
  supplierName = null,
  itemType = null,
  required = true,
  listId = "book-item-types",
  layout = "grid",
  itemTypeHintId,
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
  /** "grid": três colunas com a dica (o de sempre); "inline": só os campos. */
  layout?: "grid" | "inline";
  /** Com `layout="inline"`: o id da dica do tipo de item (fora dos campos). */
  itemTypeHintId?: string;
}) {
  const inline = layout === "inline";
  const fieldClass = inline ? BOOK_COMPACT_FIELD : undefined;
  const fields = (
    <>
      <Field label={t("bookWork.storeNumber")}>
        <Input
          name="storeNumber"
          maxLength={60}
          defaultValue={storeNumber ?? ""}
          autoComplete="off"
          className={fieldClass}
          data-book-store-number
        />
      </Field>
      <Field label={t("bookWork.supplierName")}>
        <Input
          name="supplierName"
          maxLength={160}
          defaultValue={supplierName ?? ""}
          autoComplete="off"
          className={fieldClass}
          data-book-supplier-name
        />
      </Field>
      <Field
        label={t("bookWork.itemType")}
        hint={inline ? undefined : t("bookWork.itemTypeHint")}
      >
        <Input
          name="itemType"
          required={required}
          maxLength={80}
          defaultValue={itemType ?? ""}
          list={listId}
          autoComplete="off"
          className={fieldClass}
          aria-describedby={inline ? itemTypeHintId : undefined}
          data-book-item-type
        />
        <datalist id={listId}>
          {types.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </Field>
    </>
  );
  return inline ? (
    fields
  ) : (
    <div className="grid gap-3 sm:grid-cols-3">{fields}</div>
  );
}
