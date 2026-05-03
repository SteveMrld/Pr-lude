# SECTORIAL SOURCES SETUP — EPO Espacenet & Pappers (Niveau 2.B)

Ce document décrit comment activer les sources sectorielles dédiées
aux profils business / industriel / hardware sur Prélude. Ces sources
remplacent OpenAlex / GitHub / Wikipedia pour les fondateurs dont
l'expertise ne se mesure pas via des publications académiques ou
des contributions open source.

---

## Pourquoi

Sur le rapport UP&CHARGE, Guy Flaquière (CTO hardware déclarant 20 ans
d'expertise induction) a été scoré 22/100 par OpenAlex et flaggé
"non-évaluable, red flag critique" parce qu'il n'a aucune publication
académique. C'était une erreur de calibration : un CTO hardware ne
publie pas dans des journaux, il dépose des brevets et gère des
sociétés.

Le commit `979aa70` (calibration profileType) a corrigé l'interprétation
en informant le LLM que ces zéros sont attendus pour ce profil. Le
commit présent (`Niveau 2.B`) va plus loin : il interroge **les vraies
sources** qui valident ou invalident les claims de ce type de profil.

- **EPO Espacenet OPS** : brevets européens. Un inventeur revendiqué
  doit y être trouvable.
- **Pappers** : registre RCS français. Un dirigeant doit y avoir des
  mandats traçables.

Les deux sources sont activées par variables d'env. Si elles ne sont
pas configurées, le pipeline tourne exactement comme avant (les blocs
EPO / Pappers sont simplement absents du résumé envoyé au LLM).

---

## Étape 1 — Inscription EPO Espacenet OPS (gratuit)

EPO (European Patent Office) propose une API REST appelée OPS
(Open Patent Services). Gratuite jusqu'à 4 GB de download par
semaine, plus que suffisant pour interroger les brevets de
quelques fondateurs par dossier.

1. Créer un compte sur **https://developers.epo.org/**

2. Une fois connecté, **My Apps** → **Create new app** :
   - Application name : `prelude-prod`
   - Cocher la case d'usage commercial si Prélude facture des clients
   - Valider

3. Récupérer dans l'app créée :
   - **Consumer Key** (devient `EPO_OAUTH_CLIENT_ID`)
   - **Consumer Secret** (devient `EPO_OAUTH_CLIENT_SECRET`)

4. Ajouter sur Vercel (Settings → Environment Variables, scope
   Production + Preview) :
   ```
   EPO_OAUTH_CLIENT_ID=<consumer key>
   EPO_OAUTH_CLIENT_SECRET=<consumer secret>
   ```

5. Activer la source dans `PRELUDE_ENABLED_SOURCES` :
   ```
   PRELUDE_ENABLED_SOURCES=wikipedia,openalex,github,arxiv,epo,pappers
   ```
   (ou `all` pour tout activer en un coup).

---

## Étape 2 — Inscription Pappers (essai gratuit puis payant)

Pappers est l'API du registre RCS français. Essai gratuit de 50
requêtes, puis abonnements à partir de ~50€/mois pour 1000 req.

1. Créer un compte sur **https://www.pappers.fr/api**

2. **Mon compte** → **API** → **Mes clés API** → générer une clé
   pour Prélude.

3. Ajouter sur Vercel :
   ```
   PAPPERS_API_KEY=<clé pappers>
   ```

4. Vérifier que `pappers` est dans `PRELUDE_ENABLED_SOURCES` (cf.
   étape 1.5).

---

## Étape 3 — Vérification

Une fois les variables d'env déployées, refaire tourner un dossier
avec un profil business / industriel. Le résumé envoyé au LLM
team-engine devrait maintenant contenir des blocs comme :

```
EPO Espacenet (brevets) : 3 brevet(s) trouvé(s) comme inventeur
  - EP3456789A1 (2019-08-12) : Wireless power transfer system for vehicles
    Déposants : SOCIÉTÉ X SAS
    Classes CIB : H02J50/00, H02J7/00
  - ...

Pappers (registre RCS) : 4 mandat(s), dont 2 entreprise(s) actives
  - Président de SOCIÉTÉ X SAS (SAS, 2018) [INSCRIT]
  - Gérant de SOCIÉTÉ Y SARL (SARL, 2014) [RADIÉ]
  - ...

Scores sectoriels : Brevets 65/100, Registre 70/100
```

Et dans le rapport final, les red flags type "fondateur non évaluable
sur OpenAlex" sont remplacés par des affirmations sourcées :
- "3 brevets EPO confirment l'expertise hardware [web : EPO]" (positif)
- "0 brevet retrouvé malgré claim inventeur [web : EPO]" (négatif et
  documenté)

---

## Coûts indicatifs

- **EPO** : gratuit. Quota 4 GB/semaine très large.
- **Pappers** :
  - Essai : 50 req gratuites
  - Plan Découverte : 49€/mois pour 1000 req
  - Plan Entreprise : 199€/mois pour 10000 req

Pour Prélude usage VC (5-50 dossiers/mois × 3-5 fondateurs/dossier =
15-250 req/mois), le plan Découverte suffit largement.

---

## Désactivation

Pour désactiver les sources sectorielles sans toucher au code :
- Soit retirer `epo` et `pappers` de `PRELUDE_ENABLED_SOURCES`
- Soit supprimer les variables d'env `EPO_OAUTH_*` et `PAPPERS_API_KEY`

Dans les deux cas, le pipeline continue de tourner sans crash.
