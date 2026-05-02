// Middleware Next.js : controle l acces aux routes selon le feature flag
// ENABLE_AUTH et l etat de la session.
//
// Si ENABLE_AUTH != 'true' : laisse tout passer (mode dev/legacy).
//
// Si ENABLE_AUTH = 'true' :
//   - Routes publiques (/, /login, /auth/*, /demo, statiques) : passent
//   - Toute autre route exige une session ; sinon redirect /login
//   - Si user authentifie mais pas d org : redirect /onboarding
//
// Note : le middleware tourne sur l Edge runtime, on utilise donc
// @supabase/ssr avec cookies request/response (pas l API cookies()
// disponible en RSC).

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/demo', // future page demo PEN Group en lecture seule
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  // Ressources Next/static, favicons, etc.
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return true;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const authEnabled = process.env.ENABLE_AUTH === 'true';
  if (!authEnabled) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // La landing reste publique pour pouvoir presenter Prelude sans login.
  // Mais on doit quand meme creer la session si elle existe (pour
  // afficher le nom du fonds dans le header par exemple).
  // Donc on ne short-circuite pas, on laisse tomber dans la suite.

  let response = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Si pas configure, on laisse passer pour ne pas bloquer le site.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return req.cookies.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) {
        req.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: req.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        req.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: req.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Routes publiques : laisser passer telles quelles.
  if (isPublicPath(pathname)) {
    // Sauf si on est deja connecte sur /login : rediriger vers la home.
    if (pathname === '/login' && user) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return response;
  }

  // A partir d ici : routes protegees.
  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // L user est connecte. On laisse passer ; la verification d organisation
  // et la redirection /onboarding se font cote Server Component (page.tsx)
  // car elles necessitent un acces service-role qu on ne peut pas avoir
  // proprement sur l Edge runtime sans exposer la key.
  return response;
}

export const config = {
  matcher: [
    // Match toutes les routes sauf assets explicites
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ],
};
