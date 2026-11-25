import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canSeeProjectManagement,
  PROJECT_MANAGEMENT_PATH,
} from "@/lib/project-management";
import { PLATAFORMA_HTML } from "@/lib/project-management/plataforma-html";
import { withPortalBridge } from "@/lib/project-management/shim";

export const dynamic = "force-dynamic";

/**
 * A Plataforma Wellmix v2 que o iframe da Gestão do projeto abre
 * (docs/PROJECT_MANAGEMENT.md). Só para os logins da lista; os outros veem
 * "não encontrado", como se a página não existisse.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!canSeeProjectManagement(user))
    return new NextResponse("Not found", { status: 404 });
  return new NextResponse(
    withPortalBridge(PLATAFORMA_HTML, `${PROJECT_MANAGEMENT_PATH}/file`),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-cache",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
