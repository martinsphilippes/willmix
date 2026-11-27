import type {
  SamplingFile,
  SupplierRequest,
  SupplierRequestSampling,
} from "@/lib/db/schema";
import { negotiationTurn } from "./supplier-requests";

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

/** A marca "Necessita amostragem" da consulta (opcional nas leituras parciais). */
type SamplingFlag = { samplingNeed?: "yes" | "no" | null };

/**
 * A consulta pede amostragem? (dono, 27/11/2026): só quando a Wellmix marca
 * "Necessita amostragem"; o padrão é desmarcado. A consulta de antes da
 * marca (nula) segue pedindo só se a amostra já andou (arquivo enviado ou
 * validação), para não sumir com o que o fornecedor já mandou; a dispensada
 * da cotação (`skipped`) não pede.
 */
export function samplingRequired(
  request: Pick<SupplierRequest, "sampling"> & SamplingFlag,
): boolean {
  if (request.samplingNeed === "yes") return true;
  if (request.samplingNeed === "no") return false;
  return samplingStarted(request.sampling);
}

/** A amostra já andou: arquivo enviado ou passou da pendente (sem a dispensada). */
export function samplingStarted(
  s: SupplierRequestSampling | null | undefined,
): boolean {
  return !!s && !s.skipped && (s.status !== "pending" || s.files.length > 0);
}

/**
 * A amostragem da solicitação: a gravada ou, na aprovada antes da etapa
 * existir, uma pendente aberta na aprovação. Sem aprovação, ou sem
 * "Necessita amostragem" (dono, 27/11/2026), nula.
 */
export function samplingOf(
  request: Pick<
    SupplierRequest,
    "status" | "decidedAt" | "updatedAt" | "sampling"
  > &
    SamplingFlag,
): SupplierRequestSampling | null {
  if (request.status !== "approved") return null;
  if (!samplingRequired(request)) return null;
  if (request.sampling) return request.sampling;
  return {
    status: "pending",
    round: 1,
    openedAt: request.decidedAt ?? request.updatedAt,
    files: [],
    history: [],
  };
}

/**
 * A amostragem como a tela e o envio a veem (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Amostragem desde a cotação"): a da aprovada
 * (`samplingOf`) e, com a solicitação ainda em andamento, a que o
 * fornecedor já pode adiantar desde o começo da cotação do item (a gravada
 * ou uma pendente aberta na criação). As travas (produto, pedido de compra)
 * e o prazo continuam valendo só depois da aprovação (`samplingOf`).
 */
export function samplingFor(
  request: Pick<
    SupplierRequest,
    "status" | "decidedAt" | "updatedAt" | "createdAt" | "sampling"
  > &
    SamplingFlag,
): SupplierRequestSampling | null {
  if (!samplingRequired(request)) return null;
  if (request.status === "approved") return samplingOf(request);
  if (request.status !== "open" && request.status !== "answered") return null;
  return (
    request.sampling ?? {
      status: "pending",
      round: 1,
      openedAt: request.createdAt,
      files: [],
      history: [],
    }
  );
}

/**
 * A amostragem na aprovação: a que ele já adiantou segue como está (enviada
 * ou aprovada não volta atrás); a pendente recomeça o prazo na aprovação.
 */
