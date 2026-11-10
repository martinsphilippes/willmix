"use client";

import { useEffect, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useFormDoneSignal } from "@/components/submit-button";
import { Button } from "@/components/ui";

/*
 * Pequenas ajudas da tela do Booking no navegador (a tela funciona sem elas):
 * - o filtro de uma coluna de opção ou de data já filtra ao escolher;
 * - campos vazios não vão para o endereço (ele fica curto e legível);
 * - digitar a quantidade numa linha marca a linha, e Enter ali não envia a
 *   barra de ações por engano.
 */
export function BookingEnhancer({
  filterFormId,
  bulkFormId,
}: {
  filterFormId: string;
  bulkFormId: string;
}) {
  useEffect(() => {
    const filter = document.getElementById(filterFormId);
    if (!(filter instanceof HTMLFormElement)) return;
    type Control = HTMLInputElement | HTMLSelectElement;
    const isControl = (el: unknown): el is Control =>
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement;

    const onSubmit = () => {
      const emptied: Control[] = [];
      for (const el of Array.from(filter.elements)) {
        if (!isControl(el) || el.disabled || !el.name) continue;
        if (el.value.trim() === "") {
          el.disabled = true;
          emptied.push(el);
        }
      }
      // Os dados do envio já foram lidos: os campos voltam a aceitar digitação.
      window.setTimeout(() => {
        for (const el of emptied) el.disabled = false;
      }, 0);
    };
    const onChange = (event: Event) => {
      const el = event.target;
      if (!isControl(el) || el.form !== filter) return;
      if (el instanceof HTMLSelectElement || el.type === "date")
        filter.requestSubmit();
    };
    const rowBox = (id: string) =>
      document.querySelector<HTMLInputElement>(
        `input[type="checkbox"][form="${CSS.escape(bulkFormId)}"][name="ids"][value="${CSS.escape(id)}"]`,
      );
    const onInput = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLInputElement)) return;
      const id = el.dataset.bookingQty;
      if (!id || el.value.trim() === "") return;
      const box = rowBox(id);
      if (box) box.checked = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target;
      if (
        event.key === "Enter" &&
        el instanceof HTMLInputElement &&
        el.dataset.bookingQty
      )
        event.preventDefault();
    };
    filter.addEventListener("submit", onSubmit);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      filter.removeEventListener("submit", onSubmit);
      document.removeEventListener("change", onChange);
      document.removeEventListener("input", onInput);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterFormId, bulkFormId]);
  return null;
}

/**
 * Botão da barra de ações: manda qual ação (`op`). Enquanto grava, todos
 * ficam desativados e só o apertado mostra "Gravando…". Com `confirmText`,
 * pergunta antes, dizendo quantas linhas estão marcadas e a etapa escolhida
 * (`{n}` e `{stage}`); sem linha marcada (ou sem etapa, quando o texto a
 * usa) não pergunta: o servidor responde com o aviso certo.
 */
export function BulkButton({
  op,
  children,
  pendingText,
  confirmText,
  ...props
}: Omit<ComponentProps<typeof Button>, "name" | "value" | "type"> & {
  op: string;
  pendingText: string;
  confirmText?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("op") === op;
  // A barra do topo para quando o envio termina, mesmo que o endereço de
  // volta seja igual ao de agora (duas ações seguidas com o mesmo aviso).
  useFormDoneSignal(pending);
  return (
    <Button
      {...props}
      type="submit"
      name="op"
      value={op}
      aria-busy={mine}
      disabled={pending || !!props.disabled}
      onClick={(event) => {
        if (!confirmText) return;
        const form = event.currentTarget.form;
        if (!form) return;
        const ticked = Array.from(form.elements).filter(
          (el) =>
            el instanceof HTMLInputElement &&
            el.type === "checkbox" &&
            el.name === "ids" &&
            el.checked,
        ).length;
        const select = form.elements.namedItem("status");
        const stage =
          select instanceof HTMLSelectElement && select.value
            ? (select.selectedOptions[0]?.textContent ?? "").trim()
            : "";
        if (!ticked || (confirmText.includes("{stage}") && !stage)) return;
        const question = confirmText
          .replaceAll("{n}", String(ticked))
          .replaceAll("{stage}", stage);
        if (!window.confirm(question)) event.preventDefault();
      }}
    >
      {mine ? pendingText : children}
    </Button>
  );
}
