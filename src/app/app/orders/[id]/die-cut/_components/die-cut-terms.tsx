"use client";

import {
  useActionState,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import type { DieCutTermsState } from "@/app/app/actions/die-cut-step";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input } from "@/components/ui";

type TermsAction = (
  prev: DieCutTermsState,
  form: FormData,
) => Promise<DieCutTermsState>;

export interface DieCutTermsLabels {
  /** "Confira os números…": só no formulário. */
  hint: string;
  moq: string;
  leadTime: string;
  submit: string;
  edit: string;
  /**
   * Nome do "Editar" para leitores de tela, com o produto; nulo (produto sem
   * nome) fica o texto visível.
   */
  editAria: string | null;
  cancel: string;
}

const NO_ERROR: DieCutTermsState = { error: null, message: null, field: null };

/*
 * Pedido mínimo e prazo de entrega de um produto no quadro Die Cut (pedido do
 * dono, 13/11/2026). Confirmado, o bloco mostra só o resumo (valores, quem e
 * quando; o selo "Confirmado" fica no título) e, enquanto a etapa deixa
 * corrigir, "Editar", que abre o formulário com os valores salvos. Sem
 * confirmação, o formulário já vem aberto, como antes. A página remonta o
 * bloco quando o registro salvo muda (`key`), então depois de salvar ele
 * volta fechado, no resumo; recarregar mostra o mesmo.
 */
export function DieCutTerms({
  action,
  orderId,
  itemId,
  confirmed,
  canEdit,
  summary,
  initial,
  labels,
}: {
  action: TermsAction;
  orderId: string;
  itemId: string;
  /** Pedido mínimo e prazo já confirmados (registro salvo). */
  confirmed: boolean;
  /** Etapa aberta e quem vê pode enviar: dá para confirmar ou corrigir. */
  canEdit: boolean;
  /** Resumo do confirmado, já pronto (o servidor monta). */
  summary: ReactNode;
  /** Valores que o formulário traz: os salvos ou, antes, os negociados. */
  initial: { moq: string; leadTimeDays: string };
  labels: DieCutTermsLabels;
}) {
  const [editing, setEditing] = useState(!confirmed);
  const editRef = useRef<HTMLButtonElement>(null);
  const moqRef = useRef<HTMLInputElement>(null);

  if (canEdit && editing)
    return (
      <TermsForm
        action={action}
        orderId={orderId}
        itemId={itemId}
        initial={initial}
        labels={labels}
        moqRef={moqRef}
        onCancel={
          confirmed
            ? () => {
                // O formulário some: o foco volta para o "Editar".
                flushSync(() => setEditing(false));
                editRef.current?.focus();
              }
            : undefined
        }
      />
    );
  if (!confirmed) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
      data-die-cut-terms-summary
    >
      {summary}
      {canEdit ? (
        <Button
          ref={editRef}
          type="button"
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          aria-label={labels.editAria ?? undefined}
          onClick={() => {
            // O botão some: o foco vai para o primeiro campo.
            flushSync(() => setEditing(true));
            moqRef.current?.focus();
          }}
          data-die-cut-terms-edit
        >
          {labels.edit}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * O formulário. Os campos são controlados: uma recusa não apaga o que foi
 * digitado, e o erro aparece logo abaixo, no próprio formulário. Enquanto
 * envia, o botão fica desativado (`SubmitButton`) e "Cancelar" também.
 */
function TermsForm({
  action,
  orderId,
  itemId,
  initial,
  labels,
  moqRef,
  onCancel,
}: {
  action: TermsAction;
  orderId: string;
  itemId: string;
  initial: { moq: string; leadTimeDays: string };
  labels: DieCutTermsLabels;
  moqRef: RefObject<HTMLInputElement | null>;
  onCancel?: () => void;
}) {
  const [state, dispatch, pending] = useActionState(action, NO_ERROR);
  const [moq, setMoq] = useState(initial.moq);
  const [days, setDays] = useState(initial.leadTimeDays);
  const errorId = useId();
  const invalid = (field: DieCutTermsState["field"]) =>
    state.error && state.field === field ? true : undefined;
  const described = state.error ? errorId : undefined;
  const invalidClass =
    "w-36 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-100";
  return (
    <form action={dispatch} className="space-y-2" data-die-cut-terms>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="itemId" value={itemId} />
      <p className="text-xs text-zinc-600">{labels.hint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={labels.moq}>
          <Input
            ref={moqRef}
            name="moq"
            inputMode="numeric"
            required
            value={moq}
            onChange={(event) => setMoq(event.target.value)}
            aria-invalid={invalid("moq")}
            aria-describedby={described}
            className={invalidClass}
          />
        </Field>
        <Field label={labels.leadTime}>
          <Input
            name="leadTimeDays"
            inputMode="numeric"
            required
            value={days}
            onChange={(event) => setDays(event.target.value)}
            aria-invalid={invalid("leadTimeDays")}
            aria-describedby={described}
            className={invalidClass}
          />
        </Field>
        <SubmitButton pendingText="...">{labels.submit}</SubmitButton>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
            data-die-cut-terms-cancel
          >
            {labels.cancel}
          </Button>
        ) : null}
      </div>
      {state.error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-red-700"
          data-die-cut-terms-error={state.error}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
