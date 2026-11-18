import type { Translate } from "@/i18n";
import { Alert, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { familyCatalog } from "@/lib/services/product-origin";
import { partnerFamilies } from "@/lib/services/partner-families";
import { setPartnerFamiliesAction } from "../actions/purchase-demand";

/*
 * Famílias atendidas (cadastro do parceiro; dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Estratégia de Compra por produto"): Fornecedor,
 * Trading, Supplier e Factory marcados numa família aparecem na Estratégia
 * de Compra para cotar os produtos dela. A lista é a das famílias do
 * catálogo (1º nível da árvore de grupos do Sankhya).
 */
export async function PartnerFamiliesCard({
  partyId,
  back,
  saved,
  t,
}: {
  partyId: string;
  /** Endereço do cadastro (para voltar depois de salvar). */
  back: string;
  saved: boolean;
  t: Translate;
}) {
  const [catalog, mine] = await Promise.all([
    familyCatalog().catch(() => []),
    partnerFamilies(partyId),
  ]);
  const marked = new Set(mine.map((m) => m.familyKey));
  // Marcada antes e fora da lista agora: continua aparecendo (e marcada).
  const gone = mine.filter((m) => !catalog.some((c) => c.key === m.familyKey));
  return (
    <section
      id="partner-families"
      className="mt-4"
      data-partner-families={mine.length}
    >
      <Card title={t("family.card.title")}>
        <p className="mb-2 text-xs text-zinc-600">{t("family.card.hint")}</p>
        {saved ? (
          <div className="mb-2" role="status" data-partner-families-saved>
            <Alert tone="success">{t("family.card.saved")}</Alert>
          </div>
        ) : null}
        {catalog.length || gone.length ? (
          <form action={setPartnerFamiliesAction} className="space-y-3">
            <input type="hidden" name="partyId" value={partyId} />
            <input type="hidden" name="back" value={back} />
            <p className="text-xs font-medium text-zinc-700">
              {t("family.card.count", { n: mine.length })}
            </p>
            <div className="grid max-h-80 gap-1 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((f) => (
                <label
                  key={f.key}
                  className="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    name="familyKey"
                    value={f.key}
                    defaultChecked={marked.has(f.key)}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    data-partner-family={f.key}
                  />
                  <span className="min-w-0">
                    <span className="text-zinc-900">{f.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {t("family.card.products", { n: f.products })}
                    </span>
                  </span>
                </label>
              ))}
              {gone.map((f) => (
                <label
                  key={f.familyKey}
                  className="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="familyKey"
                    value={f.familyKey}
                    defaultChecked
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    data-partner-family={f.familyKey}
                  />
                  <span className="min-w-0">
                    <span className="text-zinc-900">{f.familyName}</span>
                    <span className="block text-xs text-amber-700">
                      {t("family.card.gone")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <SubmitButton data-partner-families-save>
              {t("family.card.save")}
            </SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-zinc-500" data-partner-families-empty>
            {t("family.card.empty")}
          </p>
        )}
      </Card>
    </section>
  );
}
