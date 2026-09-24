import type { Requirement } from "@/lib/db";
import type { Translate } from "@/i18n";
import {
  decideRequirementAction,
  submitRequirementAction,
} from "@/app/app/actions";
import { Input, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

/** Formulário inline de um requisito, conforme o tipo. Só renderizado para quem pode preencher. */
export function RequirementForm({
  requirement,
  orderId,
  t,
}: {
  requirement: Requirement;
  orderId: string;
  t: Translate;
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

  return (
    <form
      action={submitRequirementAction}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="requirementId" value={requirement.id} />
      {requirement.type === "file" || requirement.type === "photo" ? (
        <Input
          name="file"
          type="file"
          required
          accept={requirement.type === "photo" ? "image/*" : undefined}
          className="max-w-xs sm:w-72"
        />
      ) : null}
      {requirement.type === "number" ? (
        <Input
          name="value"
          type="number"
          step="any"
          required
          className="max-w-40 sm:w-40"
        />
      ) : null}
      {requirement.type === "date" ? (
        <Input name="value" type="date" required className="max-w-48 sm:w-48" />
      ) : null}
      {requirement.type === "text" ? (
        <Textarea
          name="value"
          required
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
