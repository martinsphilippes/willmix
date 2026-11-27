import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import { Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * "Necessita amostragem" da consulta (dono, 27/11/2026): só a Wellmix marca;
 * o padrão é desmarcado. Marcada, o fornecedor vê e envia a amostra; sem a
 * marca, a amostragem não aparece para ele e nada espera a amostra. Quem não
 * pode mudar vê só a situação.
 */
export function SamplingNeedForm({
  need,
  canChange,
  action,
  fields,
  t,
}: {
  need: boolean;
  canChange: boolean;
  action: (form: FormData) => Promise<void>;
  /** Campos escondidos da ação (id da solicitação ou da cotação, volta). */
  fields: ReactNode;
  t: Translate;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px]"
      data-sampling-need={need ? "yes" : "no"}
    >
      <span className="inline-flex items-center gap-2 font-medium text-zinc-800">
        <span
          aria-hidden
          className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[11px] leading-none ${
            need
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-zinc-400 bg-white"
          }`}
        >
          {need ? "✓" : ""}
        </span>
        {t("inquiries.samplingNeed.label")}
        <Badge tone={need ? "info" : "neutral"}>
          {t(need ? "common.yes" : "common.no")}
        </Badge>
      </span>
      {canChange ? (
        <form action={action} className="inline-flex">
          {fields}
          <input type="hidden" name="need" value={need ? "no" : "yes"} />
          <SubmitButton
            variant="secondary"
            className="px-2.5 py-1 text-xs"
            data-sampling-need-toggle={need ? "no" : "yes"}
          >
            {t(
              need
                ? "inquiries.samplingNeed.unmark"
                : "inquiries.samplingNeed.mark",
            )}
          </SubmitButton>
        </form>
      ) : null}
      <span className="basis-full text-[11px] text-zinc-500">
        {t(
          need
            ? "inquiries.samplingNeed.hintOn"
            : "inquiries.samplingNeed.hintOff",
        )}
      </span>
    </div>
  );
}
