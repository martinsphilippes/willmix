import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { PASSWORD_ERRORS, PASSWORD_MIN } from "@/lib/password-rules";
import { Alert, Card } from "@/components/ui";
import { skipPasswordChangeAction } from "@/app/app/actions/password";
import { PasswordChangeForm } from "./password-change-form";
import { SubmitButton } from "./submit-button";

/**
 * Cartão da troca de senha, usado no primeiro acesso (no lugar da tela, pelo
 * layout) e na tela "Trocar senha" (/app/password).
 */
export function PasswordChangeCard({
  t,
  firstAccess,
}: {
  t: Translate;
  /** Senha provisória: explica por que nada mais abre antes da troca. */
  firstAccess: boolean;
}) {
  const errors = Object.fromEntries(
    [...PASSWORD_ERRORS, "failed"].map((code) => [
      code,
      t(`password.error.${code}` as DictionaryKey, { min: PASSWORD_MIN }),
    ]),
  );
  return (
    <div data-password-change={firstAccess ? "first" : "own"}>
      <Card title={t(firstAccess ? "password.first.title" : "password.title")}>
        <div className="space-y-3">
          {firstAccess ? (
            <Alert tone="warning">{t("password.first.hint")}</Alert>
          ) : (
            <p className="text-sm text-zinc-600">{t("password.hint")}</p>
          )}
          <PasswordChangeForm
            labels={{
              current: t(
                firstAccess ? "password.current.first" : "password.current",
              ),
              next: t("password.next"),
              confirm: t("password.confirm"),
              rule: t("password.rule", { min: PASSWORD_MIN }),
              submit: t("password.submit"),
              pending: t("password.pending"),
            }}
            errors={errors}
          />
          {/* Primeiro acesso: dá para seguir com a senha provisória (dono,
              14/11/2026); a troca fica para depois, em "Trocar senha". */}
          {firstAccess ? (
            <form
              action={skipPasswordChangeAction}
              className="space-y-2 border-t border-zinc-100 pt-3"
              data-password-skip
            >
              <p className="text-xs text-zinc-500">
                {t("password.first.skipHint")}
              </p>
              <SubmitButton
                variant="secondary"
                pendingText={t("password.pending")}
              >
                {t("password.first.skip")}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
