import type { Translate } from "@/i18n";
import type { QuickCustomerLabels } from "./quick-customer";

/** Textos do cadastro rápido de cliente (docs/ORDER_TERMS.md, seção 11.25). */
export function quickCustomerLabels(t: Translate): QuickCustomerLabels {
  return {
    open: t("quickCustomer.open"),
    title: t("quickCustomer.title"),
    hint: t("quickCustomer.hint"),
    cnpj: t("quickCustomer.cnpj"),
    name: t("quickCustomer.name"),
    legalName: t("quickCustomer.legalName"),
    city: t("quickCustomer.city"),
    state: t("quickCustomer.state"),
    phone: t("quickCustomer.phone"),
    email: t("quickCustomer.email"),
    lookup: {
      searching: t("quickCustomer.lookup.searching"),
      found: t("quickCustomer.lookup.found"),
      notFound: t("quickCustomer.lookup.notFound"),
      manual: t("quickCustomer.lookup.manual"),
      invalid: t("quickCustomer.lookup.invalid"),
    },
    existing: t("quickCustomer.existing", { name: "{name}" }),
    existingInactive: t("quickCustomer.existingInactive", { name: "{name}" }),
    useExisting: t("quickCustomer.useExisting"),
    save: t("quickCustomer.save"),
    saving: t("quickCustomer.saving"),
    cancel: t("quickCustomer.cancel"),
    done: t("quickCustomer.done", { name: "{name}" }),
    errors: {
      name: t("quickCustomer.error.name"),
      email: t("quickCustomer.error.email"),
      forbidden: t("quickCustomer.error.forbidden"),
      failed: t("quickCustomer.error.failed"),
    },
  };
}
