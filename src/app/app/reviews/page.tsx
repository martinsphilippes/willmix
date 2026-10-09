import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore, REVIEW_STATUSES, type ReviewStatus } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import { fallbackError } from "@/i18n/error-text";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Empty,
  Input,
  PageHeader,
  TextLink,
  cx,
  formatDate,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { decideReviewAction } from "../actions/reviews";

/** Chip de filtro: selecionado na cor da marca, demais neutros (mesmo padrão de Parceiros/Sourcing). */
const chipClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

/** Regra traduzida quando conhecida; senão o código da regra. */
function ruleLabel(t: Translate, rule: string) {
  const key = `reviews.rule.${rule}` as DictionaryKey;
  const text = t(key);
  return text === key ? rule : text;
}

function errorMessage(t: Translate, code: string | string[] | undefined) {
  if (typeof code !== "string" || !code) return null;
  const key = `reviews.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? fallbackError(t, code) : text;
}

/** Fila "itens para revisão" (Wellmix): abertos por padrão; histórico por filtro. */
export default async function ReviewsPage({
  searchParams,
}: PageProps<"/app/reviews">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { status: statusParam, error } = await searchParams;
  const status: ReviewStatus =
    typeof statusParam === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as ReviewStatus)
      : "open";
  const t = await getT();
  const store = getStore();
  const [all, orders, containers, users] = await Promise.all([
    store.list("review_items", { orderBy: "createdAt", direction: "desc" }),
    store.list("orders"),
    store.list("containers"),
    store.list("users"),
  ]);
  const items = all.filter((r) => r.status === status);
  const counts = Object.fromEntries(
    REVIEW_STATUSES.map((s) => [s, all.filter((r) => r.status === s).length]),
  ) as Record<ReviewStatus, number>;
  const entityLabel = (r: (typeof all)[number]) => {
    if (r.entity === "container") {
      const c = containers.find((x) => x.id === r.entityId);
      return `${t("reviews.entity.container")} ${c?.code ?? r.entityId}`;
    }
    const order =
      orders.find((o) => o.id === (r.orderId ?? r.entityId)) ?? null;
    return order
      ? t("orders.number", { number: order.number })
      : `${t("reviews.entity.order")} ${r.entityId}`;
  };
  const userName = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? "—";
  const errorText = errorMessage(t, error);

  return (
    <>
      <PageHeader
        help={{ body: "help.reviews.body", steps: "help.reviews.steps" }}
        t={t}
        title={t("reviews.title")}
        subtitle={t("reviews.subtitle")}
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      <nav
        aria-label={t("common.status")}
        className="mt-4 mb-4 flex flex-wrap gap-2"
      >
        {REVIEW_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/reviews?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={chipClass(s === status)}
          >
            {t(`reviews.filter.${s}`)}{" "}
            <span
              className={cx(
                "ml-1 rounded-full px-1.5 text-xs tabular-nums",
                s === status
                  ? "bg-white/20 text-white"
                  : "bg-zinc-100 text-zinc-600",
              )}
            >
              {counts[s]}
            </span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <Empty>
          {status === "open" ? t("reviews.none.open") : t("reviews.none")}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        r.status === "open"
                          ? r.rule.startsWith("inspection.")
                            ? "danger"
                            : "warning"
                          : r.status === "resolved"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {ruleLabel(t, r.rule)}
                    </Badge>
                    {r.status !== "open" ? (
                      <Badge
                        tone={r.status === "resolved" ? "success" : "neutral"}
                      >
                        {t(`reviews.status.${r.status}`)}
                      </Badge>
                    ) : null}
                    <span className="text-sm font-semibold text-zinc-900">
                      {entityLabel(r)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-800">{r.problem}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("reviews.openedAt", {
                      date: formatDate(r.createdAt, t),
                    })}
                  </p>
                </div>
                {r.link ? (
                  <TextLink href={r.link} className="whitespace-nowrap text-sm">
                    {t("tasks.open")}
                  </TextLink>
                ) : null}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t("reviews.expected")}
                  </dt>
                  <dd className="mt-0.5 text-zinc-900">{r.expected ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t("reviews.found")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-zinc-900">
                    {r.found ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t("common.responsible")}
                  </dt>
                  <dd className="mt-0.5 text-zinc-900">
                    {r.responsibleRole ? t(`role.${r.responsibleRole}`) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t("reviews.action")}
                  </dt>
                  <dd className="mt-0.5 text-zinc-900">{r.action ?? "—"}</dd>
                </div>
              </dl>

              {r.status === "open" ? (
                <form
                  action={decideReviewAction}
                  className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={status} />
                  <Input
                    name="note"
                    maxLength={2000}
                    placeholder={t("reviews.noteHint")}
                    aria-label={t("common.note")}
                    className="py-2.5 text-base sm:flex-1 sm:py-2 sm:text-sm"
                  />
                  <div className="flex gap-2">
                    <SubmitButton
                      name="decision"
                      value="resolved"
                      className="flex-1 py-2.5 text-base sm:flex-none sm:py-2 sm:text-sm"
                    >
                      {t("reviews.resolve")}
                    </SubmitButton>
                    <SubmitButton
                      name="decision"
                      value="dismissed"
                      variant="secondary"
                      className="flex-1 py-2.5 text-base sm:flex-none sm:py-2 sm:text-sm"
                    >
                      {t("reviews.dismiss")}
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                  {t("reviews.decidedBy", {
                    name: userName(r.resolvedByUserId),
                    date: formatDate(r.resolvedAt, t),
                  })}
                  {r.resolutionNote ? ` · ${r.resolutionNote}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
