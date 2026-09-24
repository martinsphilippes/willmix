import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewQuote } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  Textarea,
  cx,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { answerQuoteAction } from "../../actions";

/** Fornecedor vê a RFQ e responde. Não vê outros fornecedores nem o cliente final. */
export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/app/quotes/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { error } = await searchParams;
  const store = getStore();
  const quote = await store.get("quotes", id);
  if (!quote || !canViewQuote(user, quote)) notFound();
  const request = await store.get("requests", quote.requestId);
  if (!request) notFound();
  const t = await getT();
  const documents = await store.list("documents", {
    filter: { requestId: request.id },
  });
  const canAnswer = quote.status === "invited" || quote.status === "answered";

  return (
    <>
      <PageHeader
        help={{ body: "help.quote.body", steps: "help.quote.steps" }}
        t={t}
        title={`${t("quotes.title")}: ${request.productName}`}
        subtitle={
          <Badge
            tone={
              quote.status === "selected"
                ? "success"
                : quote.status === "rejected"
                  ? "neutral"
                  : quote.status === "invited"
                    ? "neutral"
                    : "info"
            }
          >
            {t(`quoteStatus.${quote.status}`)}
          </Badge>
        }
      />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("requests.title")}>
          <DescriptionList
            items={[
              [t("common.quantity"), `${request.quantity} ${request.unit}`],
              [t("requests.deadline"), formatDate(request.deadline)],
              [t("quotes.validUntil"), formatDate(quote.validUntil)],
              [t("requests.description"), request.description],
              [t("requests.specification"), request.specification],
            ]}
          />
          {documents.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-sm">
              {documents
                .filter(
                  (d) =>
                    d.visibility !== "internal" && d.visibility !== "customer",
                )
                .map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/api/files/${d.id}`}
                      className={linkClass}
                      target="_blank"
                    >
                      {d.name}
                    </a>
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
        <Card
          title={t("quotes.answer")}
          className={cx(
            quote.status === "invited" &&
              "border-brand-300! ring-4 ring-brand-50",
          )}
        >
          <div className="space-y-4">
            {quote.status === "selected" ? (
              <Alert tone="success">{t("quotes.selected")}</Alert>
            ) : null}
            {quote.status === "rejected" ? (
              <Alert tone="neutral">{t("quotes.rejected")}</Alert>
            ) : null}
            {quote.status === "answered" ? (
              <Alert tone="info">{t("quotes.answered")}</Alert>
            ) : null}
            {canAnswer ? (
              <form action={answerQuoteAction} className="space-y-3">
                <input type="hidden" name="quoteId" value={quote.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`${t("common.price")} / ${request.unit}`}>
                    <Input
                      name="price"
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      defaultValue={quote.price ?? ""}
                    />
                  </Field>
                  <Field label={t("common.currency")}>
                    <Input
                      name="currency"
                      maxLength={3}
                      defaultValue={quote.currency ?? "USD"}
                      required
                    />
                  </Field>
                </div>
                <Field label={t("common.leadTime")}>
                  <Input
                    name="leadTimeDays"
                    type="number"
                    min="1"
                    required
                    defaultValue={quote.leadTimeDays ?? ""}
                  />
                </Field>
                <Field label={t("common.conditions")}>
                  <Textarea
                    name="conditions"
                    defaultValue={quote.conditions ?? ""}
                    placeholder="FOB Shenzhen, 30% deposit, 70% before shipment"
                  />
                </Field>
                <SubmitButton>{t("common.send")}</SubmitButton>
              </form>
            ) : (
              <DescriptionList
                items={[
                  [
                    t("common.price"),
                    quote.price !== null
                      ? `${quote.currency} ${quote.price}`
                      : "—",
                  ],
                  [t("common.leadTime"), quote.leadTimeDays],
                  [t("common.conditions"), quote.conditions],
                ]}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
