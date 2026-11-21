import type { Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getStore } from "@/lib/db";
import {
  savePaymentConditionAction,
  savePaymentConditionRuleAction,
  syncPaymentConditionsAction,
} from "../../actions/sankhya-integration";
import { PAYMENT_CONDITION_VIEW } from "@/lib/payment-condition-view";
import {
  scheduleSummary,
  type ConditionBase,
} from "@/lib/payment-condition-schedule";
import { one } from "./_shared";

/*
 * Configurações → Condições de pagamento: a mesma tabela do Sankhya (tipos de
 * negociação, TGFTPV; CODTIPVENDA), para compra e venda. Desde 21/11/2026 a
 * lista é a VW_AD_TIPONEGOCIACAO_WELL: "Sincronizar com o Sankhya" troca a
 * tabela pela view. Cada condição vence por tempo (dias da nota) ou por
 * evento do pedido; as parcelas saem da descrição ou da regra do admin.
 */

type Params = Record<string, string | string[] | undefined>;

export async function PaymentConditionsTab({
  t,
  q,
}: {
  t: Translate;
  q: Params;
}) {
  const conditions = (await getStore().list("payment_conditions")).sort(
    (a, b) => a.code - b.code,
  );
  const filter = one(q.q).trim().toLowerCase();
  const shown = filter
    ? conditions.filter(
        (c) =>
          String(c.code).includes(filter) ||
          c.name.toLowerCase().includes(filter),
      )
    : conditions;
  const saved = one(q.saved);
  const error = one(q.error);
  const synced = one(q.synced).split(".").map(Number);
  const missing = one(q.missing);
  const labels: Record<ConditionBase, string> = {
    invoice: t("paymentConditions.base.invoice"),
    order: t("paymentConditions.base.order"),
    shipment: t("paymentConditions.base.shipment"),
    cargo_presence: t("paymentConditions.base.cargo_presence"),
    delivery: t("paymentConditions.base.delivery"),
  };
  const review = conditions.filter((c) => c.scheduleProblem || !c.scheduleKind);

  return (
    <div className="grid gap-4">
      <Card title={t("paymentConditions.title")}>
        <div id="conditions" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">
          {t("paymentConditions.hint")}
        </p>
        <form
          action={syncPaymentConditionsAction}
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
        >
          <p className="flex-1 text-sm text-zinc-700">
            {t("paymentConditions.sync.hint", { view: PAYMENT_CONDITION_VIEW })}
          </p>
          <SubmitButton pendingText="…">
            {t("paymentConditions.sync.button")}
          </SubmitButton>
        </form>
        {synced.length === 5 && synced.every(Number.isFinite) ? (
          <Alert tone="success">
            {t("paymentConditions.sync.done", {
              created: synced[0],
              updated: synced[1],
              removed: synced[2],
              unlinked: synced[3],
              review: synced[4],
            })}
          </Alert>
        ) : null}
        {missing ? (
          <Alert tone="warning">
            {t("paymentConditions.sync.missing", { columns: missing })}
          </Alert>
        ) : null}
        {review.length ? (
          <Alert tone="warning">
            {t("paymentConditions.review", { count: review.length })}
          </Alert>
        ) : null}
        {saved ? (
          <Alert tone="success">
            {t("paymentConditions.saved", { code: saved })}
          </Alert>
        ) : null}
        {error ? (
          <Alert tone="danger">
            {error === "duplicate_code"
              ? t("paymentConditions.duplicate", { code: one(q.detail) })
              : error === "view_failed" ||
                  error === "view_empty" ||
                  error === "not_found"
                ? t(`paymentConditions.error.${error}`, {
                    view: PAYMENT_CONDITION_VIEW,
                  })
                : t("sankhyaInt.error.invalid_input", {
                    detail: one(q.detail) || "—",
                  })}
          </Alert>
        ) : null}

        <form
          action={savePaymentConditionAction}
          className="mb-4 grid gap-2 rounded-lg border border-zinc-200 p-3 md:grid-cols-[8rem_1fr_8rem_1fr_auto] md:items-end"
        >
          <Field label={t("paymentConditions.code")}>
            <Input name="code" inputMode="numeric" required />
          </Field>
          <Field label={t("paymentConditions.name")}>
            <Input name="name" required maxLength={160} />
          </Field>
          <Field label={t("paymentConditions.active")}>
            <Select name="active" defaultValue="1">
              <option value="1">{t("sankhyaInt.yes")}</option>
              <option value="0">{t("sankhyaInt.no")}</option>
            </Select>
          </Field>
          <Field label={t("paymentConditions.notes")}>
            <Input name="notes" maxLength={2000} />
          </Field>
          <SubmitButton pendingText="…">
            {t("paymentConditions.add")}
          </SubmitButton>
        </form>

        <form
          method="get"
          action="/app/settings/sankhya"
          className="mb-3 flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="tab" value="payment" />
          <Field label={t("paymentConditions.search")}>
            <Input name="q" defaultValue={one(q.q)} />
          </Field>
          <SubmitButton variant="secondary" pendingText="…">
            {t("paymentConditions.search")}
          </SubmitButton>
        </form>

        {shown.length ? (
          <Table className="max-h-[40rem] overflow-y-auto">
            <thead>
              <tr>
                <Th>{t("paymentConditions.code")}</Th>
                <Th>{t("paymentConditions.name")}</Th>
                <Th>{t("paymentConditions.active")}</Th>
                <Th>{t("paymentConditions.kind")}</Th>
                <Th>{t("paymentConditions.installments")}</Th>
                <Th>{t("paymentConditions.notes")}</Th>
                <Th>{t("paymentConditions.source")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const formId = `pc-${c.id}`;
                return (
                  <tr key={c.id}>
                    <Td>
                      <form id={formId} action={savePaymentConditionAction}>
                        <input type="hidden" name="id" value={c.id} />
                      </form>
                      <Input
                        form={formId}
                        name="code"
                        inputMode="numeric"
                        defaultValue={String(c.code)}
                        className="w-24 font-mono text-xs"
                        dense
                      />
                    </Td>
                    <Td>
                      <Input
                        form={formId}
                        name="name"
                        defaultValue={c.name}
                        maxLength={160}
                        dense
                      />
                    </Td>
                    <Td>
                      <Select
                        form={formId}
                        name="active"
                        defaultValue={c.active ? "1" : "0"}
                        dense
                      >
                        <option value="1">{t("sankhyaInt.yes")}</option>
                        <option value="0">{t("sankhyaInt.no")}</option>
                      </Select>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      <Badge
                        tone={
                          c.scheduleProblem || !c.scheduleKind
                            ? "warning"
                            : c.scheduleKind === "event"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {c.scheduleProblem || !c.scheduleKind
                          ? t("paymentConditions.kind.review")
                          : t(`paymentConditions.kind.${c.scheduleKind}`)}
                      </Badge>
                    </Td>
                    <Td className="min-w-64 text-xs">
                      <p className="mb-1 text-zinc-700">
                        {scheduleSummary(
                          {
                            kind: c.scheduleKind ?? null,
                            installments: c.installments ?? [],
                          },
                          labels,
                          t("paymentConditions.days"),
                        )}
                      </p>
                      {c.scheduleProblem === "percent_sum" ? (
                        <p className="mb-1 text-amber-700">
                          {t("paymentConditions.problem.percent_sum")}
                        </p>
                      ) : null}
                      <form
                        action={savePaymentConditionRuleAction}
                        className="flex gap-1"
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <Input
                          name="rule"
                          defaultValue={c.scheduleRule ?? ""}
                          placeholder={t("paymentConditions.rule.placeholder")}
                          aria-label={t("paymentConditions.rule")}
                          maxLength={500}
                          dense
                        />
                        <SubmitButton variant="secondary" pendingText="…">
                          {t("paymentConditions.rule.save")}
                        </SubmitButton>
                      </form>
                    </Td>
                    <Td>
                      <Input
                        form={formId}
                        name="notes"
                        defaultValue={c.notes ?? ""}
                        maxLength={2000}
                        dense
                      />
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      <Badge tone={c.source === "sankhya" ? "info" : "neutral"}>
                        {c.source === "sankhya"
                          ? "Sankhya"
                          : t("paymentConditions.portal")}
                      </Badge>
                    </Td>
                    <Td>
                      <SubmitButton
                        form={formId}
                        variant="secondary"
                        pendingText="…"
                      >
                        {t("paymentConditions.save")}
                      </SubmitButton>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-500">
            {t("paymentConditions.empty")}
          </p>
        )}
      </Card>
    </div>
  );
}
