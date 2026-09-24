import { NextResponse } from "next/server";
import {
  dataMode,
  isAppwriteClientConfigured,
  isAppwriteServerConfigured,
} from "@/lib/env";

export const dynamic = "force-dynamic";

/** Diagnóstico do ambiente. Nunca expõe valores de segredos, só presença. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "willmix",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    dataMode: dataMode(),
    appwrite: {
      client: isAppwriteClientConfigured,
      server: isAppwriteServerConfigured(),
    },
    timestamp: new Date().toISOString(),
  });
}
