import type { Translate } from "@/i18n";
import type { Settings } from "@/lib/settings";
import type { FiscalStatus } from "@/lib/services/fiscal";
import { SubmitButton } from "@/components/submit-button";
import {
  uploadFiscalTableAction,
  syncFiscalNowAction,
} from "@/app/app/actions/fiscal";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  Select,
  formatDate,
} from "@/components/ui";

/*
 * Tributos da importação em Configurações: alíquotas (dentro do formulário
 * geral) e a tabela fiscal TEC/TIPI (cartão próprio, com upload e o robô).
 */

/** Seguro, PIS, COFINS, ICMS e links oficiais: campos do formulário geral. */
export function TaxRateFields({ t, s }: { t: Translate; s: Settings }) {
  return (
    <>
      <h3 className="border-t border-zinc-100 pt-4 text-sm font-semibold text-zinc-900">
        {t("fiscal.settings.title")}
      </h3>
      <p className="text-xs leading-relaxed text-zinc-500">
        {t("fiscal.settings.hint")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("fiscal.settings.pis")}
          hint={t("fiscal.settings.pisHint")}
        >
          <Input
            name="pisImportPercent"
            type="number"
            step="any"
            min="0"
            max="99.99"
            required
            defaultValue={s.pisImportPercent}
          />
        </Field>
        <Field label={t("fiscal.settings.cofins")}>
          <Input
            name="cofinsImportPercent"
            type="number"
            step="any"
            min="0"
            max="99.99"
            required
            defaultValue={s.cofinsImportPercent}
          />
        </Field>
        <Field
          label={t("fiscal.settings.icms")}
          hint={t("fiscal.settings.icmsHint")}
        >
          <Input
            name="icmsPercent"
            type="number"
            step="any"
            min="0"
            max="99.99"
            defaultValue={s.icmsPercent ?? ""}
          />
        </Field>
        <Field label={t("fiscal.settings.insurance")}>
          <Input
            name="insurancePercent"
            type="number"
            step="any"
            min="0"
            max="99.99"
            required
            defaultValue={s.insurancePercent}
          />
        </Field>
        <Field label={t("fiscal.table.tecUrl")}>
          <Input
            name="fiscalTecUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={s.fiscalTecUrl}
          />
        </Field>
        <Field label={t("fiscal.table.tipiUrl")}>
          <Input
            name="fiscalTipiUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={s.fiscalTipiUrl}
          />
        </Field>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        {t("fiscal.table.urlHint")}
      </p>
    </>
  );
}

/** Situação da TEC e da TIPI, upload da planilha oficial e "atualizar agora". */
export function FiscalTableCard({
  t,
  status,
  notice,
}: {
  t: Translate;
  status: FiscalStatus;
  notice: string | null;
}) {
  const part = (key: "tec" | "tipi") => {
    const p = status[key];
    return (
      <li className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900">
          {t(`fiscal.table.${key}`)}
        </span>
        {p ? (
          <span className="text-xs text-zinc-600">
            {t("fiscal.table.loaded", {
              count: p.count.toLocaleString("pt-BR"),
              date: formatDate(p.updatedAt),
              source: t(`fiscal.table.source.${p.source}`),
            })}
          </span>
        ) : (
          <Badge tone="danger">{t("fiscal.table.missing")}</Badge>
        )}
      </li>
    );
  };
  return (
    <Card title={t("fiscal.table.title")} className="mt-6 max-w-2xl">
      <div id="fiscal" className="space-y-3">
        <p className="text-xs leading-relaxed text-zinc-500">
          {t("fiscal.table.hint")}
        </p>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <ul className="space-y-2 rounded-xl border border-zinc-200 p-3">
          {part("tec")}
          {part("tipi")}
        </ul>
        {status.unreadable ? (
          <Alert tone="danger">{t("fiscal.table.unreadable")}</Alert>
        ) : null}
        {status.stale ? (
          <Alert tone="warning">{t("fiscal.table.stale")}</Alert>
        ) : null}
        {status.lastError ? (
          <Alert tone="danger">
            {t("fiscal.table.lastError", { reason: status.lastError })}
          </Alert>
        ) : null}
        <form
          action={uploadFiscalTableAction}
          className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
        >
          <Field label={t("fiscal.table.kind")}>
            <Select name="kind" defaultValue="tec">
              <option value="tec">{t("fiscal.table.tec")}</option>
              <option value="tipi">{t("fiscal.table.tipi")}</option>
            </Select>
          </Field>
          <Field label={t("fiscal.table.file")}>
            <Input
              name="file"
              type="file"
              required
              accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            />
          </Field>
          <SubmitButton>{t("fiscal.table.upload")}</SubmitButton>
        </form>
        {status.tecUrl || status.tipiUrl ? (
          <form action={syncFiscalNowAction}>
            <SubmitButton variant="secondary">
              {t("fiscal.table.syncNow")}
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
