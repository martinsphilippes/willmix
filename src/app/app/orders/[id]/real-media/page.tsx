import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import { realMediaView } from "@/lib/services/sample-flow";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  decideRealMediaAction,
  sendRealMediaAction,
} from "../../../actions/sample-flow";

/*
 * Fotos e vídeos reais do produto (mapa R15, R16 e R5; docs/SAMPLE_FLOW.md):
 * a agência de marketing na China envia por produto; o marketing aprova
 * (fotos reais no catálogo e venda ativa) ou pede para refazer.
 */
export default async function RealMediaPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/real-media">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id } = await params;
  const { error, done } = await searchParams;
  const view = await realMediaView(user, id);
  if (!view) notFound();
  const t = await getT();
  const { order } = view;
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `realMedia.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const doneKey =
    `realMedia.done.${typeof done === "string" ? done : ""}` as DictionaryKey;
  const docIds = view.lines.flatMap((l) => l.row?.documentIds ?? []);
  const docs = docIds.length
    ? await getStore()
        .list("documents", { filter: { id: docIds } })
        .catch(() => [])
    : [];

  return (
    <>
      <PageHeader
        t={t}
        title={t("realMedia.title", { n: String(order.number) })}
        subtitle={t("realMedia.subtitle")}
        actions={
          <Link href={`/app/orders/${order.id}`} className={linkClass}>
            {t("realMedia.back")}
          </Link>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {t(doneKey) !== doneKey ? (
        <Alert tone="success">{t(doneKey)}</Alert>
      ) : null}
      {!view.open ? <Alert tone="info">{t("realMedia.waiting")}</Alert> : null}
      {view.lines.map((l) => {
        const files = docs.filter((d) => l.row?.documentIds.includes(d.id));
        return (
          <div
            key={l.itemId}
            id={`item-${l.itemId}`}
            className="scroll-mt-24"
            data-real-media-item={l.itemId}
          >
            <Card
              title={productNameText(t, l.name)}
              actions={
                <Badge
                  tone={
                    l.status === "approved"
                      ? "success"
                      : l.status === "rejected"
                        ? "danger"
                        : l.status === "sent"
                          ? "warning"
                          : "neutral"
                  }
                >
                  <span data-real-media-status={l.status}>
                    {t(`realMedia.status.${l.status}` as DictionaryKey)}
                  </span>
                </Badge>
              }
            >
              {l.status === "rejected" && l.row?.reason ? (
                <Alert tone="danger">{l.row.reason}</Alert>
              ) : null}
              {files.length ? (
                <ul className="mb-3 flex flex-wrap gap-2">
                  {files.map((d) => (
                    <li key={d.id}>
                      {d.mime.startsWith("image/") ? (
                        <a href={`/api/files/${d.id}`} target="_blank">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/files/${d.id}`}
                            alt={d.name}
                            className="h-24 w-24 rounded-lg border border-zinc-200 object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={`/api/files/${d.id}`}
                          className="flex h-24 w-24 items-center justify-center rounded-lg border border-zinc-200 text-xs text-brand-700 underline"
                        >
                          {t("realMedia.video")}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {l.row?.sentAt ? (
                <p className="mb-3 text-xs text-zinc-500">
                  {formatDate(l.row.sentAt, t)}
                </p>
              ) : null}
              {view.canSend &&
              l.status !== "approved" &&
              l.status !== "sent" ? (
                <form
                  action={sendRealMediaAction}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  data-real-media-send={l.itemId}
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="itemId" value={l.itemId} />
                  <Field label={t("realMedia.files")}>
                    <Input
                      type="file"
                      name="files"
                      multiple
                      required
                      accept="image/*,video/*"
                    />
                  </Field>
                  <SubmitButton>{t("realMedia.upload")}</SubmitButton>
                </form>
              ) : null}
              {view.canApprove && l.status === "sent" ? (
                <form
                  action={decideRealMediaAction}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  data-real-media-decide={l.itemId}
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="itemId" value={l.itemId} />
                  <Field label={t("realMedia.reason")}>
                    <Input name="reason" maxLength={1000} />
                  </Field>
                  <SubmitButton
                    name="decision"
                    value="approved"
                    data-real-media-approve
                  >
                    {t("realMedia.approve")}
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="rejected"
                    variant="danger"
                  >
                    {t("realMedia.reject")}
                  </SubmitButton>
                </form>
              ) : null}
            </Card>
          </div>
        );
      })}
    </>
  );
}
