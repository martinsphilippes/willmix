import type { Translate } from "@/i18n";
import type { PartyPickerLabels } from "./party-picker";

/** Textos do campo de cliente/fornecedor com busca, no idioma de quem vê. */
export function partyPickerLabels(t: Translate): PartyPickerLabels {
  return {
    placeholder: t("partyPicker.placeholder"),
    typeMore: t("partyPicker.typeMore"),
    none: t("partyPicker.none"),
    loading: t("partyPicker.loading"),
    pick: t("partyPicker.pick"),
    clear: t("partyPicker.clear"),
  };
}
