"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  DIRECT_MAX_BYTES,
  SERVER_MAX_BYTES,
  uploadDirect,
} from "./direct-upload";
import { cx } from "./ui";

const SHEET_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
const SHEET_CLASS =
  "block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-800 disabled:opacity-60";

interface DirectFileInputProps {
  name?: string;
  label: string;
  /** Falso quando há outro jeito de informar (ex.: link do Google Sheets) ou já há arquivo. */
  required?: boolean;
  /** Com {percent}: progresso do envio direto. */
  uploadingLabel: string;
  failedLabel: string;
  /** Com {name} e {size}: arquivo escolhido (já subido direto). */
  chosenLabel: string;
  /** Arquivo acima do teto do armazenamento (sem ele, vale o aviso de falha). */
  tooBigLabel?: string;
  /**
   * Vários arquivos de uma vez (o book feito de várias planilhas; dono,
   * 23/11/2026). Juntos acima do teto da requisição, sobem todos direto e o
   * formulário leva um `uploadedFileId` (e o nome) por arquivo, na ordem.
   */
  multiple?: boolean;
  /** Com {n}: quantos arquivos foram escolhidos (só com `multiple`). */
  countLabel?: string;
}

/**
 * Campo da planilha (.xlsx ou .xls). Planilha com fotos passa do teto da requisição
 * na Vercel (~4 MB): nesse caso sobe direto ao armazenamento e o formulário
 * leva só o id (`uploadedFileId`); menor, segue no próprio formulário. Em
 * desenvolvimento (modo memória) vai sempre pelo formulário.
 */
export function SheetFileInput({
  className,
  ...props
}: DirectFileInputProps & {
  /** Classes a mais no campo (ex.: o card compacto do book); sem elas, o de sempre. */
  className?: string;
}) {
  return (
    <DirectFileInput
      {...props}
      accept={SHEET_ACCEPT}
      className={className ? cx(SHEET_CLASS, className) : SHEET_CLASS}
      marker="sheet-import"
    />
  );
}

/**
 * Campo de arquivo de um formulário com botão de enviar (ex.: passo de
 * embarque ou de certificação, como a arte com o selo): o mesmo envio direto
 * da planilha para arquivo acima do teto da requisição, sem restringir o tipo.
 */
export function DirectFileInput({
  name = "file",
  label,
  uploadingLabel,
  failedLabel,
  chosenLabel,
  tooBigLabel,
  required = true,
  multiple = false,
  countLabel,
  accept,
  className,
  marker = "direct",
}: DirectFileInputProps & {
  accept?: string;
  className?: string;
  /** Prefixo dos atributos data-* (os testes da planilha usam "sheet-import"). */
  marker?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const { pending } = useFormStatus();

  function clearHidden() {
    for (const el of hiddenRef.current) el.remove();
    hiddenRef.current = [];
    if (inputRef.current) inputRef.current.required = required;
  }

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const form = input.form;
    const files = Array.from(input.files ?? []);
    setError(null);
    setChosen(null);
    setNames(multiple ? files.map((f) => f.name) : []);
    clearHidden();
    if (!files.length || !form) return;
    if (files.some((f) => f.size > DIRECT_MAX_BYTES)) {
      setError(tooBigLabel ?? failedLabel);
      input.value = "";
      setNames([]);
      return;
    }
    // Juntos cabem na requisição: seguem no próprio formulário.
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total <= SERVER_MAX_BYTES) return;
    setBusy(true);
    setProgress(0);
    // Enquanto o arquivo sobe, o formulário não envia: iria sem o arquivo
    // (ou, num reenvio, com o arquivo antigo).
    const hold = (e: Event) => e.preventDefault();
    form.addEventListener("submit", hold);
    try {
      const ids = await uploadDirect(files, setProgress);
      if (ids?.length === files.length) {
        // Um id e um nome por arquivo, na ordem em que foram escolhidos.
        files.forEach((file, i) => {
          const hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "uploadedFileId";
          hidden.value = ids[i];
          form.appendChild(hidden);
          const nameField = document.createElement("input");
          nameField.type = "hidden";
          nameField.name = "uploadedFileName";
          nameField.value = file.name;
          hidden.after(nameField);
          hiddenRef.current.push(hidden, nameField);
        });
        // O campo de arquivo fica vazio: o formulário leva só os ids.
        input.value = "";
        input.required = false;
        setChosen(
          chosenLabel
            .replace("{name}", files.map((f) => f.name).join(", "))
            .replace("{size}", `${(total / 1024 / 1024).toFixed(1)} MB`),
        );
      }
    } catch (err) {
      const detail =
        err instanceof Error && err.message
          ? ` (${err.message.slice(0, 160)})`
          : "";
      setError(`${failedLabel}${detail}`);
      input.value = "";
      setNames([]);
      clearHidden();
    } finally {
      form.removeEventListener("submit", hold);
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
        multiple={multiple || undefined}
        accept={accept}
        disabled={working}
        onChange={onChange}
        aria-label={label}
        aria-busy={working || undefined}
        className={className}
        {...{ [`data-${marker}-file`]: "" }}
      />
      {multiple && names.length > 1 ? (
        <div
          className="text-xs text-zinc-600"
          {...{ [`data-${marker}-files`]: String(names.length) }}
        >
          {countLabel ? (
            <p className="font-medium text-zinc-700">
              {countLabel.replace("{n}", String(names.length))}
            </p>
          ) : null}
          <ol className="list-decimal pl-5">
            {names.map((n, i) => (
              <li key={`${i}:${n}`} className="break-all">
                {n}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {busy && progress !== null ? (
        <p className="text-xs text-zinc-600" role="status">
          {uploadingLabel.replace("{percent}", String(progress))}
        </p>
      ) : null}
      {chosen ? (
        <p
          className="text-xs text-emerald-800"
          role="status"
          {...{ [`data-${marker}-uploaded`]: "" }}
        >
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
