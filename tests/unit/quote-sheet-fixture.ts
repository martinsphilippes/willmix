/*
 * Ficha técnica completa para as respostas de cotação nos testes (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação"): a
 * resposta agora leva a ficha de cada produto na primeira vez do par.
 * "Confirmo" marcado: vale para quem já vendeu e é ignorado para quem não.
 *
 * Desde 21/11/2026: sem inner (é exigência do cliente, na cotação), o
 * material pelo catálogo ("mat-vidro", da lista inicial) e "Sem peso".
 */
export const MATERIAL_VIDRO = "mat-vidro";

export function sheetFor(
  productId: string,
  patch: Partial<{
    masterBoxQty: number | null;
    boxLengthCm: number | null;
    boxWidthCm: number | null;
    boxHeightCm: number | null;
    cbm: number | null;
    netWeightKg: number | null;
    grossWeightBoxKg: number | null;
    grossUnknown: boolean;
    materialIds: string[];
    factoryItemCode: string;
    noFactoryCode: boolean;
  }> = {},
  confirmed = true,
) {
  return {
    productId,
    confirmed,
    draft: {
      masterBoxQty: 24,
      boxLengthCm: 60,
      boxWidthCm: 40,
      boxHeightCm: 35,
      cbm: null,
      netWeightKg: 0.45,
      grossWeightBoxKg: 12.5,
      grossUnknown: false,
      materialIds: [MATERIAL_VIDRO],
      factoryItemCode: "JR-01",
      noFactoryCode: false,
      ...patch,
    },
  };
}
