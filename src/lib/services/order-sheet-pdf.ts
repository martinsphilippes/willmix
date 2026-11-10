import "server-only";

import { SimplePdf, pdfWrap, type PdfColor } from "@/lib/simple-pdf";
import {
  ORDER_PROCEDURES,
  ORDER_PROCEDURES_TITLE,
} from "@/lib/order-procedures";
import {
  ORDER_SHEET_BAND_A,
  orderSheetBandB,
  orderSheetCargoTotals,
  orderSheetCurrencySign,
  orderSheetGeneralNotes,
  orderSheetHeaderBlocks,
  orderSheetStamp,
  orderSheetValueTotals,
  orderSheetValuesA,
  orderSheetValuesB,
} from "@/lib/order-sheet-layout";
import type { OrderSignature } from "./order-signature";
import type { OrderSheet } from "./order-sheet";

/*
 * PDF do pedido no formato do modelo da Wellmix (folha deitada): cabeçalho,
 * cada item em duas faixas, totais, comentários e a página "WELLMIX
 * PROCEDURES". O fornecedor baixa, assina no quadro do canto e anexa de
 * volta (docs/ORDER_SIGNATURE.md). Campo sem dado fica em branco.
 */

const M = 20;
const GRAY: PdfColor = [0.8, 0.8, 0.8];
const RED: PdfColor = [0.78, 0.1, 0.13];
const WHITE: PdfColor = [1, 1, 1];

