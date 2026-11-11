import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  canFillBookingNcm,
  pendingNcmGroups,
} from "@/lib/services/booking-ncm";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  formatDate,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { applyNcmGroupAction } from "../actions/booking-ncm";

/*
 * NCM dos itens de booking (docs/BOOKING.md, "NCM do item"): os itens sem
 * produto parecido no cadastro, agrupados pelos parecidos, para o despachante
 * (ou a Wellmix) classificar de uma vez. Só o produto: sem fornecedor, preço
 * nem cliente.
 */
export default async function NcmItemsPage({
  searchParams,
}: PageProps<"/app/ncm-items">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/ncm-items");
  requireScreen(user, "tasks");
  if (!canFillBookingNcm(user)) notFound();
  const query = await searchParams;
  const one = (k: string) => {
    const v = query[k];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  const groups = await pendingNcmGroups(user);

  const error = one("error");
  const key = [
    `bookingNcm.error.${error}`,
    `bookingLots.error.${error}`,
    `common.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error ? null : key ? t(key) : fallbackError(t, error);
  const done = Number(one("done")) || 0;

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingNcm.page.title")}
        subtitle={t("bookingNcm.page.subtitle")}
      />
      <div className="mb-3 space-y-2">
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {done ? (
          <Alert tone="success">{t("bookingNcm.page.done", { n: done })}</Alert>
        ) : null}
      </div>
      {groups.length ? (
        <div className="space-y-4" data-ncm-groups>
          {groups.map((group) => (
            <Card
              key={group.key}
              title={t("bookingNcm.page.group", {
                key: group.key,
                n: group.items.length,
              })}
            >
              <form
                action={applyNcmGroupAction}
                className="space-y-3"
                data-ncm-group={group.key}
              >
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        name="itemIds"
                        value={item.id}
                        defaultChecked
                        className="mt-1"
                        aria-label={item.description ?? item.id}
                        data-ncm-item={item.id}
                      />
                      <span className="flex-1">
                        <span className="font-medium">
                          {item.description ?? item.productName ?? "—"}
                        </span>{" "}
                        <span className="text-xs text-zinc-500">
                          {[
                            item.factoryItemCode,
                            item.material
                              ? `${t("bookingNcm.page.material")}: ${item.material}`
                              : null,
                            item.packageType
                              ? `${t("bookingNcm.page.package")}: ${item.packageType}`
                              : null,
                            item.capacityMl
                              ? `${t("bookingNcm.page.capacity")}: ${item.capacityMl}`
                              : null,
                            item.size
                              ? `${t("bookingNcm.page.size")}: ${item.size}`
                              : null,
                            item.colorAssortment
                              ? `${t("bookingNcm.page.color")}: ${item.colorAssortment}`
                              : null,
                            item.powerDetail
                              ? `${t("bookingNcm.page.function")}: ${item.powerDetail}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-0.5 text-xs text-zinc-500">
                        {item.lotNumber !== null ? (
                          <Badge>
                            {t("bookingNcm.page.booking", {
                              n: item.lotNumber,
                            })}
                          </Badge>
                        ) : null}
                        {item.requestedAt ? (
                          <span>
                            {t("bookingNcm.page.since", {
                              date: formatDate(item.requestedAt, t),
                            })}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-48">
                    <Field label={t("bookingNcm.page.ncm")}>
                      <Input
                        name="ncm"
                        required
                        inputMode="numeric"
                        maxLength={12}
                        placeholder="0000.00.00"
                        data-ncm-group-input={group.key}
                      />
                    </Field>
                  </div>
                  <SubmitButton
                    pendingText={t("bookingNcm.page.pending")}
                    data-ncm-group-submit={group.key}
                  >
                    {t("bookingNcm.page.apply")}
                  </SubmitButton>
                </div>
              </form>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{t("bookingNcm.page.empty")}</Empty>
      )}
    </>
  );
}
