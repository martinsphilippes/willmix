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
}: {
  requirement: Requirement;
  orderId: string;
  t: Translate;
  action?: (form: FormData) => Promise<void>;
  defaultValue?: string | null;
}) {
  if (requirement.type === "approval") {
    return (
      <form
        action={decideRequirementAction}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="requirementId" value={requirement.id} />
        <Input
          name="note"
          placeholder={t("common.note")}
          className="max-w-xs sm:w-56"
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

  // Foto e arquivo enviam sozinhos ao escolher (cancelar a escolha não trava nada);
  // a foto é reduzida no aparelho antes de subir.
  if (requirement.type === "photo" || requirement.type === "file") {
    return (
      <form
        action={action ?? submitRequirementAction}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="requirementId" value={requirement.id} />
        {requirement.type === "photo" ? (
          <PhotoInput
            name="file"
            multiple={false}
            capture={false}
            maxDimension={1600}
            autoSubmit
            compact
            label={t("requirement.photo.add")}
            pendingLabel={t("requirement.sending")}
          />
        ) : (
          <FileAutoInput
            name="file"
            label={t("requirement.file.add")}
            pendingLabel={t("requirement.sending")}
            uploadingLabel={t("requirement.file.uploading")}
            tooBigLabel={t("requirement.file.tooBig")}
            serverOnlyLabel={t("requirement.file.serverOnly")}
            failedLabel={t("requirement.file.failed")}
          />
        )}
      </form>
    );
  }

  return (
    <form
      action={action ?? submitRequirementAction}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="requirementId" value={requirement.id} />
      {isMoneyRequirement(requirement) ? (
        <MoneyInput
          required
          currencyLabels={
            Object.fromEntries(
              CURRENCIES.map((c) => [
                c,
                t(`currency.name.${c}` as DictionaryKey),
              ]),
            ) as Record<(typeof CURRENCIES)[number], string>
          }
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
          className="max-w-40 sm:w-40"
        />
      ) : null}
      {requirement.type === "date" ? (
        <Input
          name="value"
          type="date"
          required
          defaultValue={defaultValue ?? undefined}
          className="max-w-48 sm:w-48"
        />
      ) : null}
      {requirement.type === "text" ? (
        <Textarea
          name="value"
          required
          defaultValue={defaultValue ?? undefined}
          className="min-h-10! max-w-md sm:w-72"
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
