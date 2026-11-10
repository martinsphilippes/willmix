"use client";

import { useEffect, useState } from "react";
import { Button, Field, Textarea, linkClass } from "@/components/ui";
import {
  ART_PROMPT_WISH_MAX,
  buildArtPrompt,
  type ArtPromptInput,
} from "@/lib/packaging-art-prompt";

/**
 * "Prompt para criar a arte": a pessoa escreve o que quer na arte, toca em
 * "Gerar prompt" e copia o texto pronto (com os dados do briefing) para colar
 * no ChatGPT. Tudo acontece no navegador: o portal não chama IA nem grava. O
 * que foi escrito fica guardado neste aparelho, por briefing, para não se
 * perder ao sair da tela.
 */
export function PackagingArtPrompt({
  briefId,
  base,
  labels,
}: {
  briefId: string;
  /** Abertura, dados do briefing e regras finais, já traduzidos. */
  base: Omit<ArtPromptInput, "wish">;
  labels: {
    hint: string;
    wish: string;
    wishPlaceholder: string;
    generate: string;
    result: string;
    copy: string;
    copied: string;
    copyFailed: string;
    open: string;
  };
}) {
  const storageKey = `wellmix:art-prompt:${briefId}`;
  const [wish, setWish] = useState("");
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  // Rascunho deste aparelho (sem ele a tela funciona igual).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setWish(saved.slice(0, ART_PROMPT_WISH_MAX));
    } catch {}
  }, [storageKey]);

  function changeWish(value: string) {
    setWish(value);
    try {
      if (value) window.localStorage.setItem(storageKey, value);
      else window.localStorage.removeItem(storageKey);
    } catch {}
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      // Sem a API de cópia: o texto fica na caixa para copiar à mão.
      setState("failed");
    }
  }

  return (
    <div className="space-y-3" data-art-prompt>
      <p className="text-sm text-zinc-600">{labels.hint}</p>
      <Field label={labels.wish}>
        <Textarea
          rows={3}
          maxLength={ART_PROMPT_WISH_MAX}
          value={wish}
          onChange={(e) => changeWish(e.target.value)}
          placeholder={labels.wishPlaceholder}
          data-art-prompt-wish
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setPrompt(buildArtPrompt({ ...base, wish }));
          setState("idle");
        }}
        data-art-prompt-generate
      >
        {labels.generate}
      </Button>
      {prompt ? (
        <div className="space-y-2">
          <Field label={labels.result}>
            <Textarea
              rows={12}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
              data-art-prompt-result
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void copy()}
              data-art-prompt-copy
            >
              {state === "copied" ? `${labels.copied} ✓` : labels.copy}
            </Button>
            <a
              href="https://chatgpt.com/"
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              {labels.open} →
            </a>
            {state === "failed" ? (
              <span className="text-xs text-amber-700" role="status">
                {labels.copyFailed}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
