import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { PASSWORD_ERRORS, PASSWORD_MIN } from "@/lib/password-rules";
import { Alert, Card } from "@/components/ui";
import { PasswordChangeForm } from "./password-change-form";

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
        </div>
      </Card>
    </div>
  );
}
