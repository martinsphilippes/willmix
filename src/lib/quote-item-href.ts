/**
 * Tela da Wellmix para um produto da cotação de compra, na Cotação unificada
 * (dono, 22/11/2026; docs/QUOTATION.md): o quadro comparativo do produto.
 */
export const quoteItemHref = (quoteId: string, productId: string | null) =>
  productId
    ? `/app/supplier-requests/${quoteId}?view=item&product=${productId}`
    : `/app/supplier-requests/${quoteId}`;
