# AUTH SETUP — Activation de l'authentification multi-tenant

Ce document décrit les étapes manuelles pour activer l'auth Supabase sur Prélude.
Le code est déjà déployé. Tant que `ENABLE_AUTH` n'est pas défini à `true` sur Vercel,
l'app continue de fonctionner exactement comme avant (accès public, pas d'auth).

---

## Étape 1 — Migration SQL

Dans le dashboard Supabase du projet Prélude, ouvrir le **SQL Editor** et exécuter
le contenu du fichier `supabase-auth-schema.sql` (à la racine du repo).

Ce script crée :
- `organizations` : table des fonds clients
- `organization_members` : liaison users ↔ orgs avec rôle (admin / member)
- `prelude_super_admins` : table des admins Prélude (toi)
- Ajoute la colonne `organization_id` sur `prelude_jobs`
- Active RLS et pose les bonnes policies

Le script est idempotent : peut être rejoué sans casse.

---

## Étape 2 — Configuration Supabase Auth

Dans le dashboard Supabase :

1. **Authentication → Providers → Email** : vérifier que **Email** est activé.
   Désactiver "Confirm email" pour les magic links (sinon double étape inutile).

2. **Authentication → URL Configuration** :
   - **Site URL** : `https://pr-lude.vercel.app`
   - **Redirect URLs** (whitelist) : ajouter `https://pr-lude.vercel.app/auth/callback`
     et `http://localhost:3000/auth/callback` (pour le dev local)

3. **Authentication → Email Templates → Magic Link** : optionnel, personnaliser
   le mail avec la marque Prélude (de "Sign in" à "Connexion à Prélude").

---

## Étape 3 — Variables d'environnement Vercel

Sur le projet Vercel `pr-lude`, dans **Settings → Environment Variables**, ajouter :

```
NEXT_PUBLIC_SUPABASE_URL = <URL du projet Supabase, déjà connue>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <clé anon publique>
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` doivent déjà exister (utilisées
par le job-store actuel). Sinon les ajouter aussi.

Pour récupérer les clés : dans Supabase, aller sur
`https://supabase.com/dashboard/project/<PROJECT_ID>/settings/api-keys`.

**Ne pas encore activer `ENABLE_AUTH`.** On va d'abord créer ton compte super-admin.

---

## Étape 4 — Premier déploiement et création du compte super-admin

1. Push le commit (déjà fait par Claude). Vercel redéploie.
2. Aller sur `https://pr-lude.vercel.app/login`. Saisir ton email pro.
3. Tu reçois un magic link. Cliquer dessus.
4. Tu atterris sur `/onboarding`. Saisir le nom de ton organisation
   (ex : "Prélude — Operations" ou "Steve Moradel Conseil").
5. Une fois redirigé sur `/`, tu es connecté avec ton org.

**Bootstrap super-admin** (à faire UNE fois) :

Dans Supabase → SQL Editor :

```sql
-- Récupère ton user_id depuis Authentication → Users (copie l UUID)
insert into public.prelude_super_admins (user_id, notes)
values ('<TON-UUID-ICI>', 'Steve - Founder');
```

---

## Étape 5 — Activation du flag auth

Maintenant que ton compte existe, activer le flag :

Sur Vercel, **Settings → Environment Variables** :
```
ENABLE_AUTH = true
```

Redéployer. À partir de maintenant, toutes les routes hors `/login`,
`/auth/*` et `/demo` (à venir) exigent une session valide.

---

## Inviter un fonds client

Pour l'instant (commit 2a), il n'y a pas d'UI d'invitation. Pour inviter
un fonds en beta privée :

1. Demander à l'utilisateur de se connecter sur `/login` avec son email pro.
   Il atterrira sur `/onboarding` et créera son organisation lui-même.
2. C'est tout. Chaque fonds est isolé du tien grâce aux RLS policies.

L'UI d'invitation par email arrivera dans un commit ultérieur (priorité
moyenne, surtout utile quand plusieurs personnes d'un même fonds doivent
partager une org).

---

## Désactivation d'urgence

En cas de problème, repasser `ENABLE_AUTH = false` (ou supprimer la var)
sur Vercel et redéployer. L'app revient instantanément en mode public sans
auth, sans perte de données.

---

## Checklist pour valider que tout marche

- [ ] Sans `ENABLE_AUTH` : `/` rend l'app comme avant, accessible publiquement
- [ ] Avec `ENABLE_AUTH=true`, déconnecté : `/` redirige vers `/login`
- [ ] Magic link reçu, lien cliqué : redirection vers `/onboarding`
- [ ] Org créée : redirection vers `/` avec nom de l org en haut à droite
- [ ] Bouton "Déconnexion" visible et fonctionnel
- [ ] Reconnexion : on revient sur `/` directement, pas re-onboarding
