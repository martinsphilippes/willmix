import { NextResponse } from "next/server";
import {
  dataMode,
  isAppwriteClientConfigured,
  isAppwriteServerConfigured,
} from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { aiStatus } from "@/lib/integrations/ai";
import { serviceErrorCode } from "@/lib/auth/login-errors";

export const dynamic = "force-dynamic";

/** Diagnóstico do ambiente. Nunca expõe valores de segredos, só presença. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "wellmix",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    dataMode: dataMode(),
    appwrite: {
      client: isAppwriteClientConfigured,
      server: isAppwriteServerConfigured(),
    },
    // Banco respondendo? "appwrite_paused" = projeto pausado no console do Appwrite.
    database: await getSettings()
      .then(() => "ok")
      .catch((error: unknown) => serviceErrorCode(error)),
    // Só modo, provedor e modelo da IA; nunca a credencial.
    ai: await getSettings()
      .then(aiStatus)
      .catch(() => null),
    timestamp: new Date().toISOString(),
  });
}
