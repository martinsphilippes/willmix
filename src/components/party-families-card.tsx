import type { Translate } from "@/i18n";
import { uniqueByCode } from "@/lib/party-families";
import {
  ensureFamilyRegistry,
  listProductFamilies,
  partyFamilyCodes,
} from "@/lib/services/product-families";
import {
  refreshPartyFamiliesAction,
  setPartyFamiliesAction,
} from "@/app/app/actions/party-families";
import { Card, formatDate } from "./ui";
import { SubmitButton } from "./submit-button";
import { PartyFamiliesPicker } from "./party-families-picker";

/** Erros desta seção (?error=) com texto próprio. */
const FAMILY_ERRORS = [
  "family_unknown",
  "family_party_type",
  "families_sankhya_unavailable",
] as const;

/*
 * Seção "Grupo de produto (família)" do cadastro do parceiro (dono,
 * 18/11/2026; docs/PARTNER_FAMILIES.md), no lugar das "Linhas atendidas":
 * Fornecedor (/app/suppliers/<id>, aba Informações) e Trading, Supplier e
 * Factory (/app/parties/<id>). As famílias são o cadastro do portal (1º
 * nível dos grupos do Sankhya); o parceiro marcado entra na cotação de
 * compra das linhas delas.
 */
export async function PartyFamiliesCard({
  partyId,
  screen,
  t,
  admin,
  notice,
  error,
  synced,
}: {
  partyId: string;
  /** Tela onde a seção está: gravar volta para ela. */
  screen: "suppliers" | "parties";
  t: Translate;
  /** O administrador vê o "Atualizar do Sankhya". */
  admin: boolean;
  /** ?families=saved | synced */
  notice: string | null;
  error: string | null;
  /** Quantas famílias vieram na atualização (?n=). */
  synced: string | null;
}) {
  // Cadastro vazio: carrega do Sankhya uma vez (como os resumos dos pedidos).
  await ensureFamilyRegistry();
  const [all, mine] = await Promise.all([
    listProductFamilies({ includeInactive: true }),
    partyFamilyCodes(partyId),
  ]);
  // Inativa (sumiu do Sankhya) só aparece se o parceiro ainda a tem.
  const families = uniqueByCode(all).filter(
    (f) => f.active || mine.includes(f.code),
  );
  const lastSync = all
    .map((f) => f.syncedAt)
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  const errorText =
    error && (FAMILY_ERRORS as readonly string[]).includes(error)
      ? t(`partyFamilies.error.${error}` as Parameters<Translate>[0])
      : null;
  return (
    <section id="families" className="mt-4 scroll-mt-4">
      <Card title={t("partyFamilies.title")}>
        <div className="space-y-3" data-party-families={mine.length}>
          <p className="text-xs text-zinc-600">{t("partyFamilies.hint")}</p>
          {notice === "saved" ? (
            <p
              className="text-xs font-medium text-emerald-700"
              role="status"
              data-party-families-saved
            >
              {t("partyFamilies.saved")}
            </p>
          ) : null}
          {notice === "synced" ? (
            <p className="text-xs font-medium text-emerald-700" role="status">
              {t("partyFamilies.synced", { n: synced ?? "0" })}
            </p>
          ) : null}
          {errorText ? (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900"
              role="alert"
            >
              {errorText}
            </p>
          ) : null}
          {families.length ? (
            <form action={setPartyFamiliesAction} className="space-y-3">
              <input type="hidden" name="partyId" value={partyId} />
              <input type="hidden" name="screen" value={screen} />
              <PartyFamiliesPicker
                families={families.map((f) => ({
                  code: f.code,
                  name: f.name,
                  active: f.active,
                }))}
                selected={mine}
                labels={{
                  search: t("partyFamilies.search"),
                  selected: t("partyFamilies.selected", { n: "{n}" }),
                  none: t("partyFamilies.none"),
                  noMatch: t("partyFamilies.noMatch"),
                  code: t("partyFamilies.code", { code: "{code}" }),
                  inactive: t("partyFamilies.inactive"),
                  remove: t("partyFamilies.remove", { name: "{name}" }),
                }}
              />
              <SubmitButton data-party-families-save>
                {t("partyFamilies.save")}
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-zinc-600" data-party-families-empty>
              {t("partyFamilies.empty")}
            </p>
          )}
          {admin ? (
            <form
              action={refreshPartyFamiliesAction}
              className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500"
            >
              <input type="hidden" name="partyId" value={partyId} />
              <input type="hidden" name="screen" value={screen} />
              <SubmitButton variant="secondary" data-party-families-sync>
                {t("partyFamilies.sync")}
              </SubmitButton>
              {lastSync ? (
                <span>
                  {t("partyFamilies.syncedAt", {
                    date: formatDate(lastSync, t),
                  })}
                </span>
              ) : null}
            </form>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
