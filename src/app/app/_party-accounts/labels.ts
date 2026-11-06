import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { pt as supplierTexts } from "@/i18n/modules/suppliers";
import type { AccountSide } from "@/lib/services/customer-accounts";

/** Textos da tela de contas: "supp.*" no fornecedor quando existe, senão "cust.*". */
export function accountLabels(t: Translate, side: AccountSide) {
  return (key: string, vars?: Record<string, string | number>) => {
    const supp = `supp.${key}`;
    return t(
      (side === "supplier" && supp in supplierTexts
        ? supp
        : `cust.${key}`) as DictionaryKey,
      vars,
    );
  };
}

export type AccountLabel = ReturnType<typeof accountLabels>;

/** Endereço base da tela de cada lado. */
export const accountBase = (side: AccountSide) =>
  side === "supplier" ? "/app/suppliers" : "/app/customers";
