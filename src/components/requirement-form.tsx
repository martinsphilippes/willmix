import type { Requirement } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  decideRequirementAction,
  submitRequirementAction,
} from "@/app/app/actions";
import { Input, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";
import { PhotoInput } from "./photo-input";
import { FileAutoInput } from "./file-auto-input";
import { MoneyInput } from "./money-input";
import { CURRENCIES } from "@/lib/currencies";
import { isMoneyRequirement, parseMoneyValue } from "@/lib/workflow/money";

/**
 * Formulário inline de um requisito, conforme o tipo. Só renderizado para quem pode preencher.
 * `action` e `defaultValue` são opcionais (usados pela "nova medição" da inspeção:
 * reenvio de um requisito já concluído com o valor atual pré-preenchido).
 */
export function RequirementForm({
  requirement,
  orderId,
  t,
  action,
  defaultValue,
  dateBounds,
}: {
  requirement: Requirement;
  orderId: string;
  t: Translate;
  action?: (form: FormData) => Promise<void>;
  defaultValue?: string | null;
  /** Data: limites vindos das outras datas do pedido (chegada ≥ embarque…). */
  dateBounds?: { min?: string; max?: string };
}) {
  if (requirement.type === "approval") {
    return (
      <form
        action={decideRequirementAction}
        className="flex flex-wrap items-center gap-1.5"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="requirementId" value={requirement.id} />
        <Input
          name="note"
          placeholder={t("common.note")}
          className="max-w-xs sm:w-48"
        />
        <SubmitButton name="decision" value="approve" variant="primary">
          {t("common.approve")}
        </SubmitButton>
        <SubmitButton name="decision" value="reject" variant="danger">
          {t("common.reject")}
        </SubmitButton>
      </form>
    );
  }

  // Foto e arquivo enviam sozinhos ao escolher (cancelar a escolha não trava nada).
  // A foto usa a mesma lógica da foto do produto: câmera ou galeria, reduzida no
  // aparelho e, se ainda for grande, sobe direto ao armazenamento. Requisito de
  // arquivo (arte, documentos) aceita as duas coisas: foto ou arquivo (PDF, AI…).
  if (requirement.type === "photo" || requirement.type === "file") {
    const target = (
      <>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="requirementId" value={requirement.id} />
      </>
    );
    // Requisito de arquivo: os dois botões ocupam a largura no celular.
    const wide = requirement.type === "file" ? "w-full sm:w-auto" : undefined;
    const photo = (
      <form
        action={action ?? submitRequirementAction}
        className={`flex flex-wrap items-center gap-1.5 ${wide ?? ""}`}
      >
        {target}
        <PhotoInput
          name="file"
          multiple={false}
          capture={false}
          // Documento ou arte fotografados precisam continuar legíveis.
          maxDimension={requirement.type === "file" ? 2400 : 1600}
          quality={requirement.type === "file" ? 0.88 : 0.82}
          autoSubmit
          compact
          direct
          label={t("requirement.photo.add")}
          pendingLabel={t("requirement.sending")}
          uploadingLabel={t("photo.uploading")}
          failedLabel={t("photo.failed")}
          className={wide}
        />
      </form>
    );
    if (requirement.type === "photo") return photo;
    return (
      <div
        className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-start sm:justify-end"
        data-requirement-upload=""
      >
        {photo}
        <form
          action={action ?? submitRequirementAction}
          className={`flex flex-wrap items-center gap-1.5 ${wide}`}
        >
          {target}
          <FileAutoInput
            name="file"
            label={t("requirement.file.add")}
            pendingLabel={t("requirement.sending")}
            uploadingLabel={t("requirement.file.uploading")}
            tooBigLabel={t("requirement.file.tooBig")}
            serverOnlyLabel={t("requirement.file.serverOnly")}
            failedLabel={t("requirement.file.failed")}
            className={wide}
          />
        </form>
      </div>
    );
  }

  return (
    <form
      action={action ?? submitRequirementAction}
      className="flex flex-wrap items-center gap-1.5"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="requirementId" value={requirement.id} />
      {isMoneyRequirement(requirement) ? (
        <MoneyInput
          locale={t.intl}
          name="amount"
          currencyName="currency"
          required
          labels={Object.fromEntries([
            ["currency", t("common.currency")],
            ...CURRENCIES.map((c) => [
              c,
              t(`currency.name.${c}` as DictionaryKey),
            ]),
          ])}
          defaultCurrency={parseMoneyValue(defaultValue)?.currency ?? "BRL"}
          defaultAmount={parseMoneyValue(defaultValue)?.amount ?? null}
        />
      ) : requirement.type === "number" ? (
        <Input
          name="value"
          type="number"
          step="any"
          required
          defaultValue={defaultValue ?? undefined}
          className="max-w-32 sm:w-32"
        />
      ) : null}
      {requirement.type === "date" ? (
        <Input
          name="value"
          type="date"
          required
          min={dateBounds?.min}
          max={dateBounds?.max}
          defaultValue={defaultValue ?? undefined}
          className="max-w-40 sm:w-40"
        />
      ) : null}
      {requirement.type === "text" ? (
        <Textarea
          name="value"
          required
          defaultValue={defaultValue ?? undefined}
          className="min-h-8! max-w-md sm:w-64"
          rows={1}
        />
      ) : null}
      {requirement.type === "confirm" ? (
        <input type="hidden" name="value" value="confirmed" />
      ) : null}
      <SubmitButton pendingText="...">
        {requirement.type === "confirm"
          ? t("common.confirm")
          : t("common.send")}
      </SubmitButton>
    </form>
  );
}
