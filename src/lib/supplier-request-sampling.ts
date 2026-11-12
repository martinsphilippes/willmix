import type {
  SamplingFile,
  SupplierRequest,
  SupplierRequestSampling,
} from "@/lib/db/schema";

/*
 * Amostragem da solicitação ao fornecedor (docs/SUPPLIER_SAMPLING.md):
 * regras puras, sem banco. Depois da aprovação da Wellmix, o responsável
 * pelo booking envia fotos e vídeos de uma amostra do item; a Wellmix aprova
 * ou reprova (com o motivo). Reprovada, abre outra rodada: ele manda de novo.
 */

/** Teto de arquivos por rodada. */
export const SAMPLING_MAX_FILES = 30;

/** Fotos e vídeos aceitos na amostragem. */
export const SAMPLING_PHOTO_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];
export const SAMPLING_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
];
/** O `accept` do campo de arquivo. */
export const SAMPLING_ACCEPT = [
  ...SAMPLING_PHOTO_MIME,
  ...SAMPLING_VIDEO_MIME,
  ".heic",
  ".mov",
  ".mp4",
].join(",");

/** Foto, vídeo ou nulo (tipo não aceito). */
export function samplingKind(mime: string): SamplingFile["kind"] | null {
  const m = (mime || "").toLowerCase();
  if (SAMPLING_PHOTO_MIME.includes(m)) return "photo";
  if (SAMPLING_VIDEO_MIME.includes(m)) return "video";
  return null;
}

/**
 * A amostragem da solicitação: a gravada ou, na aprovada antes da etapa
 * existir, uma pendente aberta na aprovação. Sem aprovação, nula.
 */
export function samplingOf(
  request: Pick<
    SupplierRequest,
    "status" | "decidedAt" | "updatedAt" | "sampling"
  >,
): SupplierRequestSampling | null {
  if (request.status !== "approved") return null;
  if (request.sampling) return request.sampling;
  return {
    status: "pending",
    round: 1,
    openedAt: request.decidedAt ?? request.updatedAt,
    files: [],
    history: [],
  };
}

/** Amostragem nova, aberta na aprovação. */
export function openSampling(
  at: string,
  byUserId: string,
): SupplierRequestSampling {
  return {
    status: "pending",
    round: 1,
    openedAt: at,
    files: [],
    history: [
      {
        id: crypto.randomUUID(),
        at,
        kind: "open",
        side: "wellmix",
        byUserId,
        round: 1,
      },
    ],
  };
}

/** Arquivos da rodada atual (os que vão para a validação). */
export const samplingRoundFiles = (s: SupplierRequestSampling) =>
  s.files.filter((f) => f.round === s.round);

/** O responsável sobe ou tira arquivos: pendente ou reprovada. */
export const samplingCanUpload = (s: SupplierRequestSampling | null) =>
  !!s && (s.status === "pending" || s.status === "rejected");

/** Enviar para a validação: pode subir e já tem arquivo na rodada. */
export const samplingCanSubmit = (s: SupplierRequestSampling | null) =>
  !!s && samplingCanUpload(s) && samplingRoundFiles(s).length > 0;

/** A Wellmix valida: só a enviada. */
export const samplingCanReview = (s: SupplierRequestSampling | null) =>
  !!s && s.status === "submitted";

/** De quem é a vez: do responsável (enviar) ou da Wellmix (validar); nulo na aprovada. */
export function samplingTurn(
  s: SupplierRequestSampling | null,
): "supplier" | "wellmix" | null {
  if (!s) return null;
  if (s.status === "submitted") return "wellmix";
  if (s.status === "approved") return null;
  return "supplier";
}
