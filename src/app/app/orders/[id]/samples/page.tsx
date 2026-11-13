import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getSampleOrderView } from "@/lib/services/sample-order";
import { SAMPLES_PER_VARIANT, sampleTotal } from "@/lib/sample-order";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  acceptSampleOrderAction,
  decideSampleOrderAction,
} from "../../../actions/sample-order";

/*
 * Pedido de amostras (contrato secundário do pedido de compra;
 * docs/SAMPLE_ORDER.md). Só a Wellmix e o fornecedor do pedido abrem.
 */
export default async function SampleOrderPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/samples">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id } = await params;
  const { error, decided, accepted } = await searchParams;
  const view = await getSampleOrderView(user, id);
  if (!view || !view.applies) notFound();
  const t = await getT();
  const { order, doc, acceptance } = view;
  const wellmix = isWellmix(user);
  const lines = doc ? doc.lines : view.proposal;
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `sampleOrder.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const status = !doc
    ? "pending"
    : doc.status === "none"
      ? "none"
      : acceptance
        ? "accepted"
        : "sent";

  return (
    <>
      <PageHeader
        t={t}
        title={t("sampleOrder.title", { n: String(order.number) })}
        subtitle={t("sampleOrder.subtitle")}
        actions={
          <Link href={`/app/orders/${order.id}`} className={linkClass}>
            {t("sampleOrder.back")}
          </Link>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {decided || accepted ? (
        <Alert tone="success">
          {t(
            accepted
              ? "sampleOrder.done.accepted"
              : decided === "none"
                ? "sampleOrder.done.none"
                : "sampleOrder.done.ordered",
          )}
        </Alert>
      ) : null}
      <Card
        title={t("sampleOrder.card.title")}
        actions={
          <Badge
            tone={
              status === "accepted" || status === "none" ? "success" : "neutral"
            }
          >
            <span data-sample-order-status={status}>
              {t(`sampleOrder.status.${status}` as DictionaryKey)}
            </span>
          </Badge>
        }
      >
        <p className="mb-3 text-sm text-zinc-600">
          {t("sampleOrder.rule", { n: String(SAMPLES_PER_VARIANT) })}
        </p>
        {doc?.status === "none" ? (
          <p className="text-sm text-zinc-700" data-sample-order-none>
            {t("sampleOrder.noneBy", {
              name: doc.userName,
              date: formatDate(doc.at, t),
            })}
            {doc.note ? ` · ${doc.note}` : ""}
          </p>
        ) : (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("sampleOrder.col.product")}</Th>
                <Th className="text-right">{t("sampleOrder.col.variants")}</Th>
                <Th className="text-right">{t("sampleOrder.col.quantity")}</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.itemId} data-sample-line={l.itemId}>
                  <Td>{l.name}</Td>
                  <Td className="text-right">{l.variants}</Td>
                  <Td className="text-right font-medium" data-sample-qty>
                    {l.quantity}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold">{t("sampleOrder.total")}</Td>
                <Td />
                <Td className="text-right font-semibold" data-sample-total>
                  {sampleTotal(lines)}
                </Td>
              </tr>
            </tbody>
          </Table>
        )}
        {doc?.status === "ordered" ? (
          <p className="mt-2 text-xs text-zinc-500">
            {t("sampleOrder.orderedBy", {
              name: doc.userName,
              date: formatDate(doc.at, t),
            })}
            {acceptance
              ? ` · ${t("sampleOrder.acceptedBy", {
                  name: acceptance.name,
                  date: formatDate(acceptance.at, t),
                })}`
              : ""}
          </p>
        ) : null}
      </Card>

      {view.canDecide ? (
        <Card title={t("sampleOrder.decide.title")} dense>
          <p className="mb-3 text-sm text-zinc-600">
            {t("sampleOrder.decide.hint")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form action={decideSampleOrderAction} data-sample-order-create>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="ordered" />
              <SubmitButton>{t("sampleOrder.decide.create")}</SubmitButton>
            </form>
            <form
              action={decideSampleOrderAction}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              data-sample-order-skip
            >
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="none" />
              <Field label={t("sampleOrder.decide.noteLabel")}>
                <Input name="note" maxLength={500} />
              </Field>
              <SubmitButton variant="secondary">
                {t("sampleOrder.decide.none")}
              </SubmitButton>
            </form>
          </div>
        </Card>
      ) : !doc && wellmix && !view.open ? (
        <Alert tone="info">{t("sampleOrder.waitContract")}</Alert>
      ) : null}

      {view.canAccept && doc ? (
        <Card title={t("sampleOrder.accept.title")} dense>
          <form
            action={acceptSampleOrderAction}
            className="space-y-3"
            data-sample-order-accept
          >
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="hash" value={doc.hash} />
            <Field label={t("sampleOrder.accept.name")}>
              <Input name="name" required minLength={3} maxLength={120} />
            </Field>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="agree" required className="mt-1" />
              <span>{t("sampleOrder.accept.agree")}</span>
            </label>
            <SubmitButton>{t("sampleOrder.accept.submit")}</SubmitButton>
          </form>
        </Card>
      ) : null}
    </>
  );
}
