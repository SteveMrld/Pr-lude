# Fix double entrée d'analyse, bouton "Lancer l'instruction" du Bloc 1

## Cartographie des deux entrées

| Entrée | Fichier | Lignes | Type | Handler | Endpoint |
|---|---|---|---|---|---|
| "Déposer un dossier d'investissement" | `app/HomeClient.tsx` | 2469-2482 | drop-zone upload, déclenche le picker `<input type="file">` | `handleFilesSelect` → `analyze()` (ligne 1015) | `POST /api/analyze` |
| "Lancer le pipeline →" | `app/HomeClient.tsx` | 2572 | bouton submit | `analyze()` (ligne 1015) | `POST /api/analyze` |
| "Lancer une instruction" (CTA hero principal) | `app/HomeClient.tsx` | 1933-1936 | `<a href="#commencer">` | aucun, scroll vers l'upload box | aucun |
| **"Lancer →" carte Bloc 1 "Note d'instruction"** | `app/HomeClient.tsx` | 1910-1919 | `<a href="#commencer">` | aucun, scroll vers l'upload box | aucun |
| "Lancer →" carte Bloc 2 "Data Room" | `app/HomeClient.tsx` | 1920-1929 | `<a href="#commencer">` | aucun, scroll vers l'upload box | aucun |
| "Lancer l'analyse complète malgré tout" | `app/HomeClient.tsx` | 2425-2430 | bouton override prescan knockout | `analyze({ forcePrescan: true })` | `POST /api/analyze` |

Toutes les CTAs labellées "Lancer" sont concentrées dans `HomeClient.tsx`. Le composant `InvestmentNoteView.tsx` n'expose aucun bouton "Lancer l'instruction", seulement "Passer en DD approfondie" (ligne 3397) qui appelle `analyzeDDDeepen()` côté HomeClient et persiste sur `POST /api/analyses/[id]/dd-deepen`.

Les trois CTAs "Lancer" du hero (lignes 1910, 1920, 1933) sont **strictement des ancres `<a href="#commencer">`**. Aucune logique d'analyse rattachée. Elles scrollent vers la section `#commencer` qui héberge la zone d'upload (ligne 2391).

## Reproduction de l'erreur

L'environnement local ne contient ni `ENABLE_AUTH` ni `ENABLE_PERSISTENCE` (cf `.env.local`), donc impossible d'authentifier ni de charger Pen Group / Hello Planet / Platypus localement. Le diagnostic procède par lecture du flux de rendu de `HomeClient`.

### Flux de rendu sur `/dossiers/[id]`

`app/dossiers/[id]/page.tsx` monte `<HomeClient initialAnalysisId={params.id} />`. Côté client :

1. `useEffect` ligne 677 déclenche `fetch('/api/analyses/[id]')`
2. Pendant le fetch : `loadingPastAnalysis=true`, `result=null`, `analyzing=false`
3. Le bloc de rendu home landing (ligne 1882) `{!result && !analyzing && (` est **vrai** pendant tout le chargement, et reste vrai si le dossier n'a pas de `resultJson` ou si le fetch échoue
4. Conséquence : le hero apparaît avec ses trois CTAs "Lancer →" / "Lancer une instruction" pendant le chargement et après un échec

### Le bouton incriminé

Le partner sur `/dossiers/[id]` voit la carte "Bloc 1 · Note d'instruction · Lancer →" (lignes 1910-1919) et la lit comme un bouton "Lancer l'instruction" relatif au dossier courant. Le clic scrolle vers `#commencer`. Le partner glisse alors un fichier dans la zone d'upload. `handleFilesSelect` puis `analyze()` se déclenchent.

Le message d'erreur dépend du contexte :