export function renderOrderSheetPdf(input: {
  sheet: OrderSheet;
  /** Versão do documento (impressão digital do que as partes assinam). */
  hash: string;
  wellmix: OrderSignature | null;
  supplier: OrderSignature | null;
  /** Quem gerou o PDF (nome), para "Order print by". */
  printedBy: string | null;
  /** Momento da geração (ISO); quem chama informa (testes fixam). */
  printedAt: string;
}): Uint8Array {
  const { sheet } = input;
  const h = sheet.header;
  const pdf = new SimplePdf({ landscape: true });
  const W = pdf.width;
  const usable = W - 2 * M;
  const bottom = pdf.height - 26;
  const sign = orderSheetCurrencySign(sheet.currency);
  let y = M;

  const footer = () => {
    pdf.text(M, pdf.height - 12, `Document version: ${input.hash}`, {
      size: 6,
    });
    pdf.text(W - M, pdf.height - 12, `${pdf.pageCount}`, {
      size: 6,
      align: "right",
    });
  };
  const newPage = () => {
    footer();
    pdf.addPage();
    y = M;
  };
  const need = (height: number) => {
    if (y + height > bottom) newPage();
  };
  /** Larguras proporcionais ajustadas para a largura útil. */
  const fit = (weights: readonly number[], total = usable) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / sum) * total);
  };
  const lineHeight = (size: number) => size + 1.6;
  const measure = (
    widths: number[],
    cells: string[],
    size: number,
    bold: boolean,
  ) =>
    Math.max(
      ...cells.map(
        (cell, i) => pdfWrap(cell, size, widths[i] - 4, bold).length,
      ),
      1,
    ) *
      lineHeight(size) +
    4;
  const drawRow = (
    x0: number,
    widths: number[],
    cells: string[],
    opts: { size: number; bold?: boolean; height?: number },
  ) => {
    const bold = !!opts.bold;
    const height = opts.height ?? measure(widths, cells, opts.size, bold);
    let x = x0;
    cells.forEach((cell, i) => {
      pdf.rect(x, y, widths[i], height, 0.4);
      pdfWrap(cell, opts.size, widths[i] - 4, bold).forEach((line, li) =>
        pdf.text(
          x + widths[i] / 2,
          y + opts.size + 1 + li * lineHeight(opts.size),
          line,
          { size: opts.size, bold, align: "center" },
        ),
      );
      x += widths[i];
    });
    y += height;
    return height;
  };

  /* ---------------------------------------------------------------- */
  /* Cabeçalho                                                         */
  /* ---------------------------------------------------------------- */
  const logoW = 108;
  const signW = 180;
  const infoX = M + logoW + 8;
  const infoW = usable - logoW - 8 - signW - 8;
  // Título.
  pdf.rect(infoX, y, infoW, 14, 0.6);
  pdf.text(infoX + infoW / 2, y + 10.5, h.company.toUpperCase(), {
    size: 11,
    bold: true,
    align: "center",
  });
  // Logo (marca em texto: o gerador não embute imagens).
  pdf.fillRect(M, y + 28, logoW, 40, RED);
  pdf.text(M + logoW / 2, y + 55, "Wellmix", {
    size: 20,
    bold: true,
    align: "center",
    color: WHITE,
  });
  // Dados do pedido, em três colunas de rótulo e valor.
  const infoY = y + 18;
  const infoH = 80;
  const col = fit([1, 1.35, 1], infoW);
  const blocks = orderSheetHeaderBlocks(h, input.printedBy, input.printedAt);
  let bx = infoX;
  blocks.forEach((rows, bi) => {
    pdf.rect(bx, infoY, col[bi], infoH, 0.6);
    const pitch = infoH / rows.length;
    const labelW = bi === 1 ? 74 : 70;
    rows.forEach(([label, value], ri) => {
      const ry = infoY + ri * pitch;
      pdf.text(bx + 3, ry + 9, label, { size: 6.5 });
      pdfWrap(value, 6.5, col[bi] - labelW - 6, bi === 2)
        .slice(0, 2)
        .forEach((line, li) =>
          pdf.text(bx + labelW, ry + 9 + li * 7.5, line, {
            size: 6.5,
            bold: bi === 2,
          }),
        );
    });
    bx += col[bi];
  });
  // Quadros de assinatura: o fornecedor em cima, a Wellmix embaixo.
  const sx = W - M - signW;
  const signatureBox = (
    by: number,
    bh: number,
    title: string,
    signature: OrderSignature | null,
  ) => {
    pdf.rect(sx, by, signW, bh, 0.6);
    pdf.text(sx + 4, by + 8, title, { size: 6 });
    if (signature) {
      pdf.text(
        sx + 4,
        by + bh - 14,
        signature.method === "file"
          ? `Signed copy attached by: ${signature.name}`
          : `Signed in the portal by: ${signature.name}`,
        {
          size: 6.5,
          bold: true,
        },
      );
      pdf.text(sx + 4, by + bh - 5, orderSheetStamp(signature.at), { size: 6 });
    }
  };
  signatureBox(y, 52, "Supplier signature and stamp", input.supplier);
  signatureBox(y + 56, 42, `${h.company} signature`, input.wellmix);
  y = infoY + infoH + 6;

  /* ---------------------------------------------------------------- */
  /* Itens: duas faixas por item                                       */
  /* ---------------------------------------------------------------- */
  const bandA = fit(ORDER_SHEET_BAND_A.map(([, w]) => w));
  const bandALabels = ORDER_SHEET_BAND_A.map(([label]) => label);
  const bandBDef = orderSheetBandB(sign);
  const bandB = fit(bandBDef.map(([, w]) => w));
  const bandBLabels = bandBDef.map(([label]) => label);
  const factoryW = 150;

  for (const item of sheet.items) {
    const valuesA = orderSheetValuesA(item);
    const valuesB = orderSheetValuesB(item);
    const comments = `Comments / Specifications: ${item.comments ?? ""}`;
    const commentLines = pdfWrap(comments, 6, usable - factoryW - 6);
    const commentsH = Math.max(34, commentLines.length * 7.6 + 6);
    const hA = measure(bandA, bandALabels, 5.5, false);
    const vA = Math.max(measure(bandA, valuesA, 5.5, false), 44);
    const hB = measure(bandB, bandBLabels, 5.2, false);
    const vB = Math.max(measure(bandB, valuesB, 6, false), 18);
    need(hA + vA + hB + vB + commentsH + 4);

    drawRow(M, bandA, bandALabels, { size: 5.5, height: hA });
    drawRow(M, bandA, valuesA, { size: 5.5, height: vA });
    drawRow(M, bandB, bandBLabels, { size: 5.2, height: hB });
    drawRow(M, bandB, valuesB, { size: 6, height: vB });
    // Comentários do item e a fábrica.
    pdf.rect(M, y, usable - factoryW, commentsH, 0.4);
    commentLines.forEach((line, i) =>
      pdf.text(M + 3, y + 8 + i * 7.6, line, { size: 6 }),
    );
    const fx = M + usable - factoryW;
    pdf.rect(fx, y, factoryW, commentsH, 0.4);
    pdf.text(fx + factoryW / 2, y + 8, "Factory", {
      size: 6,
      align: "center",
    });
    pdf.line(fx, y + commentsH / 2, fx + factoryW, y + commentsH / 2, 0.4);
    if (item.factory)
      pdf.text(fx + 3, y + commentsH / 2 + 9, item.factory, { size: 6 });
    y += commentsH + 4;
  }

  /* ---------------------------------------------------------------- */
  /* Totais                                                            */
  /* ---------------------------------------------------------------- */
  need(52);
  const totalsY = y;
  const tw = 110;
  const tx = M + usable / 2 - (3 * tw) / 2 - 60;
  orderSheetCargoTotals(sheet).forEach(([label, value], i) => {
    const x = tx + i * tw;
    pdf.rect(x, totalsY, tw, 14, 0.5);
    pdf.rect(x, totalsY + 14, tw, 14, 0.5);
    pdf.text(x + tw / 2, totalsY + 10, label, {
      size: 7,
      bold: true,
      align: "center",
    });
    pdf.text(x + tw / 2, totalsY + 24, value, {
      size: 7,
      bold: true,
      align: "center",
    });
  });
  const vw = 138;
  const vx = W - M - 2 * vw;
  orderSheetValueTotals(sheet).forEach(([label, value], i) => {
    const ry = totalsY + i * 14;
    pdf.rect(vx, ry, vw, 14, 0.5);
    pdf.rect(vx + vw, ry, vw, 14, 0.5);
    pdf.text(vx + vw / 2, ry + 10, label, {
      size: 6.5,
      bold: true,
      align: "center",
    });
    pdf.text(vx + vw + vw / 2, ry + 10, value, {
      size: 7,
      bold: true,
      align: "center",
    });
  });
  y = totalsY + 46;

  /* ---------------------------------------------------------------- */
  /* Comentários gerais                                                */
  /* ---------------------------------------------------------------- */
  need(70);
  pdf.fillRect(M, y, usable, 18, GRAY);
  pdf.rect(M, y, usable, 18, 0.6);
  pdf.text(M + usable / 2, y + 13.5, "Comments /Specifications", {
    size: 12,
    bold: true,
    align: "center",
  });
  y += 18;
  pdf.rect(M, y, usable, 44, 0.6);
  orderSheetGeneralNotes(sheet).forEach((line, i) =>
    pdf.text(M + 3, y + 9 + i * 8.5, line, { size: 6.5 }),
  );
  y += 44;

  /* ---------------------------------------------------------------- */
  /* Procedimentos                                                     */
  /* ---------------------------------------------------------------- */
  newPage();
  pdf.fillRect(M, y, usable, 18, GRAY);
  pdf.rect(M, y, usable, 18, 0.6);
  pdf.text(M + usable / 2, y + 13, ORDER_PROCEDURES_TITLE, {
    size: 12,
    bold: true,
    align: "center",
  });
  y += 22;
  const procW = 480;
  for (const section of ORDER_PROCEDURES) {
    need(16);
    pdf.rect(M, y, procW, 13, 0.5);
    pdf.text(M + 3, y + 10, section.title, { size: 9.5, bold: true });
    y += 13;
    for (const text of section.lines) {
      const lines = pdfWrap(` - ${text}`, 8, procW - 8);
      const height = lines.length * 10 + 3;
      need(height);
      pdf.rect(M, y, procW, height, 0.5);
      lines.forEach((line, i) =>
        pdf.text(M + 3, y + 9 + i * 10, line, { size: 8 }),
      );
      y += height;
    }
  }
  footer();
  return pdf.build();
}
