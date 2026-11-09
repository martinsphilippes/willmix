import { describe, expect, it } from "vitest";
import {
  AUDIO_ALLOWANCE,
  planVideo,
  shouldReduceVideo,
  type VideoPlan,
} from "@/lib/video-plan";

/*
 * Vídeo do chat reduzido no aparelho para caber nos 50 MB: 720p com taxa boa
 * para um vídeo de 1 a 2 minutos; vídeo mais longo desce a taxa e depois a
 * resolução; acima de uns 11 minutos, longo demais. "Foto ou vídeo" reduz o
 * que pesa bem mais que o reduzido; "Arquivo" só o que não cabe.
 */

const MAX = 50_000_000;
const ok = (plan: VideoPlan) => {
  if (plan.kind !== "ok") throw new Error("esperava um plano");
  return plan;
};

describe("plano do vídeo reduzido", () => {
  it("1 minuto do iPhone (1080p, 30 fps): 720p a ~2,5 Mbit/s, uns 20 MB", () => {
    const plan = ok(
      planVideo({
        width: 1920,
        height: 1080,
        durationSec: 60,
        fps: 30,
        maxBytes: MAX,
      }),
    );
    expect([plan.width, plan.height]).toEqual([1280, 720]);
    expect(plan.videoBitrate).toBe(Math.round(1280 * 720 * 30 * 0.09));
    expect(plan.frameRate).toBeNull();
    expect(plan.expectedBytes).toBeGreaterThan(18_000_000);
    expect(plan.expectedBytes).toBeLessThan(22_000_000);
  });

  it("vídeo em pé (retrato) mantém a proporção, com medidas pares", () => {
    const plan = ok(
      planVideo({ width: 1080, height: 1920, durationSec: 60, maxBytes: MAX }),
    );
    expect([plan.width, plan.height]).toEqual([720, 1280]);
    const odd = ok(
      planVideo({ width: 1366, height: 1025, durationSec: 30, maxBytes: MAX }),
    );
    expect(odd.width % 2).toBe(0);
    expect(odd.height % 2).toBe(0);
  });

  it("60 quadros por segundo viram 30; vídeo pequeno não é aumentado", () => {
    expect(
      ok(
        planVideo({
          width: 3840,
          height: 2160,
          durationSec: 60,
          fps: 60,
          maxBytes: MAX,
        }),
      ).frameRate,
    ).toBe(30);
    const small = ok(
      planVideo({
        width: 320,
        height: 240,
        durationSec: 70,
        fps: 25,
        maxBytes: MAX,
      }),
    );
    expect([small.width, small.height]).toEqual([320, 240]);
    expect(small.videoBitrate).toBe(Math.round(320 * 240 * 25 * 0.09));
  });

  it("vídeo longo: a taxa desce para caber e depois a resolução; sempre abaixo de 50 MB", () => {
    for (const minutes of [1, 2, 3, 5, 8, 10]) {
      const plan = ok(
        planVideo({
          width: 1920,
          height: 1080,
          durationSec: minutes * 60,
          maxBytes: MAX,
        }),
      );
      expect(plan.expectedBytes, `${minutes} min`).toBeLessThan(MAX);
    }
    const three = ok(
      planVideo({ width: 1920, height: 1080, durationSec: 180, maxBytes: MAX }),
    );
    expect(three.width).toBe(1280);
    expect(three.videoBitrate).toBeLessThan(1280 * 720 * 30 * 0.09);
    const five = ok(
      planVideo({ width: 1920, height: 1080, durationSec: 300, maxBytes: MAX }),
    );
    expect(five.width).toBe(960);
    const ten = ok(
      planVideo({ width: 1920, height: 1080, durationSec: 600, maxBytes: MAX }),
    );
    expect(ten.width).toBe(640);
  });

  it("longo demais (12 minutos): diz até quanto cabe", () => {
    const plan = planVideo({
      width: 1920,
      height: 1080,
      durationSec: 720,
      maxBytes: MAX,
    });
    expect(plan.kind).toBe("too_long");
    if (plan.kind === "too_long") {
      expect(plan.maxDurationSec).toBe(
        Math.floor((MAX * 8 * 0.9) / (350_000 + AUDIO_ALLOWANCE)),
      );
      expect(Math.floor(plan.maxDurationSec / 60)).toBe(11);
    }
  });
});

describe("quando reduzir", () => {
  const plan = planVideo({
    width: 1920,
    height: 1080,
    durationSec: 60,
    maxBytes: MAX,
  });

  it("acima de 50 MB: sempre, por qualquer botão", () => {
    for (const photoButton of [true, false])
      expect(
        shouldReduceVideo({
          size: 120_000_000,
          maxBytes: MAX,
          photoButton,
          plan,
        }),
      ).toBe(true);
  });

  it("'Foto ou vídeo': reduz o que pesa bem mais que o reduzido; 'Arquivo' manda como está", () => {
    expect(
      shouldReduceVideo({
        size: 45_000_000,
        maxBytes: MAX,
        photoButton: true,
        plan,
      }),
    ).toBe(true);
    expect(
      shouldReduceVideo({
        size: 45_000_000,
        maxBytes: MAX,
        photoButton: false,
        plan,
      }),
    ).toBe(false);
    // Já leve (perto do tamanho reduzido): vai como está.
    expect(
      shouldReduceVideo({
        size: 21_000_000,
        maxBytes: MAX,
        photoButton: true,
        plan,
      }),
    ).toBe(false);
  });

  it("longo demais e cabendo como está: manda o original", () => {
    const long = planVideo({
      width: 640,
      height: 360,
      durationSec: 900,
      maxBytes: MAX,
    });
    expect(long.kind).toBe("too_long");
    expect(
      shouldReduceVideo({
        size: 40_000_000,
        maxBytes: MAX,
        photoButton: true,
        plan: long,
      }),
    ).toBe(false);
  });
});
