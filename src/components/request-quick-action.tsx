import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import { sendToStrategyAction } from "@/app/app/actions/purchase-demand";
import { InfoTip } from "./info-tip";
import { SubmitButton } from "./submit-button";

/*
 * Ação rápida no selo da Situação (dono, 20/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 11): na encomenda "Aguardando Wellmix"
 * que espera o "Enviar para cotação", tocar no selo abre a ação, e um toque
 * envia a encomenda inteira para a Estratégia de compra (a mesma ação do
 * "Enviar para cotação" de Encomendas, com as mesmas regras). Só para quem
 * pode enviar; para os outros, o selo fica como era.
 */
export function SituationQuickSend({
  ids,
  t,
  children,
}: {
  /** As encomendas (produtos) da linha que esperam o envio. */
  ids: readonly string[];
  t: Translate;
  /** O selo da Situação. */
  children: ReactNode;
}) {
  if (!ids.length) return <>{children}</>;
  return (
    <InfoTip
      label={t("reqQuick.send.label")}
      interactive
      className="cursor-pointer rounded-full no-underline"
      trigger={children}
      data-request-quick="send"
    >
      <div className="space-y-2" data-request-quick-panel="send">
        <p className="font-semibold text-zinc-900">
          {t("reqQuick.send.title")}
        </p>
        <p>{t("reqQuick.send.detail", { n: ids.length })}</p>
        <form action={sendToStrategyAction}>
          {ids.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <SubmitButton
            variant="primary"
            className="min-h-7 w-full justify-center px-2 py-1 text-xs"
            data-request-quick-submit="send"
          >
            {t("reqSend.button")}
          </SubmitButton>
        </form>
      </div>
    </InfoTip>
  );
}
