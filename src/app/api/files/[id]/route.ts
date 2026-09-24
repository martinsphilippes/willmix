import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { canAccessDocument } from "@/lib/services/documents";

export const dynamic = "force-dynamic";

/** Download controlado: exige sessão e permissão sobre o documento. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/files/[id]">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const store = getStore();
  const doc = await store.get("documents", id);
  if (!doc || !(await canAccessDocument(user, doc))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const file = await store.getFile(doc.storageKey);
  if (!file) return NextResponse.json({ error: "missing" }, { status: 404 });
  const inline =
    doc.mime.startsWith("image/") || doc.mime === "application/pdf";
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
