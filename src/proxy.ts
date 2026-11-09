import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtrage rapide avant rendu : sans session valide, /admin et /portal renvoient
 * vers /login. Les droits fins (rôle, permission, entreprise) sont vérifiés
 * côté serveur dans chaque page et action (src/lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("nextia_session")?.value;
  let role: string | null = null;

  if (token && process.env.AUTH_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET), {
        algorithms: ["HS256"],
      });
      role = typeof payload.role === "string" ? payload.role : null;
    } catch {
      role = null;
    }
  }

  const { pathname } = request.nextUrl;

  if (!role) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Un client ne voit jamais le back-office, l'équipe n'a pas de portail client.
  if (pathname.startsWith("/admin") && role === "CLIENT") {
    return NextResponse.redirect(new URL("/portal", request.url));
  }
  if (pathname.startsWith("/portal") && role !== "CLIENT") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
