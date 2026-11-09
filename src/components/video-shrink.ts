"use client";

import { planVideo, shouldReduceVideo } from "@/lib/video-plan";

/*
 * Reduz o vídeo no próprio aparelho antes de enviar no chat (como o
 * WhatsApp): 720p, H.264 e taxa ajustada à duração para caber no teto de
 * 50 MB, com o áudio copiado como está. Usa o WebCodecs do navegador
 * (Safari 16.4+, Chrome 94+, Firefox 130+) pela biblioteca mediabunny,
 * carregada só quando um vídeo precisa ser reduzido. A conta (tamanho, taxa,
 * quando reduzir) está em src/lib/video-plan.ts. Não deu para reduzir: quem
 * chama manda o original, se couber.
 */

export type VideoPrepared =
  /** Manda o original (cabe e não precisa reduzir). */
  | { status: "as_is" }
  | { status: "reduced"; file: File }
  /** Longo demais para caber mesmo reduzido. */
  | { status: "too_long"; maxDurationSec: number }
  /** O aparelho não conseguiu reduzir (navegador antigo, formato que não lê). */
  | { status: "unsupported" };

/** Vídeo pelo tipo ou, sem tipo (alguns Windows), pela extensão. */
export function isVideoFile(file: File) {
  const type = file.type.toLowerCase();
  return (
    type.startsWith("video/") ||
    (!type && /\.(mp4|m4v|mov|qt|webm|3gp)$/i.test(file.name))
  );
}

function hasWebCodecs() {
  return (
    typeof window !== "undefined" &&
    "VideoEncoder" in window &&
    "VideoDecoder" in window
  );
}

export async function prepareVideo(
  file: File,
  options: {
    maxBytes: number;
    /** Botão "Foto ou vídeo": também reduz o que cabe, mas pesa bem mais que o reduzido. */
    photoButton: boolean;
    /** Andamento da redução, de 0 a 99. */
    onProgress: (percent: number) => void;
  },
): Promise<VideoPrepared> {
  const { maxBytes, photoButton } = options;
  // Pelo "Arquivo", o que cabe vai como está (nem abre o vídeo).
  if (!photoButton && file.size <= maxBytes) return { status: "as_is" };
  if (!hasWebCodecs()) return { status: "unsupported" };
  let mb: typeof import("mediabunny");
  try {
    mb = await import("mediabunny");
  } catch {
    return { status: "unsupported" };
  }
  const input = new mb.Input({
    source: new mb.BlobSource(file),
    formats: mb.ALL_FORMATS,
  });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) return { status: "unsupported" };
    const audio = await input.getPrimaryAudioTrack();
    const [width, height, durationSec, stats] = await Promise.all([
      video.getDisplayWidth(),
      video.getDisplayHeight(),
      input.computeDuration(),
      video.computePacketStats(120).catch(() => null),
    ]);
    const plan = planVideo({
      width,
      height,
      durationSec,
      fps: stats?.averagePacketRate ?? null,
      maxBytes,
    });
    if (!shouldReduceVideo({ size: file.size, maxBytes, photoButton, plan }))
      return { status: "as_is" };
    if (plan.kind === "too_long")
      return { status: "too_long", maxDurationSec: plan.maxDurationSec };

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      video: {
        width: plan.width,
        height: plan.height,
        fit: "contain",
        codec: "avc",
        quality: new mb.Quality({ bitrate: plan.videoBitrate }),
        ...(plan.frameRate ? { frameRate: plan.frameRate } : {}),
        forceTranscode: true,
      },
    });
    // Imagem ou som que o aparelho não lê ou não grava: nada de vídeo mudo
    // ou pela metade; quem chama manda o original, se couber.
    const lost = conversion.discardedTracks.some(
      (d) => d.track === video || (audio !== null && d.track === audio),
    );
    if (!conversion.isValid || lost) return { status: "unsupported" };
    conversion.onProgress = (progress) =>
      options.onProgress(Math.min(99, Math.round(progress * 100)));
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) return { status: "unsupported" };
    const base = file.name.replace(/\.[^.]*$/, "") || "video";
    return {
      status: "reduced",
      file: new File([buffer], `${base}.mp4`, {
        type: "video/mp4",
        lastModified: file.lastModified,
      }),
    };
  } catch (error) {
    console.error("redução do vídeo falhou", error);
    return { status: "unsupported" };
  } finally {
    input.dispose();
  }
}
