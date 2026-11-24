import type { Translate } from "@/i18n";
import type { BulkFillLabels } from "@/components/booking-bulk-fill";

/*
 * Tabela de itens do Book com cabeçalho congelado e preenchimento em massa
 * (dono, 16/11/2026): o que a tela da Wellmix e a do parceiro usam igual.
 */

/**
 * Largura da coluna (rem) a partir da largura do campo dela ("w-20" = 5rem):
 * o campo, o espaço da célula (px-2 dos dois lados) e meio rem de folga, para
 * a palavra mais longa do título caber inteira ("COMPRIMENTO", "CAPACIDADE").
 * As duas partes da tabela congelada usam a mesma largura em cada coluna.
 */
export function colRem(width: string): number {
  const n = Number(/^w-(\d+(?:\.\d+)?)$/.exec(width)?.[1]);
  return Number.isFinite(n) && n > 0 ? n / 4 + 1.5 : 8;
}

/**
 * Primeira coluna (a caixa e o número da linha; no cabeçalho, a caixa de
 * todas e o "Carregar"): presa à esquerda na rolagem para o lado, para
 * marcar e carregar sem voltar ao começo da linha. Largura: FIRST_COL_REM.
 */
export const FIRST_COL_REM = 6;
export const STICKY_FIRST =
  "sticky left-0 z-10 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]";

/**
 * Tela da Wellmix (dono, 16/11/2026): a coluna das fotos também fica presa,
 * logo depois da primeira (left = FIRST_COL_REM), para ver qual é o item
 * enquanto a tabela anda para o lado. A sombra que separa as colunas presas
 * das que rolam fica nela; a primeira vai sem sombra.
 */
export const STICKY_FIRST_PLAIN = "sticky left-0 z-10";
export const STICKY_PHOTO =
  "sticky left-[6rem] z-10 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]";

/** Os textos da seleção e do "Carregar". */
export function bulkFillLabels(t: Translate): BulkFillLabels {
  return {
    selectAll: t("bookingLots.bulk.selectAll"),
    selectRow: t("bookingLots.bulk.selectRow"),
    field: t("bookingLots.bulk.field"),
    load: t("bookingLots.bulk.load"),
    loading: t("bookingLots.bulk.loading"),
    selected: t("bookingLots.bulk.selected"),
    allRows: t("bookWork.bulk.allRows"),
    toSelection: t("bookWork.toSelection"),
    toSelectionNone: t("bookWork.toSelection.none"),
    toSelectionMax: t("bookWork.toSelection.max"),
    disabled: t("bookingLots.bulk.disabled"),
    invalid: t("bookingLots.bulk.invalid"),
    updated: t("bookingLots.bulk.updated"),
    failed: t("bookingLots.bulk.failed"),
    failedGroup: t("bookingLots.bulk.failedGroup"),
    row: t("bookingLots.bulk.row"),
    refused: t("bookingLots.bulk.refused"),
    offline: t("bookingLots.bulk.offline"),
    retry: t("bookingLots.bulk.retry"),
    close: t("bookingLots.bulk.close"),
  };
}
