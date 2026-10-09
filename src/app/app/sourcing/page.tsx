import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  SOURCING_STATUSES,
  VISIT_STATUSES,
  type SourcingStatus,
  type VisitStatus,
} from "@/lib/db";
import { loadSourcingLists } from "@/lib/services/sourcing";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import {
  Thumb,
  errorMessage,
  formatNumber,
  sourcingTone,
  visitTone,
} from "./_components/shared";

/** Chip de filtro: selecionado na cor da marca, demais neutros (mesmo padrão de Parceiros). */
const chipClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1 font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

const tabClass = (selected: boolean) =>
  cx(
    "flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition sm:flex-none sm:px-4",
    selected
      ? "bg-white text-brand-700 shadow-sm ring-1 ring-inset ring-zinc-200"
      : "text-zinc-600 hover:text-zinc-900",
  );

export default async function SourcingPage({
  searchParams,
}: PageProps<"/app/sourcing">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { tab: tabParam, status: statusParam, error } = await searchParams;
  const tab = tabParam === "visits" ? "visits" : "items";
  const itemStatus =
    tab === "items" &&
    typeof statusParam === "string" &&
    (SOURCING_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as SourcingStatus)
      : null;
  const visitStatus =
    tab === "visits" &&
    typeof statusParam === "string" &&
    (VISIT_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as VisitStatus)
      : null;
  const t = await getT();
  const { items, visits, suppliers } = await loadSourcingLists({
    itemStatus,
    visitStatus,
  });
  const supplierName = (id: string | null, free: string | null) =>
    free ?? suppliers.find((s) => s.id === id)?.name ?? "—";
  const errorText = errorMessage(t, error);
  const href = (nextTab: "items" | "visits", status?: string | null) =>
    `/app/sourcing?tab=${nextTab}${status ? `&status=${status}` : ""}`;

  return (
    <>
      <PageHeader
        help={{ body: "help.sourcing.body", steps: "help.sourcing.steps" }}
        t={t}
        title={t("sourcing.title")}
        subtitle={t("sourcing.subtitle")}
        actions={
          <>
            <LinkButton
              href="/app/sourcing/visits/new"
              className="py-2.5 text-base sm:py-1.5 sm:text-sm"
            >
              + {t("sourcing.newVisit")}
            </LinkButton>
            <LinkButton
              href="/app/sourcing/items/new"
              variant="primary"
              className="py-2.5 text-base sm:py-1.5 sm:text-sm"
            >
              + {t("sourcing.newItem")}
            </LinkButton>
          </>
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      {/* Abas e filtros de situação na mesma linha a partir do tablet. */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <nav
          aria-label={t("sourcing.title")}
          className="flex shrink-0 gap-1 rounded-xl bg-zinc-200/60 p-1"
        >
          <Link
            href={href("items")}
            aria-current={tab === "items" ? "page" : undefined}
            className={tabClass(tab === "items")}
          >
            {t("sourcing.tab.items")}
          </Link>
          <Link
            href={href("visits")}
            aria-current={tab === "visits" ? "page" : undefined}
            className={tabClass(tab === "visits")}
          >
            {t("sourcing.tab.visits")}
          </Link>
        </nav>

        <div className="flex min-w-0 flex-wrap gap-1.5 text-sm">
          <Link
            href={href(tab)}
            aria-current={!itemStatus && !visitStatus ? "page" : undefined}
            className={chipClass(!itemStatus && !visitStatus)}
          >
            {t("common.all")}
          </Link>
          {tab === "items"
            ? SOURCING_STATUSES.map((s) => (
                <Link
                  key={s}
                  href={href("items", s)}
                  aria-current={itemStatus === s ? "page" : undefined}
                  className={chipClass(itemStatus === s)}
                >
                  {t(`sourcing.status.${s}`)}
                </Link>
              ))
            : VISIT_STATUSES.map((s) => (
                <Link
                  key={s}
                  href={href("visits", s)}
                  aria-current={visitStatus === s ? "page" : undefined}
                  className={chipClass(visitStatus === s)}
                >
                  {t(`sourcing.visitStatus.${s}`)}
                </Link>
              ))}
        </div>
      </div>

      {tab === "items" ? (
        items.length === 0 ? (
          <Empty>{t("sourcing.items.none")}</Empty>
        ) : (
          <>
            {/* Celular: cards com miniatura, um por linha. */}
            <ul className="space-y-2 md:hidden">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/app/sourcing/items/${item.id}`}
                    className="flex gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm transition active:bg-brand-50"
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
                      <p className="truncate font-semibold text-zinc-900">
                        {item.name}
                      </p>
                      <p className="truncate text-sm text-zinc-600">
                        {supplierName(item.supplierId, item.supplierName)}
                      </p>
                      <p className="text-sm text-zinc-800">
                        {formatMoney(item.price, item.currency, t)}
                        {item.moq ? (
                          <span className="text-zinc-500">
                            {" "}
                            · {t("sourcing.moq")}{" "}
                            {formatNumber(item.moq, t.intl)}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone={sourcingTone(item.status)}>
                          {t(`sourcing.status.${item.status}`)}
                        </Badge>
                        {item.requestId ? (
                          <Badge tone="brand">
                            {t("catalog.sourcing.demand")}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-zinc-500">
                          {formatDate(item.foundAt ?? item.createdAt, t)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Desktop: tabela. */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th className="w-16" />
                    <Th>{t("common.name")}</Th>
                    <Th>{t("common.supplier")}</Th>
                    <Th>{t("common.price")}</Th>
                    <Th>{t("sourcing.moq")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th>{t("sourcing.foundAt")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={rowClass}>
                      <Td>
                        <Thumb
                          documentId={item.primaryPhotoDocumentId}
                          alt={
                            item.primaryPhotoDocumentId
                              ? item.name
                              : t("sourcing.noPhoto")
                          }
                          className="h-10 w-10"
                        />
                      </Td>
                      <Td>
                        <TextLink href={`/app/sourcing/items/${item.id}`}>
                          {item.name}
                        </TextLink>
                        {item.supplierSku ? (
                          <span className="block font-mono text-xs text-zinc-500">
                            {item.supplierSku}
                          </span>
                        ) : null}
                        {item.requestId ? (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone="brand">
                              {t("catalog.sourcing.demand")}
                            </Badge>
                            <TextLink
                              href={`/app/requests/${item.requestId}`}
                              className="text-xs"
                            >
                              {t("catalog.sourcing.demand.open")}
                            </TextLink>
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {supplierName(item.supplierId, item.supplierName)}
                      </Td>
                      <Td>{formatMoney(item.price, item.currency, t)}</Td>
                      <Td>{formatNumber(item.moq, t.intl)}</Td>
                      <Td>
                        <Badge tone={sourcingTone(item.status)}>
                          {t(`sourcing.status.${item.status}`)}
                        </Badge>
                      </Td>
                      <Td>{formatDate(item.foundAt ?? item.createdAt, t)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )
      ) : visits.length === 0 ? (
        <Empty>{t("sourcing.visits.none")}</Empty>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/app/sourcing/visits/${visit.id}`}
                  className="block rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm transition active:bg-brand-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold text-zinc-900">
                      {supplierName(visit.supplierId, visit.supplierName)}
                      {visit.factoryName ? (
                        <span className="block truncate text-sm font-normal text-zinc-600">
                          {visit.factoryName}
                        </span>
                      ) : null}
                    </p>
                    <Badge tone={visitTone(visit.status)}>
                      {t(`sourcing.visitStatus.${visit.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {[visit.city, visit.location].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-800">
                    {formatDate(visit.visitedAt, t)}
                    {visit.participants ? (
                      <span className="text-zinc-500">
                        {" "}
                        · {visit.participants}
                      </span>
                    ) : null}
                  </p>
                  {visit.nextVisitAt ? (
                    <p className="mt-1 text-xs text-brand-700">
                      {t("sourcing.visit.nextVisit")}:{" "}
                      {formatDate(visit.nextVisitAt, t)}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.supplier")}</Th>
                  <Th>{t("sourcing.visit.location")}</Th>
                  <Th>{t("common.date")}</Th>
                  <Th>{t("sourcing.visit.participants")}</Th>
                  <Th>{t("sourcing.visit.nextVisit")}</Th>
                  <Th>{t("common.status")}</Th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className={rowClass}>
                    <Td>
                      <TextLink href={`/app/sourcing/visits/${visit.id}`}>
                        {supplierName(visit.supplierId, visit.supplierName)}
                      </TextLink>
                      {visit.factoryName ? (
                        <span className="block text-xs text-zinc-500">
                          {visit.factoryName}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      {[visit.city, visit.location]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Td>
                    <Td>{formatDate(visit.visitedAt, t)}</Td>
                    <Td>{visit.participants ?? "—"}</Td>
                    <Td>{formatDate(visit.nextVisitAt, t)}</Td>
                    <Td>
                      <Badge tone={visitTone(visit.status)}>
                        {t(`sourcing.visitStatus.${visit.status}`)}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
