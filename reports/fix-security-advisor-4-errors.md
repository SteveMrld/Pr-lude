# Fix Security Advisor Supabase, quatre erreurs ROUGE

Date : 2026-06-17

## Resume

Quatre erreurs ROUGE remontees par le Security Advisor de la prod
Prelude, corrigees par une migration unique sans regression
fonctionnelle. Les seize warnings et la suggestion ne sont pas
traites dans cette passe ; ils feront l objet d un durcissement
separe.

## Erreurs adressees

1. `public.prelude_jobs` : RLS Disabled in Public.
2. `public.analyses_stats` : Security Definer View.
3. `public.sectoral_briefs_latest` : Security Definer View.
4. `public.inter_sectoral_briefs_latest` : Security Definer View.

Note : l enonce mentionnait `inter_sectoral_briefs` (table). Cette
table porte deja RLS active avec une policy `using(false)`. La vue
flagged est `inter_sectoral_briefs_latest`, c est elle qui passe en
security_invoker dans la migration.

## Diagnostic des acces reels

### prelude_jobs

Le job-store legacy (`lib/job-store.ts`) a ete supprime au commit
38845b6 dans le cadre du refactor "suppression du pipeline-runner
legacy et de la route /api/jobs jamais consommee". Aucun call site
runtime ne lit ni n ecrit cette table aujourd hui : la grep sur
`lib/`, `app/` et `scripts/` ne retourne aucune occurrence en
dehors des fichiers SQL d historique.

La table porte des lignes historiques. La voie d acces est
exclusivement administrative (service role) pour inspection
manuelle. Decision : ENABLE RLS sans policy. Le service role
bypasse RLS, donc rien ne casse cote serveur ; l API
anon/authenticated cesse de pouvoir lister les jobs historiques
via PostgREST.

A noter : la table de rate-limit utilisee par le pipeline analyze
est `active_jobs`, distincte. Cette migration ne la touche pas.

### analyses_stats

Vue qui agrege par `user_id` les compteurs verdict et les moyennes
de score. Consommee uniquement par `getAnalysesStats()` dans
`lib/analysis-store.ts:1129` :

- Mode solo (ENABLE_AUTH=false) : `useAdminClient=true`, service
  role qui bypasse RLS.
- Mode multi-user (ENABLE_AUTH=true) : `useAdminClient=false`,
  client server avec session JWT. La requete filtre deja par
  `.eq('user_id', userId)`.

La table sous-jacente `public.analyses` a deja RLS active et une
policy SELECT `auth.uid() = user_id`. Le passage de la vue en
security_invoker propage la session JWT au moment du select sur
analyses, ce qui aligne strictement le filtrage de la vue sur le
filtrage existant de la table. Aucun changement fonctionnel
attendu.

### sectoral_briefs_latest, inter_sectoral_briefs_latest

Vues consommees uniquement via service role :
- `lib/engines/sectoral-intelligence/inter-sector-store.ts:65`
- `app/api/admin/sectoral/route.ts:69`

Les tables sous-jacentes `sectoral_briefs` et
`inter_sectoral_briefs` ont deja RLS active avec une policy
`using(false)` (acces client integralement bloque). Le passage des
vues en security_invoker ne change rien aux acces serveur (service
role bypasse) et conserve le blocage cote client.

## Migration appliquee

Fichier `supabase-security-advisor-fixes.sql`, applique en prod via
`scripts/apply-migration.ts` (Management API, bypass clipboard et
SQL Editor) :

```
Projet  : pmcocfzpxugsftmaigil
Fichier : supabase-security-advisor-fixes.sql
Taille  : 4094 octets
Reponse HTTP : 201
Reload PostgREST HTTP : 201
```

Operations :

```sql
ALTER TABLE public.prelude_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prelude_jobs_anon_read" ON public.prelude_jobs;
DROP POLICY IF EXISTS "prelude_jobs_authenticated_read" ON public.prelude_jobs;
DROP POLICY IF EXISTS "prelude_jobs_authenticated_all" ON public.prelude_jobs;

ALTER VIEW public.analyses_stats SET (security_invoker = true);
ALTER VIEW public.sectoral_briefs_latest SET (security_invoker = true);
ALTER VIEW public.inter_sectoral_briefs_latest SET (security_invoker = true);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectoral_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_sectoral_briefs ENABLE ROW LEVEL SECURITY;
```

## Verification post-migration

Script `scripts/verify-security-advisor.ts` :

| Objet | Etat |
|---|---|
| `prelude_jobs.rowsecurity` | `true` |
| `analyses.rowsecurity` | `true` |
| `sectoral_briefs.rowsecurity` | `true` |
| `inter_sectoral_briefs.rowsecurity` | `true` |
| `analyses_stats.reloptions` | `[security_invoker=true]` |
| `sectoral_briefs_latest.reloptions` | `[security_invoker=true]` |
| `inter_sectoral_briefs_latest.reloptions` | `[security_invoker=true]` |
| policies sur `prelude_jobs` | aucune (service role bypasse) |

Les quatre erreurs sont structurellement reglees au niveau du
schema. Cliquer "Rerun" sur le Security Advisor dans le dashboard
les fera disparaitre du listing. Le linter Supabase n est pas
expose par la Management API publique, la verification est faite
par SQL direct sur `pg_tables` et `pg_class.reloptions`.

## Non-regression

- `tsc --noEmit` : propre.
- `lib/rate-limit.ts` : utilise `active_jobs`, table distincte de
  `prelude_jobs`. Pipeline analyze inchange.
- Aucun call site runtime sur `prelude_jobs` apres grep
  exhaustive.
- `getAnalysesStats()` en mode multi-user : la jointure vue
  security_invoker + RLS sur `analyses` reproduit exactement le
  filtrage `user_id = auth.uid()` deja en place applicativement.
- Vues sectorielles : consommees en service role uniquement,
  passage transparent.

## Hors scope

- Les 16 warnings du Security Advisor (typiquement function search
  path mutables, secrets exposes en config, password protection).
- La suggestion (typiquement upgrades de version).

Passe de durcissement separee.
