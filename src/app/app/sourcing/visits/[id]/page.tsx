import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { loadVisit } from "@/lib/services/sourcing";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  LinkButton,
  PageHeader,
  TextLink,
  formatDate,
  formatMoney,
} from "@/components/ui";
import { VisitForm } from "../../_components/visit-form";
import {
  Thumb,
  errorMessage,
  formatNumber,
  sourcingTone,
  visitTone,
} from "../../_components/shared";

export default async function VisitPage({
  params,
  searchParams,
}: PageProps<"/app/sourcing/visits/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { id } = await params;
  const { error } = await searchParams;
  const data = await loadVisit(id);
  if (!data) notFound();
  const { visit, items, supplier } = data;
  const t = await getT();
  const suppliers = await getStore().list("parties", {
    filter: { type: "supplier" },
    orderBy: "name",
  });
  const title =
    visit.supplierName ??
    supplier?.name ??
    visit.factoryName ??
    t("sourcing.visit.title");
  const errorText = errorMessage(t, error);
  const addHref = `/app/sourcing/items/new?visitId=${encodeURIComponent(visit.id)}`;
  const negotiated = items.filter((i) => i.price !== null);

  return (
    <>
      <PageHeader
        help={{
          body: "help.sourcing.visit.body",
          steps: "help.sourcing.visit.steps",
        }}
        t={t}
        title={title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={visitTone(visit.status)}>
              {t(`sourcing.visitStatus.${visit.status}`)}
            </Badge>
            <span>{formatDate(visit.visitedAt)}</span>
            {visit.factoryName ? <span>· {visit.factoryName}</span> : null}
            {supplier ? (
              <TextLink href={`/app/parties/${supplier.id}`}>
                {t("common.supplier")}
              </TextLink>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href="/app/sourcing?tab=visits">
              {t("common.back")}
            </LinkButton>
            <LinkButton
              href={addHref}
              variant="primary"
              className="py-2.5 text-base sm:py-2 sm:text-sm"
            >
              + {t("sourcing.addItem")}
            </LinkButton>
          </>
        }
      />
      {errorText ? (
        <div className="mb-4">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Card title={t("sourcing.visit.summary")}>
            <DescriptionList
              items={[
                [t("sourcing.visit.date"), formatDate(visit.visitedAt)],
                [t("sourcing.visit.participants"), visit.participants ?? "—"],
                [
                  t("sourcing.visit.location"),
                  [visit.city, visit.location].filter(Boolean).join(" · ") ||
                    "—",
                ],
                [
                  t("sourcing.visit.items"),
                  t("sourcing.visit.itemsCount", { count: items.length }),
                ],
                [t("sourcing.visit.nextVisit"), formatDate(visit.nextVisitAt)],
                [t("sourcing.visit.followUp"), visit.followUp ?? "—"],
              ]}
            />
          </Card>
          <Card
            title={t("sourcing.visit.items")}
            actions={
              <LinkButton href={addHref} variant="secondary">
                + {t("sourcing.addItem")}
              </LinkButton>
            }
          >
            {items.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {t("sourcing.visit.noItems")}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/app/sourcing/items/${item.id}`}
                      className="flex gap-3 py-3 transition hover:bg-brand-50/40 active:bg-brand-50"
                    >
                      <Thumb
                        documentId={item.primaryPhotoDocumentId}
                        alt={
                          item.primaryPhotoDocumentId
                            ? item.name
                            : t("sourcing.noPhoto")
                        }
                        className="h-14 w-14"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900">
                          {item.name}
                        </p>
                        <p className="text-sm text-zinc-700">
                          {formatMoney(item.price, item.currency)}
                          {item.moq ? (
                            <span className="text-zinc-500">
                              {" "}
                              · {t("sourcing.moq")} {formatNumber(item.moq)}
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1">
                          <Badge tone={sourcingTone(item.status)}>
                            {t(`sourcing.status.${item.status}`)}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {negotiated.length > 0 ? (
              <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                {t("sourcing.negotiation.hint")}
              </p>
            ) : null}
          </Card>
        </div>
        <div className="min-w-0">
          <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900">
            {t("common.edit")}
          </h2>
          <VisitForm t={t} visit={visit} suppliers={suppliers} />
        </div>
      </div>
    </>
  );
}
