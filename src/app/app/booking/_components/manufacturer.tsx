import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import { Alert, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { removeBookingItemAction } from "../../actions/booking-lots";

/*
 * Fabricante (dono, 24/11/2026; docs/BOOKING.md, "Supplier, Fábrica e
 * Fabricante"): a coluna repete em todas as linhas o nº da loja digitado na
 * importação e compara com o nº da loja que a planilha traz em cada uma.
 * Célula diferente fica marcada em vermelho, e o book não é enviado nem
 * fechado até a linha ser removida; a outra saída é cancelar a importação
 * para refazer. As duas telas (Wellmix e parceiro) usam os mesmos
 * componentes.
 */

/** A célula Fabricante de uma linha. */
export function ManufacturerCell({
  t,
  lotId,
  itemId,
  manufacturer,
  sheetStore,
  mismatch,
  canEdit,
}: {
  t: Translate;
  lotId: string;
  itemId: string;
  /** O nº da loja digitado na importação (o Fabricante do book). */
  manufacturer: string | null;
  /** O nº da loja que a planilha traz nesta linha. */
  sheetStore: string | null;
  mismatch: boolean;
  /** Rascunho (Wellmix) ou em preenchimento (parceiro): dá para resolver. */
  canEdit: boolean;
}) {
  return (
    <span
      className="flex flex-col items-start gap-1 text-xs"
      data-book-manufacturer={mismatch ? "mismatch" : "ok"}
    >
      <span className="text-[13px] break-words text-zinc-800">
        {manufacturer ?? "—"}
      </span>
      {mismatch ? (
        <>
          <Badge tone="danger">
            {t("bookWork.manufacturer.sheet", { name: sheetStore ?? "" })}
          </Badge>
          {canEdit ? (
            <form action={removeBookingItemAction}>
              <input type="hidden" name="lotId" value={lotId} />
              <input type="hidden" name="itemId" value={itemId} />
              <SubmitButton
                variant="secondary"
                confirmText={t("bookWork.manufacturer.removeAsk")}
                data-book-manufacturer-remove={itemId}
              >
                {t("bookWork.manufacturer.remove")}
              </SubmitButton>
            </form>
          ) : null}
        </>
      ) : null}
    </span>
  );
}

/**
 * O aviso acima da tabela: quantas linhas divergem. A saída é remover as
 * linhas (na célula) ou cancelar a importação para refazer (`cancel`, o
 * botão de quem chama: a Wellmix cancela o book; o parceiro descarta).
 */
export function ManufacturerAlert({
  t,
  count,
  manufacturer,
  cancel,
}: {
  t: Translate;
  count: number;
  manufacturer: string | null;
  cancel?: ReactNode;
}) {
  if (!count) return null;
  return (
    <div className="mb-3" data-book-manufacturer-alert={count}>
      <Alert tone="danger">
        <span className="block">
          {t("bookWork.manufacturer.alert", {
            n: count,
            name: manufacturer ?? "—",
          })}
        </span>
        {cancel ? <span className="mt-2 block">{cancel}</span> : null}
      </Alert>
    </div>
  );
}
