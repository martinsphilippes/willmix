/*
 * Ficha técnica completa para as respostas de cotação nos testes (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação"): a
 * resposta agora leva a ficha de cada produto na primeira vez do par.
 * "Confirmo" marcado: vale para quem já vendeu e é ignorado para quem não.
 */
export function sheetFor(
  productId: string,
  patch: Partial<{
    masterBoxQty: number | null;
    innerBoxQty: number | null;
    noInner: boolean;
    boxLengthCm: number | null;
    boxWidthCm: number | null;
    boxHeightCm: number | null;
    cbm: number | null;
    netWeightKg: number | null;
    grossWeightBoxKg: number | null;
    material: string;
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
      innerBoxQty: 6,
      noInner: false,
      boxLengthCm: 60,
      boxWidthCm: 40,
      boxHeightCm: 35,
      cbm: null,
      netWeightKg: 0.45,
      grossWeightBoxKg: 12.5,
      material: "Vidro",
      factoryItemCode: "JR-01",
      noFactoryCode: false,
      ...patch,
    },
  };
}
