import type { Translate } from "@/i18n";
import type { RequestNcm, SuggestionView } from "@/lib/services/request-ncm";
import type { NcmRates } from "@/lib/services/fiscal";
import { formatNcm } from "@/lib/fiscal";
import { SubmitButton } from "@/components/submit-button";
import {
  confirmRequestNcmAction,
  suggestRequestNcmAction,
} from "@/app/app/actions/fiscal";
import { Alert, Badge, Card, Input } from "@/components/ui";

/*
 * Classificação fiscal da solicitação (só Wellmix): NCM do cadastro ou
 * confirmado, com II/IPI da tabela; sem NCM, as sugestões (IA e palavras-chave)
 * para confirmar com um clique, ou digitar outro.
 */

const pct = (n: number | null, intl: string) =>
  n === null ? "—" : `${n.toLocaleString(intl, { maximumFractionDigits: 2 })}%`;

function RatesLine({ t, rates }: { t: Translate; rates: NcmRates | null }) {
  if (!rates)
    return (
      <span className="text-xs text-amber-700">{t("ncm.notInTable")}</span>
    );
  return (
    <span className="text-xs text-zinc-600">
      {t("ncm.rates", {
        ii: pct(rates.ii, t.intl),
        ipi: rates.ipiNt ? t("ncm.nt") : pct(rates.ipi, t.intl),
      })}
    </span>
  );
}

export function RequestNcmCard({
  t,
  requestId,
  ncm,
  suggestions,
  suggestionsPending,
  hasTable,
  editable,
  notice,
  aiNotice,
}: {
  t: Translate;
  requestId: string;
  ncm: RequestNcm;
  suggestions: SuggestionView[];
  /** Sugestão automática em andamento (ainda não gravou). */
  suggestionsPending: boolean;
  hasTable: boolean;
  /** Ainda dá para mudar (antes do pedido). */
  editable: boolean;
  notice: string | null;
  aiNotice: string | null;
}) {
  const confirmForm = (
    <form
      action={confirmRequestNcmAction}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="source" value="manual" />
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-medium text-zinc-700">
          {t("ncm.manual")}
        </span>
        <Input
          name="ncm"
          required
          inputMode="numeric"
          placeholder={t("ph.ncm")}
          pattern="[0-9. -]{8,14}"
          className="max-w-48"
        />
      </label>
      <SubmitButton variant="secondary">{t("ncm.confirm")}</SubmitButton>
    </form>
  );

  return (
    <Card title={t("ncm.title")}>
      <div id="ncm" className="space-y-2.5">
        <p className="text-xs leading-relaxed text-zinc-500">{t("ncm.hint")}</p>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {aiNotice ? <Alert tone="warning">{aiNotice}</Alert> : null}
        {!hasTable ? <Alert tone="warning">{t("ncm.noTable")}</Alert> : null}

        {ncm.ncm ? (
          <div className="rounded-xl border border-zinc-200 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-semibold text-zinc-900">
                {formatNcm(ncm.ncm)}
              </span>
              <Badge tone={ncm.status === "confirmed" ? "success" : "info"}>
                {t(`ncm.status.${ncm.status}`)}
              </Badge>
              {ncm.source && ncm.status === "confirmed" ? (
                <span className="text-xs text-zinc-500">
                  {t(`ncm.source.${ncm.source}`)}
                </span>
              ) : null}
            </div>
            {ncm.rates?.description ? (
              <p className="mt-1 text-sm text-zinc-700">
                {ncm.rates.description}
              </p>
            ) : null}
            <div className="mt-1">
              <RatesLine t={t} rates={ncm.rates} />
            </div>
            {editable ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-brand-700">
                  {t("ncm.change")}
                </summary>
                <div className="mt-2">{confirmForm}</div>
              </details>
            ) : null}
          </div>
        ) : (
          <>
            <Alert tone="warning">{t("ncm.pending")}</Alert>
            <p className="text-sm font-medium text-zinc-900">
              {t("ncm.suggestions")}
            </p>
            {suggestions.length ? (
              <ul className="space-y-1.5">
                {suggestions.map((s) => (
                  <li
                    key={s.ncm}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-zinc-900">
                          {formatNcm(s.ncm)}
                        </span>
                        <Badge tone={s.source === "ai" ? "brand" : "neutral"}>
                          {t(`ncm.suggestion.${s.source}`)}
                        </Badge>
                        <RatesLine t={t} rates={s.rates} />
                      </div>
                      {s.rates?.description || s.description ? (
                        <p className="mt-0.5 text-sm text-zinc-700">
                          {s.rates?.description ?? s.description}
                        </p>
                      ) : null}
                      {s.reason ? (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {s.reason}
                        </p>
                      ) : null}
                    </div>
                    {editable && (s.rates || !hasTable) ? (
                      <form action={confirmRequestNcmAction}>
                        <input
                          type="hidden"
                          name="requestId"
                          value={requestId}
                        />
                        <input type="hidden" name="ncm" value={s.ncm} />
                        <input type="hidden" name="source" value={s.source} />
                        <SubmitButton>{t("ncm.confirm")}</SubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                {suggestionsPending
                  ? t("ncm.suggesting")
                  : t("ncm.noSuggestions")}
              </p>
            )}
            {editable ? (
              /* "Sugerir" e "Outro NCM" na mesma linha quando cabem. */
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <form action={suggestRequestNcmAction}>
                  <input type="hidden" name="requestId" value={requestId} />
                  <SubmitButton variant="secondary">
                    {t("ncm.suggest")}
                  </SubmitButton>
                </form>
                {confirmForm}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
