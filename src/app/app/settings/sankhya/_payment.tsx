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
import { savePaymentConditionAction } from "../../actions/sankhya-integration";
import { one } from "./_shared";

/*
 * Configurações → Condições de pagamento: a mesma tabela do Sankhya (tipos de
 * negociação, TGFTPV; CODTIPVENDA), para compra e venda. Carregada do Sankhya
 * pela aba Carga do Sankhya; aqui o admin vê, inclui e altera.
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

  return (
    <div className="grid gap-4">
      <Card title={t("paymentConditions.title")}>
        <div id="conditions" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">
          {t("paymentConditions.hint")}
        </p>
        {saved ? (
          <Alert tone="success">
            {t("paymentConditions.saved", { code: saved })}
          </Alert>
        ) : null}
        {error ? (
          <Alert tone="danger">
            {error === "duplicate_code"
              ? t("paymentConditions.duplicate", { code: one(q.detail) })
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
