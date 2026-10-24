"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { SERVER_MAX_BYTES, uploadDirect } from "./direct-upload";

/**
 * Campo da planilha (.xlsx). Planilha com fotos passa do teto da requisição
 * na Vercel (~4 MB): nesse caso sobe direto ao armazenamento e o formulário
 * leva só o id (`uploadedFileId`); menor, segue no próprio formulário. Em
 * desenvolvimento (modo memória) vai sempre pelo formulário.
 */
export function SheetFileInput({
  name = "file",
  label,
  uploadingLabel,
  failedLabel,
  chosenLabel,
  required = true,
}: {
  name?: string;
  label: string;
  /** Falso quando há outro jeito de informar a planilha (ex.: link do Google Sheets). */
  required?: boolean;
  /** Com {percent}: progresso do envio direto. */
  uploadingLabel: string;
  failedLabel: string;
  /** Com {name} e {size}: arquivo escolhido (já subido direto). */
  chosenLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const { pending } = useFormStatus();

  function clearHidden() {
    hiddenRef.current?.remove();
    hiddenRef.current = null;
    if (inputRef.current) inputRef.current.required = required;
  }

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const form = input.form;
    const file = input.files?.[0];
    setError(null);
    setChosen(null);
    clearHidden();
    if (!file || !form || file.size <= SERVER_MAX_BYTES) return;
    setBusy(true);
    try {
      const ids = await uploadDirect([file], setProgress);
      if (ids?.[0]) {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "uploadedFileId";
        hidden.value = ids[0];
        form.appendChild(hidden);
        hiddenRef.current = hidden;
        const nameField = document.createElement("input");
        nameField.type = "hidden";
        nameField.name = "uploadedFileName";
        nameField.value = file.name;
        hidden.after(nameField);
        // O campo de arquivo fica vazio: o formulário leva só o id.
        input.value = "";
        input.required = false;
        setChosen(
          chosenLabel
            .replace("{name}", file.name)
            .replace("{size}", `${(file.size / 1024 / 1024).toFixed(1)} MB`),
        );
        // O nome escondido sai junto com o id.
        const removeBoth = hidden.remove.bind(hidden);
        hidden.remove = () => {
          nameField.remove();
          removeBoth();
        };
      }
    } catch (err) {
      const detail =
        err instanceof Error && err.message ? ` (${err.message.slice(0, 160)})` : "";
      setError(`${failedLabel}${detail}`);
      input.value = "";
      clearHidden();
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  const working = busy || pending;
  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        name={name}
        required={required}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={working}
        onChange={onChange}
        aria-label={label}
        aria-busy={working || undefined}
        className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-800 disabled:opacity-60"
        data-sheet-import-file
      />
      {busy && progress !== null ? (
        <p className="text-xs text-zinc-600" role="status">
          {uploadingLabel.replace("{percent}", String(progress))}
        </p>
      ) : null}
      {chosen ? (
        <p className="text-xs text-emerald-800" role="status" data-sheet-import-uploaded>
          {chosen}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
