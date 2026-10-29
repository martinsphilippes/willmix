import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { canViewOrder } from "@/lib/auth/permissions";
import { artworkDocuments } from "@/lib/services/artwork";
import { audit } from "@/lib/services/audit";
import { safeZipNames, zipStream } from "@/lib/zip-stream";

export const dynamic = "force-dynamic";

/** Baixar todas as artes do pedido (zip): só o que o usuário pode abrir. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/orders/[id]/artwork">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const store = getStore();
  const order = await store.get("orders", id);
  if (!order || !canViewOrder(user, order))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const docs = await artworkDocuments(user, order);
  if (!docs.length)
    return NextResponse.json({ error: "empty" }, { status: 404 });
  await audit(
    user,
    "artwork.download_all",
    "order",
    order.id,
    `Baixou ${docs.length} arquivo(s) de arte`,
  );
  const names = safeZipNames(
    docs.map((d) => `${d.type}-v${d.version}-${d.name}`),
  );
  const body = zipStream(
    docs.map((doc, i) => ({
      name: names[i],
      open: async () => (await store.streamFile(doc.storageKey))?.body ?? null,
    })),
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="artes-pedido-${order.number}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
