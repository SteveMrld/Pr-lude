# Fix cron cleanup-stale-running : 401 silencieux et absence d instrumentation

Rapport de diagnostic et de correction pour la panne du cron
`/api/cron/cleanup-stale-running` en production, decouverte a
l occasion du run bloque `bfbd392f-c834-4626-9bc1-012e4cba30ce`.

## Preuve empirique de la panne

Deux lignes coincees en `status='running'` sans jamais avoir
bascule en `failed`, alors que le cron `*/15 * * * *` aurait du
les rattraper :

  - `bfbd392f-c834-4626-9bc1-012e4cba30ce` : created 2026-07-08
    05:44:43 UTC, 15 min plus tard toujours `running`, avant meme
    le seuil de 30 min donc non concernee par le sweep. Cas moins
    parlant, gardee comme signal complementaire.
  - `0c2a5e9c-0ac3-40a2-98dd-6daad44d855b` : created 2026-07-07
    19:00:27 UTC, updated_at fige a 19:04:33 (pipeline mort au
    milieu du bloc parallele team/macro/market/pattern/causal).
    Douze heures plus tard, statut toujours `running`, error_message
    null. Le cron aurait du l attraper des la fenetre 19:35, puis
    a chaque quart d heure suivant. Au moins 45 executions ratees
    d affilee.

La table `error_logs` ne contient **aucune entree** pour le source
`cron.cleanup-stale-running`, ni pour aucun des cinq autres crons
declares dans `vercel.json`. Derniere entree reelle du logger :
2026-06-08. Un mois de silence complet cote observabilite serveur
alors que la production continue de faire tourner du trafic.

## Analyse de la cause racine

Le handler d origine (`app/api/cron/cleanup-stale-running/route.ts`)
verifiait l autorisation via un `CRON_SECRET` strict :

  ```
  function isAuthorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return process.env.NODE_ENV !== 'production'; // false en prod
    const auth = req.headers.get('authorization');
    return auth === `Bearer ${secret}`;
  }
  ```

Deux modes d echec silencieux :

  1. **CRON_SECRET absent des env vars Vercel en production.** Sans
     `CRON_SECRET` cote serveur, `isAuthorized` retourne false, on
     repond 401, on n execute jamais `markStaleRunningAsFailed`. Le
     `console.warn` interne ne se declenche que sur `swept > 0`, on
     n a donc aucun signal Vercel logs non plus. La seule maniere
     de detecter le probleme est de constater a posteriori que les
     lignes `running` s accumulent, ce qui s est produit ici.

  2. **CRON_SECRET desynchronise entre Vercel et l endpoint.** Meme
     issue : 401, aucun log persiste, aucun signal exploitable.

Les cinq autres crons (`milestone-detection`, `trajectory-*`,
`sectoral-*`) partagent le meme pattern d `isAuthorized`. Ils sont
donc affectes par le meme mode de defaillance, meme si l impact
metier est moins critique parce qu ils touchent des donnees moins
sensibles a l accumulation.

Le mode de defaillance est structurel : un handler cron ne doit
jamais dependre uniquement d un secret d environnement qui, s il
est mal configure, produit un 401 muet. Il faut soit une voie de
secours d authentification, soit une trace durable de chaque
invocation, ideallement les deux.

## Correction apportee

Le handler est refactor en trois axes :

  1. **Auth duale.** Priorite au `CRON_SECRET` s il est defini (voie
     securisee), fallback sur le user-agent `vercel-cron/*` (que
     Vercel signe systematiquement sur ses appels cron). Ce fallback
     assure que le balayage tourne meme si l operateur a oublie de
     configurer `CRON_SECRET` cote Vercel, sans ouvrir une surface
     d attaque significative : l action est deja idempotente et ne
     fait que basculer en `failed` des lignes deja en echec, un
     attaquant spoofant le user-agent ne pourrait que declencher le
     balayage prevu, il ne peut ni lire, ni supprimer, ni exposer
     aucune donnee.

  2. **Log de chaque invocation dans `error_logs`.** Severity `info`
     pour un passage autorise, `error` pour un 401. Contient le
     user-agent, la presence ou non du `CRON_SECRET` cote serveur,
     la presence ou non du header `Authorization` cote appelant, et
     la raison lisible du verdict d autorisation. Cette entree est
     le heartbeat qui permettra desormais de voir en un coup d oeil
     dans Supabase si Vercel appelle bien le cron toutes les quinze
     minutes.

  3. **Log de chaque passage systematique, y compris a vide.** Une
     seconde entree `info` (ou `warning` si swept > 0) trace le
     resultat de `markStaleRunningAsFailed` avec le seuil applique,
     le nombre de lignes basculees et leurs IDs. Sans cette trace,
     on ne pouvait pas differencier "aucune ligne stale" de "handler
     qui plante avant le sweep".

Le fichier modifie est `app/api/cron/cleanup-stale-running/route.ts`.
Les cinq autres crons ne sont pas touches par ce commit, mais le
meme diagnostic les concerne et le meme patron de fix pourra leur
etre applique dans un commit suivant.

## Verification post-deploy

Une fois le fix pousse et deploye, la verification se fait
directement dans `error_logs` :

  ```sql
  select occurred_at, severity, message, context
  from error_logs
  where source = 'cron.cleanup-stale-running'
  order by occurred_at desc
  limit 30;
  ```

On doit voir une nouvelle entree toutes les quinze minutes.
Le premier passage confirmera aussi le contenu du champ `context`
et donc l etat de la configuration `CRON_SECRET` cote Vercel.

Si la ligne `0c2a5e9c-0ac3-40a2-98dd-6daad44d855b` reste en
`running` apres le premier passage post-deploy, c est que le cron
n est pas invoque du tout par Vercel (cause hors code, a chercher
cote dashboard Vercel : cron desactive, plan degrade, deployment
protection qui bloque les crons). Sinon elle basculera en `failed`
avec le message standard `markStaleRunningAsFailed`.

Le run `bfbd392f-c834-4626-9bc1-012e4cba30ce` sera lui rattrape
au passage qui suit son 30eme minute (attendu vers 06:15 UTC), et
son diagnostic definitif attendra la stack Vercel des logs bruts
de l invocation pipeline correspondante.