- Si l'analyse d'origine est encore `running` côté backend (shell pending), `POST /api/analyze` répond `429` "Limite de pipelines simultanés atteinte" (ligne 1175-1179 de HomeClient, ligne 298 de la route)
- Si le hash du PDF re-glissé correspond à un run récent, le garde-fou ligne 1052 affiche `window.confirm("Ce dossier a déjà été analysé il y a...")` qui peut être perçu comme une erreur
- Si l'upload est annulé, `if (files.length === 0) return` (ligne 1016) silencieusement, mais le partner reste avec le message banner "Analyse introuvable ou non accessible." déjà affiché ligne 767 si le fetch initial avait échoué
- Si l'upload réussit, le pipeline démarre **avec un nouvel `analysis_id`** différent de l'URL, ce qui produit un effet de duplication dans l'historique et invalide la cohérence de la route courante

## Diagnostic

**Cas A : doublon pur.** Les CTAs "Lancer →" du hero (cartes Bloc 1, Bloc 2, et le CTA principal "Lancer une instruction") ne sont pas censées exister sur les pages `/dossiers/[id]` et `/pipeline/[id]`. Elles sont des ancres décoratives de la landing publique qui n'ont de sens qu'à la racine `/`. Leur apparition sur les pages dossier est une fuite de rendu causée par le seul gate `!result && !analyzing` du bloc home (ligne 1882) qui ne tient pas compte du contexte de route.

La duplication est structurelle : le composant `HomeClient` sert simultanément trois rôles (home, dossier, pipeline) sans que les rendus spécifiques à la home soient gatés sur l'absence d'`initialAnalysisId`. Quand le contexte dossier ne charge pas un `result`, le composant retombe par défaut sur la home et propose au partner de démarrer un nouveau dossier, ce qui crée mécaniquement le doublon d'entrée.

L'erreur perçue par le partner n'est pas un crash du bouton "Lancer l'instruction" lui-même, c'est une cascade : l'ancre scrolle vers `#commencer`, le partner uploade, analyse() démarre, et soit le rate limit, soit le détecteur de doublon, soit la divergence d'`analysis_id` produit une notification que le partner lit comme un échec du bouton.

## Fix structurel

Trois actions :

1. **Gate la home sur l'absence d'`initialAnalysisId`.** Le bloc home (lignes 1882-2586) ne doit s'afficher qu'à la racine `/`. Sur `/dossiers/[id]` et `/pipeline/[id]`, jamais.

2. **Empty state dédié pour les dossiers shell.** Si `initialAnalysisId` est présent mais `result` n'a pas été chargé après la résolution du fetch, afficher une vue sobre qui explique la situation, surface l'`error` éventuelle, et propose un retour à l'accueil. Pas de CTA qui démarrerait un nouveau pipeline.

3. **Indicateur de chargement dédié.** Pendant `loadingPastAnalysis`, montrer un état "Chargement du dossier" plutôt que de laisser le rendu home flasher brièvement.

Le seul handler d'analyse reste `analyze()` côté HomeClient, appelé depuis la home. La logique de fetch n'est pas dupliquée : les CTAs "Lancer →" du hero étant supprimées de la page dossier, elles n'avaient de toute façon aucune logique propre, juste des ancres.

## Code modifié

`app/HomeClient.tsx` :

- Ligne 1882 : la conditionnelle `{!result && !analyzing && (` devient `{!result && !analyzing && !initialAnalysisId && (`. Le hero et la zone d'upload disparaissent des routes dossier et pipeline.
- Nouveau bloc avant l'ancien (vers ligne 1882) : `{initialAnalysisId && !result && !analyzing && (` qui rend soit un loader (`loadingPastAnalysis`) soit un empty state (note non disponible, erreur affichée, retour accueil).

## Vérification

- `npx tsc --noEmit` : vert
- Test mental : sur `/`, le hero et l'upload box restent disponibles, analyze() tourne. Sur `/dossiers/[id]` avec dossier valide, la note s'affiche, aucun CTA "Lancer" parasite. Sur `/dossiers/[id]` avec dossier introuvable, l'empty state explique la situation et renvoie à l'accueil.
- Test manuel local impossible faute d'auth Supabase active, le diagnostic est confirmé par lecture du flux de rendu et l'absence de tout autre handler "Lancer" branché.
