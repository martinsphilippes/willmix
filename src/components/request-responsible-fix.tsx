"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRequestCustomerLoginAction,
  type CustomerLoginFixState,
} from "@/app/app/actions/request-fix";
import { SubmitButton } from "./submit-button";
import { Button, Field, Input, cx } from "./ui";

/*
 * Resolver pelo balão "Quem pode agir" (dono, 20/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 10): o cliente sem nenhum login que
 * confirme a venda ganha o acesso ali mesmo. O administrador confere o
 * login, o nome e a senha provisória sugeridos e toca em "Criar login do
 * cliente"; a resposta mostra o login e a senha para passar ao cliente (ele
 * troca a senha no 1º acesso). A tela só é relida quando ele pede, para a
 * senha não sumir antes de ser copiada.
 */

export interface CustomerLoginFixTexts {
  title: string;
  login: string;
  loginHint: string;
  name: string;
  password: string;
  passwordHint: string;
  submit: string;
  working: string;
  done: string;
  portal: string;
  loginLabel: string;
  passwordLabel: string;
  copy: string;
  copied: string;
  copyFailed: string;
  changeHint: string;
  reassigned: string;
  refresh: string;
}

const INITIAL: CustomerLoginFixState = {
  ok: false,
  error: null,
  message: null,
  login: null,
  password: null,
  reassigned: 0,
  values: null,
};

export function CustomerLoginFix({
  requestId,
  login,
  name,
  password,
  minPassword,
  texts,
  bare = false,
}: {
  requestId: string;
  login: string;
  name: string;
  password: string;
  minPassword: number;
  texts: CustomerLoginFixTexts;
  /** Sozinho no balão (Pendências): sem a linha que o separa do aviso. */
  bare?: boolean;
}) {
  const [state, action] = useActionState(
    createRequestCustomerLoginAction,
    INITIAL,
  );
  const router = useRouter();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  if (state.ok && state.login && state.password) {
    const created = { login: state.login, password: state.password };
    return (
      <div
        className="space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-950"
        role="status"
        data-request-fix-done=""
      >
        <p className="font-semibold">{texts.done}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
          <dt className="text-emerald-800">{texts.loginLabel}</dt>
          <dd className="break-all font-mono" data-request-fix-login-created="">
            {state.login}
          </dd>
          <dt className="text-emerald-800">{texts.passwordLabel}</dt>
          <dd className="break-all font-mono" data-request-fix-password="">
            {state.password}
          </dd>
        </dl>
        <p className="text-emerald-800">{texts.changeHint}</p>
        {state.reassigned ? (
          <p className="text-emerald-800">{texts.reassigned}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            type="button"
            variant="secondary"
            className="min-h-7 px-2 py-0.5 text-xs"
            onClick={async () => {
              const text = [
                `${texts.portal}: ${window.location.origin}/login`,
                `${texts.loginLabel}: ${created.login}`,
                `${texts.passwordLabel}: ${created.password}`,
              ].join("\n");
              try {
                await navigator.clipboard.writeText(text);
                setCopy("copied");
                setTimeout(() => setCopy("idle"), 2500);
              } catch {
                // Sem a API de cópia: o login e a senha estão à vista.
                setCopy("failed");
              }
            }}
            data-request-fix-copy=""
          >
            {copy === "copied" ? `${texts.copied} ✓` : texts.copy}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-7 px-2 py-0.5 text-xs"
            onClick={() => router.refresh()}
            data-request-fix-refresh=""
          >
            {texts.refresh}
          </Button>
        </div>
        {copy === "failed" ? (
          <p className="text-amber-800">{texts.copyFailed}</p>
        ) : null}
      </div>
    );
  }

  // No erro, o que foi digitado continua nos campos (o React limpa o
  // formulário depois da ação e volta ao valor padrão).
  const values = state.values ?? { login, name, password };
  return (
    <form
      action={action}
      className={cx("space-y-2", !bare && "border-t border-zinc-200 pt-2")}
      data-request-fix="customer_login"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <p className="font-semibold text-zinc-900">{texts.title}</p>
      <Field label={texts.login} hint={texts.loginHint}>
        <Input
          name="login"
          defaultValue={values.login}
          required
          minLength={3}
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-request-fix-login=""
        />
      </Field>
      <Field label={texts.name}>
        <Input
          name="name"
          defaultValue={values.name}
          required
          minLength={2}
          maxLength={120}
          autoComplete="off"
          data-request-fix-name=""
        />
      </Field>
      <Field label={texts.password} hint={texts.passwordHint}>
        <Input
          name="password"
          type="text"
          defaultValue={values.password}
          required
          minLength={minPassword}
          maxLength={128}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-request-fix-password-input=""
        />
      </Field>
      {state.message ? (
        <p className="text-red-700" role="alert" data-request-fix-error="">
          {state.message}
        </p>
      ) : null}
      <SubmitButton
        variant="primary"
        className="min-h-7 w-full justify-center px-2 py-1 text-xs"
        pendingText={texts.working}
        data-request-fix-submit=""
      >
        {texts.submit}
      </SubmitButton>
    </form>
  );
}
