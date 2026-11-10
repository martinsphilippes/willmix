"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * "Copiar login e senha": junta o endereço do portal, o login e a senha que
 * estão digitados no formulário de criar acesso e copia, para a Wellmix colar
 * na mensagem ao fornecedor. A senha não é guardada à vista em lugar nenhum:
 * por isso a cópia é feita aqui, antes de criar.
 */
export function AccessCopy({
  labels,
}: {
  labels: {
    copy: string;
    copied: string;
    empty: string;
    portal: string;
    login: string;
    password: string;
  };
}) {
  const [state, setState] = useState<"idle" | "copied" | "empty">("idle");

  async function copy(button: HTMLButtonElement) {
    const form = button.closest("form");
    const value = (name: string) =>
      (
        form?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ??
        ""
      ).trim();
    const login = value("login");
    const password = value("password");
    if (!login || !password) {
      setState("empty");
      return;
    }
    const text = [
      `${labels.portal}: ${window.location.origin}/login`,
      `${labels.login}: ${login}`,
      `${labels.password}: ${password}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      // Sem a API de cópia: os dois campos continuam visíveis para copiar à mão.
      setState("empty");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={(e) => void copy(e.currentTarget)}
        data-access-copy=""
      >
        {state === "copied" ? `${labels.copied} ✓` : labels.copy}
      </Button>
      {state === "empty" ? (
        <span className="text-xs text-amber-700" role="status">
          {labels.empty}
        </span>
      ) : null}
    </span>
  );
}
