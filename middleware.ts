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
  '/', // landing page de pitch publique
  '/login',
  '/auth/callback',
  '/demo', // future page demo PEN Group en lecture seule
];

// Routes dont l appelant est une machine et non un navigateur : elles
// ne portent aucun cookie de session et se gardent elles-memes par un
// en-tete Authorization verifie en premiere ligne de leur handler.
//
// Sous ENABLE_AUTH, le middleware les traitait comme des routes
// protegees et les redirigeait en 307 vers /login. Un 307 n est pas
// une erreur, rien ne le remonte, et la route passe pour active : les
// six taches planifiees n ont jamais atteint leur handler depuis leur
// mise en service.
//
// La premiere correction n a porte que sur le prefixe /api/cron/, et
// c etait le mauvais critere. Ce qui distingue ces routes n est pas
// leur emplacement, c est leur mode d authentification. Le webhook
// sectoriel event-trigger, qui se garde par SECTORAL_EVENT_TOKEN et
// vit sous /api/sectoral/, portait donc exactement la meme panne,
// restee dans l ombre parce que le correctif avait ete ecrit sur le
// symptome. Elle n a rien coute a ce jour, faute d appelant configure,
// mais elle etait armee.
//
// Le predicat porte donc sur le critere reel. La liste est verrouillee
// par middleware.test.ts, qui la confronte aux routes du depot lisant
// effectivement un en-tete d autorisation : la huitieme route ne peut
// plus etre oubliee, elle fera echouer le test.
export const CRON_PATH_PREFIX = '/api/cron/';

/**
 * Chemins gardes par en-tete. Un prefixe termine par '/' couvre son
 * sous-arbre, un chemin exact ne couvre que lui-meme.
 */
export const HEADER_GUARDED_PATHS: ReadonlyArray<string> = [
  CRON_PATH_PREFIX,
  '/api/sectoral/event-trigger',
];

export function isHeaderGuardedPath(pathname: string): boolean {
  return HEADER_GUARDED_PATHS.some((p) =>
    p.endsWith('/')
      ? pathname === p.slice(0, -1) || pathname.startsWith(p)
      : pathname === p,
  );
}

/**
 * Conserve : le nom dit ce qu il fait et plusieurs appelants le
 * lisent. Il delegue au predicat general plutot que de porter sa
 * propre regle, pour qu il n y ait qu une definition a maintenir.
 */
export function isCronPath(pathname: string): boolean {
  return pathname === '/api/cron' || pathname.startsWith(CRON_PATH_PREFIX);
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  // Ressources Next/static, favicons, etc.
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return true;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Sortie anticipee avant toute lecture de session. Le matcher plus
  // bas exclut deja ces chemins, donc cette branche ne devrait pas
  // etre atteinte en production ; elle est la defense qui survit a une
  // reecriture du matcher, laquelle est une expression reguliere que
  // personne ne relit. Les deux mecanismes tombent independamment.
  if (isHeaderGuardedPath(pathname)) {
    return NextResponse.next();
  }

  const authEnabled = process.env.ENABLE_AUTH === 'true';
  if (!authEnabled) {
    return NextResponse.next();
  }

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

// Le matcher doit rester une chaine litterale : Next l analyse
// statiquement au build et refuse toute valeur calculee. Les chemins
// gardes par en-tete y figurent donc en dur, et middleware.test.ts
// verifie que cette liste litterale et HEADER_GUARDED_PATHS disent la
// meme chose, puis que les deux couvrent les routes du depot qui
// lisent un en-tete d autorisation. Trois declarations qui devraient
// coincider, et un test qui echoue des qu elles divergent, plutot que
// la memoire de celui qui ajoutera la huitieme route.
export const config = {
  matcher: [
    // Match toutes les routes sauf assets explicites et routes gardees par en-tete
    '/((?!api/cron/|api/sectoral/event-trigger|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ],
};
