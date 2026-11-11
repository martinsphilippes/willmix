"use client";

import { useActionState, useEffect } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import {
  changePasswordAction,
  type PasswordFormState,
} from "@/app/app/actions/password";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password-rules";

/**
 * Formulário de troca de senha: senha atual, nova e confirmação. O motivo da
 * recusa volta sem recarregar a tela (o que foi digitado continua).
 */
export function PasswordChangeForm({
  labels,
  errors,
}: {
  labels: {
    current: string;
    next: string;
    confirm: string;
    rule: string;
    submit: string;
    pending: string;
  };
  /** Texto de cada motivo de recusa (chave = código). */
  errors: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(
    changePasswordAction,
    { error: null },
  );
  // Página nova de verdade: o layout relê o login, já sem a senha provisória.
  useEffect(() => {
    // Recarga inteira de propósito: a navegação do Next manteria o layout
    // já montado, com o aviso de primeiro acesso.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (state.done) window.location.assign("/app/password?saved=1");
  }, [state.done]);
  return (
    <form action={action} className="max-w-sm space-y-3" data-password-form>
      {state.error ? (
        <div data-password-error={state.error}>
          <Alert tone="danger">{errors[state.error] ?? errors.failed}</Alert>
        </div>
      ) : null}
      <Field label={labels.current}>
        <Input
          type="password"
          name="current"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </Field>
      <Field label={labels.next}>
        <Input
          type="password"
          name="next"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
      </Field>
      <Field label={labels.confirm}>
        <Input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
      </Field>
      <p className="text-xs text-zinc-500">{labels.rule}</p>
      <Button type="submit" disabled={pending || !!state.done}>
        {pending ? labels.pending : labels.submit}
      </Button>
    </form>
  );
}
