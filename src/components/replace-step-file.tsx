"use client";

import { useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { submitImportStepAction } from "@/app/app/actions/import-flow";
import { Button, cx } from "./ui";
import { SubmitButton } from "./submit-button";
import {
  DIRECT_MAX_BYTES,
  SERVER_MAX_BYTES,
  uploadDirect,
} from "./direct-upload";

/*
 * Substituir o arquivo de um documento já enviado (quadro do alto da
 * Certificação: o selo e o memorial; dono, 14/11/2026). O botão compacto abre
 * o seletor; com o arquivo escolhido aparecem o nome dele, "Confirmar
 * substituição" e "Cancelar". Nada sobe antes da confirmação, e o arquivo
 * atual continua no quadro (o link é do servidor) até a troca ser gravada.
 * Arquivo grande sobe direto ao armazenamento depois de confirmado; o
 * formulário leva só o id.
 */

export interface ReplaceLabels {
  start: string;
  /** Com {name}: o arquivo escolhido. */
  chosen: string;
  confirm: string;
  cancel: string;
  pending: string;
  /** Com {percent}: progresso do envio direto (arquivo grande). */
  uploading: string;
  failed: string;
  tooBig: string;
}

export function ReplaceStepFile({
  orderId,
  stepKey,
  anchor,
  returnTo,
  labels,
}: {
  orderId: string;
  stepKey: string;
  anchor: string;
  returnTo?: string;
  labels: ReplaceLabels;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  /** Tira o id do envio direto (cancelado ou trocado de arquivo). */
  function clearDirect() {
    const form = formRef.current;
    form
      ?.querySelectorAll("input[data-replace-uploaded]")
      .forEach((el) => el.remove());
    if (form) delete form.dataset.direct;
  }

  function cancel() {
    if (inputRef.current) inputRef.current.value = "";
    clearDirect();
    setChosen(null);
    setError(null);
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    clearDirect();
    setError(null);
    if (file && file.size > DIRECT_MAX_BYTES) {
      event.currentTarget.value = "";
      setChosen(null);
      setError(labels.tooBig);
      return;
    }
    setChosen(file);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (!chosen) {
      event.preventDefault();
      return;
    }
    // Arquivo dentro do teto da requisição (ou já subido direto): segue.
    if (form.dataset.direct === "done" || chosen.size <= SERVER_MAX_BYTES)
      return;
    event.preventDefault();
    setError(null);
    setProgress(0);
    try {
      const ids = await uploadDirect([chosen], setProgress);
      if (!ids?.[0]) throw new Error("upload");
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "uploadedFileId";
      hidden.value = ids[0];
      hidden.dataset.replaceUploaded = "";
      form.appendChild(hidden);
      // O campo de arquivo vai vazio: o formulário leva só o id.
      if (inputRef.current) inputRef.current.value = "";
      form.dataset.direct = "done";
      form.requestSubmit();
    } catch {
      // Falhou antes de chegar ao servidor: o arquivo atual continua.
      setError(labels.failed);
      clearDirect();
    } finally {
      setProgress(null);
    }
  }

  return (
    <form
      ref={formRef}
      action={submitImportStepAction}
      onSubmit={onSubmit}
      className="mt-2"
      data-replace-form={stepKey}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="key" value={stepKey} />
      <input type="hidden" name="anchor" value={anchor} />
      <input type="hidden" name="replace" value="1" />
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        name="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onChange}
        data-replace-file={stepKey}
      />
      {chosen ? (
        <Chosen
          name={chosen.name}
          labels={labels}
          onCancel={cancel}
          uploading={progress !== null}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          onClick={() => {
            setError(null);
            inputRef.current?.click();
          }}
          data-replace-start={stepKey}
        >
          {labels.start}
        </Button>
      )}
      {progress !== null ? (
        <p className="mt-1 text-xs text-zinc-600" role="status">
          {labels.uploading.replace("{percent}", String(progress))}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-1 text-xs font-medium text-red-700"
          role="alert"
          data-replace-error={stepKey}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Arquivo escolhido: o nome, confirmar e cancelar (sem cancelar durante o envio). */
function Chosen({
  name,
  labels,
  onCancel,
  uploading,
}: {
  name: string;
  labels: ReplaceLabels;
  onCancel: () => void;
  uploading: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = pending || uploading;
  return (
    <div className="space-y-2" data-replace-chosen>
      <p className="text-sm text-zinc-800">
        {labels.chosen.split("{name}")[0]}
        <span className="font-medium break-all" data-replace-name>
          {name}
        </span>
        {labels.chosen.split("{name}")[1] ?? ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton
          className="px-2.5 py-1 text-xs"
          pendingText={labels.pending}
          disabled={uploading}
          data-replace-confirm
        >
          {labels.confirm}
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          className={cx("px-2.5 py-1 text-xs")}
          onClick={onCancel}
          disabled={busy}
          data-replace-cancel
        >
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
