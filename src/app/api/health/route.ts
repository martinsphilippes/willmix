import { NextResponse } from "next/server";
import { isFirebaseClientConfigured } from "@/lib/env";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/** Diagnóstico do ambiente. Nunca expõe valores de segredos, só presença. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "willmix",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    firebase: {
      client: isFirebaseClientConfigured,
      admin: isFirebaseAdminConfigured,
    },
    timestamp: new Date().toISOString(),
  });
}
