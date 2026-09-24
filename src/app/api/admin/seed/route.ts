import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * Cria os dados de demonstração (usuários, parceiros, linhas, produtos).
 * Em produção exige `Authorization: Bearer <CRON_SECRET>`. Idempotente.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await seedDemo();
  return NextResponse.json({
    created: result.created,
    users: result.users.length,
  });
}
