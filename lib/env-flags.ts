// ============================================================
// Audit des feature flags critiques au demarrage serveur
// ------------------------------------------------------------
// Le probleme structurel que ce module resout : les flags
// ENABLE_PERSISTENCE, ENABLE_AUTH et ENABLE_WEB_SEARCH ont un
// fallback silencieux quand ils ne sont pas positionnes. Sur
// une preproduction mal provisionnee, cela produit un mode
// degrade invisible :
//
//   - ENABLE_PERSISTENCE undefined : aucune analyse n est
//     sauvegardee, les fonctions de save retournent null sans
//     warning. L utilisateur voit une UI qui semble marcher
//     mais l Historique reste vide indefiniment.
//
//   - ENABLE_AUTH undefined : le mode solo (UUID fixe) est
//     active, RLS effectivement contournee via service_role.
//     En preproduction montree a un fond client, tout le
//     monde partage le meme compte sans le savoir.
//
//   - ENABLE_WEB_SEARCH undefined : la doctrine documentee
//     attend l inverse mais le comportement subtil de
//     team-engine peut laisser le web search actif, ce qui
//     brise la reproductibilite du mode gele.
//
// La correction structurelle : logger prominament au boot
// serveur toute occurrence d un flag undefined en production,
// et logger une fois par instance runtime chaque fois qu une
// fonction critique entre en mode degrade.
//
// Note : on ne throw jamais. Le produit doit rester up meme
// mal configure, mais l ops doit voir immediatement dans les
// logs Vercel qu il y a un probleme.
// ============================================================

type CriticalFlagName = 'ENABLE_PERSISTENCE' | 'ENABLE_AUTH' | 'ENABLE_WEB_SEARCH';

interface FlagContract {
  name: CriticalFlagName;
  expected: 'true' | 'false';
  degradedBehavior: string;
}

const CRITICAL_FLAGS: FlagContract[] = [
  {
    name: 'ENABLE_PERSISTENCE',
    expected: 'true',
    degradedBehavior:
      'aucune analyse ne sera sauvegardee dans Supabase, l Historique restera vide',
  },
  {
    name: 'ENABLE_AUTH',
    expected: 'true',
    degradedBehavior:
      'mode solo actif (UUID fixe partage), RLS contournee via service_role, ' +
      'tout appel est attribue au meme user',
  },
  {
    name: 'ENABLE_WEB_SEARCH',
    expected: 'false',
    degradedBehavior:
      'le web search peut rester actif dans certains moteurs et casser ' +
      'la reproductibilite du mode gele (corpus / replay)',
  },
];

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readFlag(name: CriticalFlagName): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  return raw;
}

// Deja-vu par flag pour ne pas spammer les logs a chaque appel
// d une fonction guardee. Un warn par flag par instance runtime.
const warnedFlags = new Set<CriticalFlagName>();

/**
 * A appeler dans le corps des fonctions qui basculent en mode
 * degrade a cause d un flag manquant. Log une fois par instance
 * runtime pour eviter le spam mais garantir la visibilite.
 */
export function warnOnFlagFallback(name: CriticalFlagName): void {
  if (!isProduction()) return;
  if (warnedFlags.has(name)) return;
  warnedFlags.add(name);
  const contract = CRITICAL_FLAGS.find((f) => f.name === name);
  const detail = contract ? contract.degradedBehavior : 'comportement degrade';
  const actual = readFlag(name);
  console.error(
    `[env-flags] MODE DEGRADE en PRODUCTION : ${name}=${actual === undefined ? 'undefined' : `"${actual}"`} ` +
      `(attendu "${contract?.expected}"). Consequence : ${detail}. ` +
      'Positionner le flag explicitement sur Vercel avant tout usage commercial.',
  );
}

/**
 * Audit exhaustif joue une fois au demarrage du serveur, sur
 * import de ce module. Log un warning ou une error par flag
 * critique mal positionne. Volontairement bruyant en production
 * parce que c est exactement le type de config que l ops doit
 * voir en tete de logs.
 */
function runStartupFlagAudit(): void {
  if (!isProduction()) return;

  const issues: string[] = [];
  for (const contract of CRITICAL_FLAGS) {
    const actual = readFlag(contract.name);
    if (actual === undefined) {
      issues.push(
        `  - ${contract.name} : undefined (attendu "${contract.expected}"). ${contract.degradedBehavior}.`,
      );
      continue;
    }
    if (actual !== contract.expected) {
      // ENABLE_WEB_SEARCH attend 'false' donc undefined = OK cote doctrine
      // mais un 'true' explicite en prod merite quand meme un warn.
      if (contract.name === 'ENABLE_WEB_SEARCH' && actual === 'true') {
        issues.push(
          `  - ${contract.name}="true" : web search actif en production, ` +
            'brise la reproductibilite du mode gele si corpus utilise.',
        );
      }
    }
  }

  if (issues.length > 0) {
    console.error(
      '\n============================================================\n' +
        '[env-flags] AUDIT DES FLAGS AU BOOT SERVEUR : configuration incomplete\n' +
        '------------------------------------------------------------\n' +
        issues.join('\n') +
        '\n------------------------------------------------------------\n' +
        'Configurer ces variables sur Vercel avant demonstration commerciale.\n' +
        '============================================================\n',
    );
  }
}

// Execution unique a l import du module (equivalent d un boot serveur
// puisque Next.js instancie une seule fois le module server-side).
runStartupFlagAudit();
