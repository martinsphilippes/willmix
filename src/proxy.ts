import { NextResponse, type NextRequest } from "next/server";

/** Mesmo nome usado em src/lib/appwrite/server.ts (sessionCookieName). */
const SESSION_COOKIE = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "willmix"}`;

/**
 * Checagem otimista: rotas em /app exigem cookie de sessão.
 * A validação real da sessão acontece no servidor (getCurrentUser).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
