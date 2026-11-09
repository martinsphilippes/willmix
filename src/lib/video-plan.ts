/*
 * Vídeo do chat reduzido no aparelho antes de enviar (como no WhatsApp): o
 * teto por arquivo é 50 MB (plano do Appwrite) e um minuto de vídeo do
 * celular passa disso. Aqui só a conta, sem navegador: tamanho final, taxa de
 * bits e quando reduzir. Quem converte é src/components/video-shrink.ts.
 *
 * - Lado maior até 1280 px (720p), sem aumentar vídeo pequeno; até 30 quadros
 *   por segundo.
 * - Taxa pela imagem (~0,09 bit por pixel por quadro: 2,5 Mbit/s em 720p) e
 *   nunca acima do que cabe no teto para a duração do vídeo. Vídeo longo desce
 *   para 960 e depois 640 px antes de ficar ruim demais; passou disso, é longo
 *   demais (uns 11 minutos).
 */

/** Degraus de resolução: lado maior e a menor taxa que ainda vale nele. */
const RUNGS = [
  { side: 1280, minBitrate: 1_200_000 },
  { side: 960, minBitrate: 700_000 },
  { side: 640, minBitrate: 350_000 },
] as const;
/** Bits por pixel por quadro (qualidade boa para conferir produto e fábrica). */
const BITS_PER_PIXEL = 0.09;
const MAX_FPS = 30;
/** Reserva para o áudio (copiado como está; AAC do celular fica em ~128-192 kbit/s). */
export const AUDIO_ALLOWANCE = 192_000;
/** Folga para o cabeçalho do arquivo e a variação da taxa. */
const SAFETY = 0.9;

export interface VideoPlanInput {
  /** Medidas de exibição (já com a rotação do celular). */
  width: number;
  height: number;
  durationSec: number;
  /** Quadros por segundo do original, se conhecido. */
  fps?: number | null;
  maxBytes: number;
}

export type VideoPlan =
  | {
      kind: "ok";
      width: number;
      height: number;
      videoBitrate: number;
      /** Quadros por segundo de saída (null = como o original). */
      frameRate: number | null;
      /** Tamanho esperado do vídeo reduzido. */
      expectedBytes: number;
    }
  | { kind: "too_long"; maxDurationSec: number };

/** Medida par (o codificador H.264 pede), sem aumentar o original. */
function fit(width: number, height: number, side: number) {
  const scale = Math.min(1, side / Math.max(width, height));
  const even = (n: number) => Math.max(2, 2 * Math.round((n * scale) / 2));
  return { width: even(width), height: even(height) };
}

export function planVideo(input: VideoPlanInput): VideoPlan {
  const duration = Math.max(1, input.durationSec);
  const sourceFps =
    input.fps && Number.isFinite(input.fps) && input.fps > 0 ? input.fps : null;
  const fps = Math.min(sourceFps ?? MAX_FPS, MAX_FPS);
  const budget = (input.maxBytes * 8 * SAFETY) / duration - AUDIO_ALLOWANCE;
  let last = 0;
  for (const rung of RUNGS) {
    const size = fit(input.width, input.height, rung.side);
    const ideal = size.width * size.height * fps * BITS_PER_PIXEL;
    const need = Math.min(rung.minBitrate, ideal);
    last = need;
    if (budget < need) continue;
    const videoBitrate = Math.round(Math.min(budget, ideal));
    return {
      kind: "ok",
      ...size,
      videoBitrate,
      frameRate: sourceFps !== null && sourceFps > MAX_FPS ? MAX_FPS : null,
      expectedBytes: Math.round(
        ((videoBitrate + AUDIO_ALLOWANCE) * duration) / 8,
      ),
    };
  }
  return {
    kind: "too_long",
    maxDurationSec: Math.floor(
      (input.maxBytes * 8 * SAFETY) / (last + AUDIO_ALLOWANCE),
    ),
  };
}

/**
 * Reduzir este vídeo? Acima do teto, sempre (senão não vai). Pelo botão
 * "Foto ou vídeo" (envio rápido, como a foto), também quando o original pesa
 * bem mais que o reduzido. Pelo "Arquivo", vai como está quando cabe.
 */
export function shouldReduceVideo(input: {
  size: number;
  maxBytes: number;
  photoButton: boolean;
  plan: VideoPlan;
}): boolean {
  if (input.size > input.maxBytes) return true;
  if (!input.photoButton || input.plan.kind !== "ok") return false;
  return input.size > input.plan.expectedBytes * 1.3;
}
