import type { Translate } from "@/i18n";
import { Alert, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  confirmBookingManufacturerAction,
  removeBookingItemAction,
} from "../../actions/booking-lots";

/*
 * Fabricante (dono, 24/11/2026; docs/BOOKING.md, "Fábrica, Fornecedor e
 * Fabricante"): a coluna repete em todas as linhas a Fábrica do book e
 * compara com o fabricante que a planilha traz em cada uma. Linha diferente
 * fica marcada em vermelho, e o book não é enviado nem fechado até ela ser
 * removida ou alguém confirmar que a planilha estava errada. As duas telas
 * (Wellmix e parceiro) usam os mesmos componentes.
 */

/** A célula Fabricante de uma linha. */
export function ManufacturerCell({
  t,
  lotId,
  itemId,
  manufacturer,
  sheetSupplier,
  mismatch,
  canEdit,
}: {
  t: Translate;
  lotId: string;
  itemId: string;
  /** A Fábrica do book. */
  manufacturer: string | null;
  /** Como a planilha escreveu nesta linha. */
  sheetSupplier: string | null;
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
            {t("bookWork.manufacturer.sheet", { name: sheetSupplier ?? "" })}
          </Badge>
          {canEdit ? (
            <span className="flex flex-wrap gap-1">
              <form action={confirmBookingManufacturerAction}>
                <input type="hidden" name="lotId" value={lotId} />
                <input type="hidden" name="itemId" value={itemId} />
                <SubmitButton
                  variant="secondary"
                  confirmText={t("bookWork.manufacturer.confirmAsk", {
                    sheet: sheetSupplier ?? "",
                    name: manufacturer ?? "",
                  })}
                  data-book-manufacturer-confirm={itemId}
                >
                  {t("bookWork.manufacturer.confirm")}
                </SubmitButton>
              </form>
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
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
}

/** O aviso acima da tabela: quantas linhas divergem e "confirmar todas". */
export function ManufacturerAlert({
  t,
  lotId,
  count,
  manufacturer,
  canEdit,
}: {
  t: Translate;
  lotId: string;
  count: number;
  manufacturer: string | null;
  canEdit: boolean;
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
        {canEdit ? (
          <form action={confirmBookingManufacturerAction} className="mt-2">
            <input type="hidden" name="lotId" value={lotId} />
            <SubmitButton
              variant="secondary"
              confirmText={t("bookWork.manufacturer.confirmAllAsk", {
                n: count,
                name: manufacturer ?? "",
              })}
              data-book-manufacturer-confirm-all
            >
              {t("bookWork.manufacturer.confirmAll")}
            </SubmitButton>
          </form>
        ) : null}
      </Alert>
    </div>
  );
}

/** Nº da loja digitado diferente do da planilha: só avisa. */
export function StoreNumberAlert({
  t,
  typed,
  sheet,
}: {
  t: Translate;
  typed: string | null;
  /** O da planilha, quando diferente do digitado. */
  sheet: string | null;
}) {
  if (!sheet) return null;
  return (
    <div className="mb-3" data-book-store-mismatch>
      <Alert tone="warning">
        {t("bookWork.store.mismatch", { typed: typed ?? "", sheet })}
      </Alert>
    </div>
  );
}
