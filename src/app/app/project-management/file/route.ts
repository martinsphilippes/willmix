import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { canSeeProjectManagement } from "@/lib/project-management";

export const dynamic = "force-dynamic";

/**
 * Anexo de uma atividade do quadro (docs/PROJECT_MANAGEMENT.md): só para os
 * logins da Gestão do projeto e só arquivo que está nos anexos de alguma
 * atividade (a chave sozinha não abre outro arquivo do portal).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canSeeProjectManagement(user))
    return new NextResponse("Not found", { status: 404 });
  const key = new URL(request.url).searchParams.get("k") ?? "";
  const store = getStore();
  const acts = key
    ? await store.list("project_docs", { filter: { collection: "atividades" } })
    : [];
  const known = acts.some((row) =>
    ((row.data?.anexos as Array<{ id?: unknown }> | undefined) ?? []).some(
      (a) => a?.id === key,
    ),
  );
  if (!known) return new NextResponse("Not found", { status: 404 });
  const file = await store.streamFile(key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
