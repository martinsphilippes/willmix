import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type DivergenceLotStep } from "@/lib/db";
import {
  FINANCE_CHOICES,
  LOT_STEPS,
  SUPPLIER_CHOICES,
  lotView,
  stepReady,
  type LotStepKey,
} from "@/lib/services/divergence-lots";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  decideLotStepAction,
  submitLotStepAction,
} from "../../../../actions/divergence-lots";

/*
 * Lote com divergência (mapa E21, E24 a E27; docs/RECEIVING.md): os itens
 * com problema e os quatro passos. Quem faz envia; a Trading do pedido
 * responde (E25) ou aprova/devolve (E26, E27); o E27 aprovado fecha o lote.
 */
const TONE: Record<
  DivergenceLotStep["status"],
  "neutral" | "warning" | "success" | "danger"
> = {
  pending: "neutral",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
};

export default async function DivergenceLotPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/lots/[lotId]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id, lotId } = await params;
  const { error, submitted, decided } = await searchParams;
  const view = await lotView(user, lotId);
  if (!view || view.order.id !== id) notFound();
  const { lot, order } = view;
  const t = await getT();
  const store = getStore();
  const docIds = LOT_STEPS.flatMap((s) => lot[`${s}Step` as const].documentIds);
  const userIds = LOT_STEPS.flatMap((s) => {
    const st = lot[`${s}Step` as const];
    return [st.submittedByUserId, st.decidedByUserId].filter(
      (x): x is string => !!x,
    );
  });
  const [docs, users, supplier] = await Promise.all([
    docIds.length
      ? store.list("documents", { filter: { id: docIds } }).catch(() => [])
      : Promise.resolve([]),
    userIds.length
      ? store.list("users", { filter: { id: [...new Set(userIds)] } })
      : Promise.resolve([]),
    order.supplierId
      ? store.get("parties", order.supplierId)
      : Promise.resolve(null),
  ]);
  const who = (uid: string | null) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `lot.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;

  const stepCard = (step: LotStepKey) => {
    const s = lot[`${step}Step` as const];
    const rights = view.can[step];
    const ready = stepReady(lot, step);
    const files = docs.filter((d) => s.documentIds.includes(d.id));
    return (
      <Card
        key={step}
        title={t(`lot.step.${step}` as DictionaryKey)}
        dense
        actions={
          <Badge tone={TONE[s.status]}>
            <span data-lot-step={`${step}:${s.status}`}>
              {t(`lot.step.status.${s.status}` as DictionaryKey)}
            </span>
          </Badge>
        }
      >
        <p className="mb-2 text-sm text-zinc-600">
          {t(`lot.step.${step}.hint` as DictionaryKey)}
        </p>
        {!ready && lot.status === "open" ? (
          <p className="text-sm text-zinc-500">{t("lot.step.waiting")}</p>
        ) : null}
        {s.submittedAt ? (
          <div className="mb-2 space-y-1 text-sm">
            <p className="text-xs text-zinc-500">
              {who(s.submittedByUserId)} ·{" "}
              {t("lot.sent", { date: formatDate(s.submittedAt, t) })}
            </p>
            <p>{s.text}</p>
            {step === "finance" && s.choice ? (
              <p>
                {t(`lot.finance.${s.choice}` as DictionaryKey)}
                {s.amount ? ` · ${s.currency} ${s.amount}` : ""}
              </p>
            ) : null}
            {files.length ? (
              <ul className="list-disc pl-5">
                {files.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/files/${d.id}`} className={linkClass}>
                      {d.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {s.decidedAt ? (
          <p className="mb-2 text-sm">
            {step === "supplier" && s.choice ? (
              <strong>
                {t(`lot.reply.${s.choice}` as DictionaryKey)}
                {" · "}
              </strong>
            ) : null}
            {t("lot.decided", {
              who: who(s.decidedByUserId),
              date: formatDate(s.decidedAt, t),
              text: s.decisionText ?? "—",
            })}
          </p>
        ) : null}
        {rights.submit ? (
          <form
            action={submitLotStepAction}
            className="grid gap-3 sm:grid-cols-2"
            data-lot-submit={step}
          >
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="lotId" value={lot.id} />
            <input type="hidden" name="step" value={step} />
            <Field label={t(`lot.text.${step}` as DictionaryKey)}>
              <Input name="text" required maxLength={2000} />
            </Field>
            <Field label={t("lot.files")}>
              <Input
                type="file"
                name="files"
                multiple
                accept="image/*,video/*,application/pdf"
                required={step === "evidence" && !s.documentIds.length}
              />
            </Field>
            {step === "finance" ? (
              <>
                <Field label={t("lot.finance.choice")}>
                  <Select name="choice" required defaultValue="">
                    <option value="">—</option>
                    {FINANCE_CHOICES.map((c) => (
                      <option key={c} value={c}>
                        {t(`lot.finance.${c}` as DictionaryKey)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("lot.finance.amount")}>
                    <Input name="amount" inputMode="decimal" />
                  </Field>
                  <Field label={t("lot.finance.currency")}>
                    <Select name="currency" defaultValue="USD">
                      {["USD", "BRL", "CNY", "EUR"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            ) : null}
            <div className="flex items-end">
              <SubmitButton>{t("lot.submit")}</SubmitButton>
            </div>
          </form>
        ) : null}
        {rights.decide ? (
          <form
            action={decideLotStepAction}
            className="mt-3 grid gap-3 sm:grid-cols-2"
            data-lot-decide={step}
          >
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="lotId" value={lot.id} />
            <input type="hidden" name="step" value={step} />
            {step === "supplier" ? (
              <>
                <Field label={t("lot.reply")}>
                  <Select name="choice" required defaultValue="">
                    <option value="">—</option>
                    {SUPPLIER_CHOICES.map((c) => (
                      <option key={c} value={c}>
                        {t(`lot.reply.${c}` as DictionaryKey)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("lot.text")}>
                  <Input name="text" required maxLength={2000} />
                </Field>
                <div>
                  <SubmitButton>{t("lot.reply.submit")}</SubmitButton>
                </div>
              </>
            ) : (
              <>
                <Field label={t("lot.reject.reason")}>
                  <Input name="text" maxLength={2000} />
                </Field>
                <div className="flex items-end gap-2">
                  <SubmitButton name="decision" value="approve">
                    {t("lot.approve")}
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="reject"
                    variant="secondary"
                  >
                    {t("lot.reject")}
                  </SubmitButton>
                </div>
              </>
            )}
          </form>
        ) : null}
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        t={t}
        title={t("lot.title", { n: String(lot.number) })}
        subtitle={`${t("lot.order")} #${order.number}${supplier ? ` · ${t("lot.supplier")}: ${supplier.name}` : ""}`}
        actions={
          <span className="flex gap-3">
            <Link href={`/app/orders/${order.id}`} className={linkClass}>
              {t("lot.order")} #{order.number}
            </Link>
            <Link href="/app/lots" className={linkClass}>
              {t("lot.back")}
            </Link>
          </span>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {submitted ? (
        <Alert tone="success">{t("lot.done.submitted")}</Alert>
      ) : decided ? (
        <Alert tone="success">{t("lot.done.decided")}</Alert>
      ) : null}
      <Card
        title={t("lot.items")}
        actions={
          <Badge tone={lot.status === "closed" ? "success" : "warning"}>
            <span data-lot-status={lot.status}>
              {t(`lot.status.${lot.status}` as DictionaryKey)}
            </span>
          </Badge>
        }
      >
        <Table tools={false}>
          <thead>
            <tr>
              <Th>{t("lot.item.product")}</Th>
              <Th className="text-right">{t("lot.item.expected")}</Th>
              <Th className="text-right">{t("lot.item.received")}</Th>
              <Th className="text-right">{t("lot.item.damaged")}</Th>
              <Th>{t("lot.item.kind")}</Th>
            </tr>
          </thead>
          <tbody>
            {lot.items.map((i) => (
              <tr key={i.orderItemId}>
                <Td>{i.name}</Td>
                <Td className="text-right">{i.expected}</Td>
                <Td className="text-right">{i.received}</Td>
                <Td className="text-right">{i.damaged}</Td>
                <Td>
                  {i.kinds
                    .map((k) => t(`lot.kind.${k}` as DictionaryKey))
                    .join(", ")}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title={t("lot.step.purchasing")} dense>
        <p className="text-sm text-emerald-700" data-lot-step="purchasing:done">
          {t("lot.step.purchasing.done", {
            date: lot.purchasingNotifiedAt
              ? formatDate(lot.purchasingNotifiedAt, t)
              : "—",
            count: String(lot.purchasingUserIds.length),
          })}
        </p>
      </Card>
      {LOT_STEPS.map(stepCard)}
    </>
  );
}
