"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { chatSendFileAction } from "@/app/app/actions/chat";
import { SERVER_MAX_BYTES, uploadDirect } from "./direct-upload";
import { shrink } from "./photo-input";

/*
 * Envio de fotos e arquivos no chat (painel lateral e tela de Mensagens):
 * vários de uma vez, um por mensagem (como no WhatsApp), na ordem escolhida.
 * O texto digitado vai junto com o primeiro. Fotos do botão "Foto" são
 * reduzidas no aparelho (chegam rápido na rede lenta da fábrica); o botão
 * "Arquivo", arrastar e colar mandam o arquivo como está. Acima de ~3,5 MB o
 * arquivo sobe direto ao armazenamento e a mensagem leva só o id. O servidor
 * confere acesso, tipo e tamanho de cada um.
 */

/** Teto por arquivo (o mesmo do servidor). */
const MAX_BYTES = 50_000_000;
/** Lado maior da foto reduzida (detalhe de impressão e acabamento ainda visível). */
const PHOTO_MAX_DIMENSION = 2048;

export interface ChatUploadLabels {
  photo: string;
  photoTitle: string;
  file: string;
  fileTitle: string;
  /** Com {done} e {total}. */
  progress: string;
  /** Com {done}, {total} e {percent}. */
  progressPercent: string;
  drop: string;
  /** Com {name} e {reason}. */
  failedFile: string;
  failed: string;
  tooBig: string;
  serverOnly: string;
  /** Motivo pelo código de erro do servidor (mime, too_large, empty…). */
  errors: Record<string, string>;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

/** Foto do botão "Foto": reduzida (GIF animado e SVG ficam como estão). */
async function prepare(file: File, photo: boolean): Promise<File> {
  const type = file.type.toLowerCase();
  if (!photo || type === "image/gif" || type === "image/svg+xml") return file;
  if (type && !type.startsWith("image/")) return file;
  try {
    return await shrink(file, PHOTO_MAX_DIMENSION, 0.85);
  } catch {
    return file;
  }
}

/** Imagem colada (print) chega como "image.png": ganha data e hora no nome. */
export function namePasted(file: File): File {
  if (file.name && !/^image\.\w+$/i.test(file.name)) return file;
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return new File([file], `image-${stamp}.${ext}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

interface UploadJob {
  topicId: string;
  files: File[];
  caption: string;
  photo: boolean;
}

export function useChatUpload({
  labels,
  onSent,
  onCaptionSent,
}: {
  labels: ChatUploadLabels;
  /** Depois de cada arquivo enviado (recarregar a conversa). */
  onSent?: () => void | Promise<void>;
  /** O texto digitado foi junto com um arquivo (para limpar a caixa). */
  onCaptionSent?: (caption: string) => void;
}) {
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    percent: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Fila: o que chega durante um envio (arrastar ou colar mais) vai depois.
  const queue = useRef<UploadJob[]>([]);
  const running = useRef(false);
  const counts = useRef({ done: 0, total: 0 });

  async function sendOne(job: UploadJob, file: File, problems: string[]) {
    const done = counts.current.done + 1;
    const total = counts.current.total;
    setProgress({ done, total, percent: null });
    const name = file.name || "—";
    const problem = (reason: string) =>
      problems.push(fill(labels.failedFile, { name, reason }));
    const ready = await prepare(file, job.photo);
    if (ready.size === 0) {
      problem(labels.errors.empty ?? labels.failed);
      return;
    }
    if (ready.size > MAX_BYTES) {
      problem(labels.tooBig);
      return;
    }
    try {
      const form = new FormData();
      form.set("topicId", job.topicId);
      if (job.caption) form.set("body", job.caption);
      if (ready.size > SERVER_MAX_BYTES) {
        // Grande demais para a requisição: sobe direto ao armazenamento.
        const ids = await uploadDirect([ready], (percent) =>
          setProgress({ done, total: counts.current.total, percent }),
        );
        if (!ids) {
          problem(labels.serverOnly);
          return;
        }
        form.set("uploadedFileId", ids[0]);
      } else {
        form.set("file", ready);
      }
      const res = await chatSendFileAction(form);
      if (!res.ok) {
        problem(labels.errors[res.error] ?? labels.failed);
        return;
      }
      if (job.caption) {
        onCaptionSent?.(job.caption);
        job.caption = "";
      }
      await onSent?.();
    } catch (err) {
      console.error("envio do anexo do chat falhou", err);
      // O motivo técnico ajuda a diagnosticar (ex.: domínio não cadastrado no Appwrite).
      const detail =
        err instanceof Error && err.message
          ? ` (${err.message.slice(0, 120)})`
          : "";
      problem(`${labels.failed}${detail}`);
    }
  }

  /**
   * Envia os arquivos no assunto, um por mensagem. `caption`: o texto da
   * caixa, que vai com o primeiro arquivo (só quando nada está sendo enviado;
   * na fila, os arquivos vão sem texto).
   */
  async function send(
    topicId: string,
    files: File[],
    options: { caption?: string; photo?: boolean } = {},
  ) {
    if (!files.length) return;
    const busy = running.current;
    queue.current.push({
      topicId,
      files,
      caption: busy ? "" : (options.caption?.trim() ?? ""),
      photo: !!options.photo,
    });
    counts.current.total += files.length;
    if (busy) {
      setProgress((p) => (p ? { ...p, total: counts.current.total } : p));
      return;
    }
    running.current = true;
    setError(null);
    const problems: string[] = [];
    try {
      for (let job = queue.current.shift(); job; job = queue.current.shift()) {
        for (const file of job.files) {
          await sendOne(job, file, problems);
          counts.current.done++;
        }
      }
    } finally {
      running.current = false;
      counts.current = { done: 0, total: 0 };
      setProgress(null);
      setError(problems.length ? problems.join(" · ") : null);
    }
  }

  const status = progress
    ? progress.percent !== null
      ? fill(labels.progressPercent, {
          done: progress.done,
          total: progress.total,
          percent: progress.percent,
        })
      : fill(labels.progress, { done: progress.done, total: progress.total })
    : null;
  return { send, busy: progress !== null, status, error, setError };
}

/**
 * Arrastar arquivos para a conversa: devolve se há arquivos em cima (para o
 * aviso "Solte aqui"). `target` nulo: a página inteira (tela de Mensagens).
 * Só reage a arquivos; texto arrastado segue o comportamento normal. O que o
 * painel lateral (aberto por cima) já tratou não vale para a página de baixo.
 */
export function useFileDrop(
  target: React.RefObject<HTMLElement | null> | null,
  enabled: boolean,
  onDrop: (files: File[]) => void,
) {
  const [over, setOver] = useState(false);
  const dropped = useEffectEvent((files: File[]) => onDrop(files));
  useEffect(() => {
    const el: HTMLElement | Document | null = target
      ? target.current
      : document;
    if (!enabled || !el) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setOver(true);
    };
    const move = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const drop = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) dropped(files);
    };
    const on = (name: string, fn: (e: DragEvent) => void) =>
      el.addEventListener(name, fn as EventListener);
    const off = (name: string, fn: (e: DragEvent) => void) =>
      el.removeEventListener(name, fn as EventListener);
    on("dragenter", enter);
    on("dragover", move);
    on("dragleave", leave);
    on("drop", drop);
    return () => {
      off("dragenter", enter);
      off("dragover", move);
      off("dragleave", leave);
      off("drop", drop);
      setOver(false);
    };
  }, [target, enabled]);
  return over;
}

/** Arquivos colados (print da tela, imagem copiada) de um evento de colar. */
export function pastedFiles(e: React.ClipboardEvent): File[] {
  return Array.from(e.clipboardData?.files ?? []).map(namePasted);
}
