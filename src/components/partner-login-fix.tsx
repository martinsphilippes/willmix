"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createPartnerLoginAction,
  suggestPartnerLoginAction,
  type PartnerLoginState,
  type PartnerLoginSuggestionState,
} from "@/app/app/actions/partner-login";
import { SubmitButton } from "./submit-button";
import { Button, Field, Input, Select } from "./ui";

/*
 * Gerar o login do parceiro ali mesmo (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Login do parceiro na Estratégia"): no "Sem login
 * ativo" da lista de parceiros da Estratégia de compra, o administrador toca
 * em "Gerar o login aqui", confere o login, o nome, a senha provisória e o
 * idioma sugeridos e cria. A resposta mostra o login e a senha para passar
 * ao parceiro (ele troca no 1º acesso), e a tela confere o parceiro de novo:
 * ele vira Apto, sem sair da tela nem perder as escolhas.
 */

export interface PartnerLoginFixTexts {
  open: string;
  loading: string;
  title: string;
  login: string;
  loginHint: string;
  name: string;
  password: string;
  passwordHint: string;
  locale: string;
  localeNames: Record<string, string>;
  submit: string;
  working: string;
  cancel: string;
  done: string;
  changeHint: string;
  portal: string;
  loginLabel: string;
  passwordLabel: string;
  copy: string;
  copied: string;
  copyFailed: string;
}

const INITIAL: PartnerLoginState = {
  ok: false,
  error: null,
  message: null,
  login: null,
  password: null,
  values: null,
};

export function PartnerLoginFix({
  partyId,
  partyName,
  minPassword,
  texts,
  onOpen,
  onCreated,
}: {
  partyId: string;
  partyName: string;
  minPassword: number;
  texts: PartnerLoginFixTexts;
  /** Abriu o formulário (a tela o mantém aberto mesmo depois de Apto). */
  onOpen?: () => void;
  /** Login criado: a tela confere o parceiro de novo. */
  onCreated?: () => void;
}) {
  const [suggestion, setSuggestion] =
    useState<PartnerLoginSuggestionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [closed, setClosed] = useState(false);
  const [state, action] = useActionState(createPartnerLoginAction, INITIAL);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const notified = useRef(false);

  useEffect(() => {
    if (!state.ok || notified.current) return;
    notified.current = true;
    onCreated?.();
  }, [state.ok, onCreated]);

  if (state.ok && state.login && state.password) {
    const created = { login: state.login, password: state.password };
    return (
      <div
        className="mt-1.5 space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-950"
        role="status"
        data-partner-login-done={partyId}
      >
        <p className="font-semibold">{texts.done}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
          <dt className="text-emerald-800">{texts.loginLabel}</dt>
          <dd className="break-all font-mono" data-partner-login-created="">
            {created.login}
          </dd>
          <dt className="text-emerald-800">{texts.passwordLabel}</dt>
          <dd className="break-all font-mono" data-partner-login-password="">
            {created.password}
          </dd>
        </dl>
        <p className="text-emerald-800">{texts.changeHint}</p>
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
          data-partner-login-copy=""
        >
          {copy === "copied" ? `${texts.copied} ✓` : texts.copy}
        </Button>
        {copy === "failed" ? (
          <p className="text-amber-800">{texts.copyFailed}</p>
        ) : null}
      </div>
    );
  }

  if (!suggestion || closed)
    return (
      <span className="mt-1 block">
        <Button
          type="button"
          variant="primary"
          className="min-h-7 px-2 py-0.5 text-xs"
          disabled={loading}
          aria-busy={loading}
          onClick={async () => {
            setClosed(false);
            onOpen?.();
            if (suggestion) return;
            setLoading(true);
            try {
              setSuggestion(await suggestPartnerLoginAction(partyId));
            } finally {
              setLoading(false);
            }
          }}
          data-partner-login-open={partyId}
        >
          {loading ? texts.loading : texts.open}
        </Button>
      </span>
    );

  if (!suggestion.ok)
    return (
      <p className="mt-1 text-red-700" role="alert">
        {suggestion.message}
      </p>
    );

  // No erro, o que foi digitado continua nos campos.
  const values = state.values ?? {
    login: suggestion.login,
    name: suggestion.name,
    password: suggestion.password,
    locale: suggestion.locale,
  };
  return (
    <form
      action={action}
      className="mt-1.5 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2"
      data-partner-login-form={partyId}
    >
      <input type="hidden" name="partyId" value={partyId} />
      <p className="font-semibold text-zinc-900">
        {texts.title.replace("{name}", partyName)}
      </p>
      {/* Uma coluna: o cartão da Estratégia é estreito (campos inteiros). */}
      <div className="grid gap-2">
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
            data-partner-login-login=""
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
            data-partner-login-name=""
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
            data-partner-login-password-input=""
          />
        </Field>
        <Field label={texts.locale}>
          <Select
            name="locale"
            defaultValue={values.locale}
            data-partner-login-locale=""
          >
            {Object.entries(texts.localeNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state.message ? (
        <p className="text-red-700" role="alert" data-partner-login-error="">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          variant="primary"
          className="min-h-7 px-2 py-1 text-xs"
          pendingText={texts.working}
          data-partner-login-submit=""
        >
          {texts.submit}
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          className="min-h-7 px-2 py-1 text-xs"
          onClick={() => setClosed(true)}
        >
          {texts.cancel}
        </Button>
      </div>
    </form>
  );
}