export function samplingOnApproval(
  existing: SupplierRequestSampling | null | undefined,
  at: string,
  byUserId: string,
): SupplierRequestSampling {
  if (!existing) return openSampling(at, byUserId);
  if (existing.status === "pending" || existing.status === "rejected")
    return {
      ...existing,
      openedAt: at,
      lateNotifiedAt: null,
      history: [
        ...existing.history,
        {
          id: crypto.randomUUID(),
          at,
          kind: "open",
          side: "wellmix",
          byUserId,
          round: existing.round,
        },
      ],
    };
  return existing;
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

/** O passo com a vez na solicitação (as chaves da Próxima ação de Encomendas). */
export type SupplierRequestStep =
  "supplier_answer" | "supplier_decide" | "sampling_send" | "sampling_validate";

const SUPPLIER_REQUEST_STEPS: readonly string[] = [
  "supplier_answer",
  "supplier_decide",
  "sampling_send",
  "sampling_validate",
];

/** A chave do Próximo passo é um passo da solicitação ao fornecedor? */
export const isSupplierRequestStep = (
  key: string,
): key is SupplierRequestStep => SUPPLIER_REQUEST_STEPS.includes(key);

/**
 * Onde se faz o passo (dono, 24/11/2026): a ação da vez ("Validar a
 * amostragem") é um link para o lugar de agir, o mesmo das Pendências.
 * Responder ou decidir: a solicitação; enviar ou validar a amostragem: o
 * produto, no quadro da amostragem (`#amostragem`).
 */
export function supplierRequestStepHref(
  id: string,
  step: SupplierRequestStep,
): string {
  const base = `/app/supplier-requests/${encodeURIComponent(id)}`;
  return step === "sampling_send" || step === "sampling_validate"
    ? `${base}?view=item#amostragem`
    : base;
}

/**
 * De quem é a vez na solicitação ao fornecedor e qual é a ação (dono,
 * 24/11/2026; docs/TURNS.md): na negociação, responder (fornecedor) ou
 * decidir (Wellmix); aprovada, a amostragem: enviar a amostra (fornecedor,
 * pendente ou reprovada) ou validar (Wellmix, enviada). Nulo quando não há
 * nada a fazer (recusada, cancelada ou com a amostra aprovada). A coluna Vez
 * da cotação e a lista de cotações usam esta regra; antes, a aprovada com a
 * amostra pendente aparecia com "—".
 */
export function supplierRequestTurn(
  request: Pick<
    SupplierRequest,
    "status" | "negotiation" | "decidedAt" | "updatedAt" | "sampling"
  > &
    SamplingFlag,
): { party: "supplier" | "wellmix"; step: SupplierRequestStep } | null {
  const negotiation = negotiationTurn(request);
  if (negotiation)
    return {
      party: negotiation,
      step: negotiation === "supplier" ? "supplier_answer" : "supplier_decide",
    };
  const sampling = samplingTurn(samplingOf(request));
  if (!sampling) return null;
  return {
    party: sampling,
    step: sampling === "supplier" ? "sampling_send" : "sampling_validate",
  };
}

/**
 * Amostra aprovada: libera criar/associar o produto e o pedido de compra.
 * Sem "Necessita amostragem" (dono, 27/11/2026), nada espera a amostra.
 */
export const samplingApproved = (
  request: Pick<
    SupplierRequest,
    "status" | "decidedAt" | "updatedAt" | "sampling"
  > &
    SamplingFlag,
) => !samplingRequired(request) || samplingOf(request)?.status === "approved";

/** Padrão do SLA da amostragem (dias corridos), decisão do dono (12/11/2026). */
export const SAMPLING_SLA_DAYS = 1;

/**
 * Prazo para o responsável enviar a amostra: da abertura da amostragem (ou
 * da última reprovação) + o SLA. Nulo quando a vez não é dele.
 */
export function samplingDueAt(
  s: SupplierRequestSampling | null,
  days: number = SAMPLING_SLA_DAYS,
): string | null {
  if (samplingTurn(s) !== "supplier" || !s) return null;
  const lastReject = [...s.history].reverse().find((e) => e.kind === "reject");
  const from = Date.parse(lastReject?.at ?? s.openedAt);
  if (Number.isNaN(from)) return null;
  return new Date(from + days * 86_400_000).toISOString();
}

/** Passou do prazo sem enviar a amostra. */
export function samplingLate(
  s: SupplierRequestSampling | null,
  days: number = SAMPLING_SLA_DAYS,
  now: Date = new Date(),
): boolean {
  const due = samplingDueAt(s, days);
  return !!due && Date.parse(due) < now.getTime();
}
