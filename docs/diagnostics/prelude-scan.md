# Scan des six motifs restants

Note ecrite au fil de l eau, le 3 aout 2026. Chaque section est
consignee des qu elle est verifiee, avant de passer a la suivante. Le
scan precedent a ete perdu avec le contexte de la session : c est la
deuxieme fois, d ou cette forme.

## Regle de restitution

Aucune occurrence n est citee sans avoir ete ouverte et lue. Chaque
section indique le nombre de candidats produits par le scan et le
nombre effectivement verifie. Un candidat elimine a la lecture est dit
et sa raison d elimination avec, parce que c est la seule facon de
savoir si le scan est trop large ou trop etroit.

Les motifs qui se decident structurellement se scannent. Ceux qui
demandent de comprendre un site d appel se lisent, et le scan n y sert
qu a produire la liste de lecture.

## Etat d avancement

- [x] 1. Le champ optionnel jamais renseigne
- [ ] 2. La valeur posee par un repli la ou un choix etait requis
- [ ] 3. La regle ecrite dans un commentaire, appliquee a une ligne
- [ ] 4. Deux catalogues du meme produit qui ne se confrontent jamais
- [ ] 5. Le correctif branche en aval du point de perte
- [x] 6. Le dispositif rendu inatteignable par une couche transverse
- [ ] Question laterale : ce qu il faudrait pour exercer Trajectoire

Base : HEAD `a139335`, arbre propre.

## 1. Le champ optionnel jamais renseigne

Verifie 18 candidats sur 79, plus une classe entiere eliminee en bloc.

Le scan est fait par l arbre syntaxique et non par le texte, faute de
quoi il aurait mesure des mentions et non des ecritures. Il collecte
d un cote les proprietes optionnelles declarees, de l autre tous les
sites d ecriture possibles d une propriete de ce nom : affectation
dans un litteral d objet, forme abregee, affectation de membre,
declaration de classe. Sur 520 fichiers, 956 declarations optionnelles
pour 603 noms distincts. Quatre-vingt-dix-neuf noms sortent : 79 que
rien n ecrit nulle part, 9 que seuls des tests ecrivent.

Le rapprochement se fait par nom, ce qui est grossier mais fautif dans
le bon sens : si un nom n apparait dans aucun site d ecriture du depot,
il n est ecrit pour aucun type. Le scan ne peut donc pas manquer une
occurrence, il peut seulement en inventer, d ou la verification.

### Une classe entiere de faux positifs, et pourquoi elle etait prevue

Dix des 79 noms sont des champs de sortie de moteur declares dans
`lib/engines/types.ts` : `aiVelocity`, `declaredVsVerified`,
`evaluability`, `assetClassMatch`, `cautionLevel`,
`pitchAlignmentNote`, `assessorDisagreementRationale`,
`structuringPlan`, `weakSignalsChecks`, `horizon`. Aucun n est ecrit en
TypeScript nulle part, et tous sont pourtant remplis a chaque run.

La raison est que le scan mesurait le mauvais support, ce qui est la
faute que la discipline de mesure nomme au troisieme corollaire. Ces
champs ne sont pas ecrits par du code, ils sont parses depuis le JSON
que rend le modele, et leur veritable site d ecriture est le squelette
JSON du SYSTEM_PROMPT de leur moteur. Verification faite sur les dix :
`cautionLevel` occupe six lignes du prompt de `pattern-engine.ts`, dont
une regle d or qui impose de le remplir pour chaque comparable ;
`weakSignalsChecks` demande trois a six entrees dans
`reference-checks-engine.ts` ; `structuringPlan` est conditionne au
verdict dans `orchestrator.ts`. Les dix sont demandes.

Ce n est pas un defaut du scan, c est la limite qu il fallait connaitre
avant de le lancer : pour tout champ traversant la frontiere du modele,
un scan de code TypeScript ne dit rien, et seule la lecture du prompt
tranche. Je le consigne parce que le prochain scanner refera l erreur
sinon, et parce qu un rapport qui aurait cite ces dix noms aurait rendu
dix faux positifs sur ses premieres lignes.

Meme sort pour les options de seuil de `milestone-detection-selector.ts`
et `sectoral-regeneration-selector.ts`, dont le commentaire de
signature declare l intention : « override des seuils pour les tests,
en prod les valeurs par defaut s appliquent ». Une couture de test
declaree comme telle n est pas un champ oublie.

Restent une quarantaine de props React optionnelles jamais passees, que
je n ai pas ouvertes une a une : `printMode`, `compactMode`,
`onNodeClick`, `ariaLabel` et leurs voisines. Ce sont des surfaces
d interface inertes, sans portee doctrinale, et je le dis comme une
appreciation de classe et non comme une verification.

### Le vrai cas : le moteur Fixed Cost Trap ne recoit aucune donnee financiere

Le candidat `offBalanceRatio`, declare ligne 313 de
`lib/engines/fragility-structurelle/fixed-cost-trap-pattern.ts`, m a
conduit a l interface qui le porte. En la lisant, ce n est pas un champ
qui manque, ce sont les neuf.

`FinancialBurnSnapshot` declare neuf champs. Son unique constructeur,
`extractBurnSnapshot`, en renseigne huit, chacun par un couple de
replis sur `financialData` : `f?.monthlyBurn ?? f?.burnRate`,
`f?.runwayMonths ?? f?.runway`, `f?.totalCommitments ??
f?.offBalanceCommitments`, et ainsi de suite. Or l objet est traverse
par un cast `const f: any = financialData`, et `FinancialDataExtraction`
ne porte aucune de ces treize clefs. Ni `monthlyBurn`, ni `burnRate`,
ni `runwayMonths`, ni `capex`, ni `payroll`, ni `rentAnnual`, ni
`contractualMinimums`. Le moteur d extraction financiere les produit
sous une autre forme : `runwayMonths` et `monthlyBurn` n existent
qu imbriques dans `currentRound`, et comme chaines de caracteres, du
genre « 200K€/mois ».

Le cast `any` est ce qui rend l ensemble silencieux au typage. Sans
lui, `tsc` aurait refuse les treize lectures.

Verification faite en exercant la fonction sur un objet conforme au
squelette JSON que le moteur d extraction demande au modele, et non sur
une fixture batie a l appui de l hypothese, ce qui aurait mesure ma
lecture des donnees au lieu des donnees. Le snapshot rendu est `{}`,
zero champ sur neuf, et le bloc correspondant du prompt vaut :

    # DONNÉES BURN ET ENGAGEMENTS DISPONIBLES

    (aucune donnée structurelle de burn ni d engagement long terme
    disponible, analyse sur la base des éléments qualitatifs du pitch
    et du résumé)

Ce bloc est le seul que le pattern recoive, sur tous les dossiers,
depuis toujours, y compris ceux qui arrivent avec un business plan
complet. Fixed Cost Trap mesure la rigidite contractuelle face a un
choc de demande, son cas canonique est WeWork, et il l a toujours
jugee sur le pitch.

Le repli est ce qui a rendu la panne invisible, et de la plus mauvaise
maniere. La phrase de repli est vraie : il n y a effectivement aucune
donnee dans le snapshot. Elle est simplement vraie pour la mauvaise
raison, et un lecteur du prompt genere conclut a un dossier pauvre en
donnees financieres la ou il faut conclure a un lecteur qui regarde au
mauvais endroit. C est le pendant, cote production, de la discipline
des jeux d essai : une absence indistinguable d une absence legitime ne
se detecte par aucune relecture de sortie.

La correction est de lire `financialData` la ou il est reellement
ecrit, ce qui suppose de parser les chaines de `currentRound` en
nombres, avec la reserve d usage sur les unites. Elle suppose surtout
de retirer le cast `any` en premier, avant d ecrire la moindre ligne de
lecture : c est lui la cause, les treize clefs fantomes n en sont que
la consequence, et toute correction ecrite en le laissant en place
pourra se tromper a nouveau sans que rien ne le dise. Les champs que
l extraction ne produit pas du tout, dont `offBalanceRatio`,
`contractualMinimums` et `capexCumulated`, sont un second sujet :
soit le moteur d extraction financiere apprend a les chercher, soit
ils sortent de l interface. Ils ne peuvent pas y rester declares sans
producteur.

### Cas mineur retenu

`fragiliteVerdicts`, filtre optionnel de `listPortfolioLatestSnapshots`
dans `lib/trajectory-store.ts:265`, est cable jusqu a la requete SQL
(`query.in('fragilite_verdict', ...)`) et aucun appelant ne le passe.
Sans consequence tant que la vue portefeuille ne filtre pas, et cette
question rejoint celle du moteur Trajectoire traitee plus bas.

## 6. Le dispositif rendu inatteignable par une couche transverse

Verifie 2 candidats sur 2, tires d une population de 53 routes.

La methode ne consiste pas a relire les 53 routes, mais a se demander
laquelle a un appelant legitime qui ne porte pas de cookie de session,
puisque c est exactement ce que le middleware exige. Deux facons de le
savoir, croisees : les routes qui lisent un en-tete d autorisation
plutot qu une session, et les chemins effectivement appeles depuis
l interface. La premiere donne deux routes, la seconde donne vingt et
un chemins dont aucun ne recouvre les deux premieres.

### `/api/sectoral/event-trigger` est redirige en 307 depuis sa mise en service

C est la septieme occurrence du motif des six crons, restee dans
l ombre parce que la correction a porte sur le prefixe `/api/cron/` et
que cette route n y est pas.

Le webhook s authentifie par `Authorization: Bearer
<SECTORAL_EVENT_TOKEN>`, verifie en premiere ligne de son handler. Son
appelant est un systeme externe ou un script manuel, jamais un
navigateur porteur de session. Sous `ENABLE_AUTH=true`, le middleware
l intercepte : le chemin n est pas dans `PUBLIC_PATHS`, qui ne contient
que `/`, `/login`, `/auth/callback` et `/demo` ; il n est pas exclu par
le matcher, dont la seule branche applicative est `api/cron/` ; il
tombe donc sur la redirection vers `/login` ligne 108 de
`middleware.ts`. L appelant recoit un 307 vers une page de connexion,
la garde par token n est jamais atteinte, et la regeneration
evenementielle n a jamais eu lieu.

Le dispositif est complet a tous les autres egards, ce qui est le
propre du motif. La route valide son payload, tient un mode de
defaillance sur : token absent cote serveur rend 503 plutot que
d ouvrir. Les helpers purs sont extraits dans
`lib/cron/sectoral-event-trigger.ts`. Deux fichiers de tests
l exercent, dont un qui verifie que `CRON_SECRET` ne deverrouille pas
`event-trigger`. Tout ce qui pouvait etre pense l a ete, sauf la
couche qui ne se voit depuis aucun de ces fichiers.

Deux faits aggravent le diagnostic et meritent d etre dits parce qu ils
ne se lisent pas dans le code. `SECTORAL_EVENT_TOKEN` n est declare
nulle part : ni dans un `.env.example`, qui n existe pas dans le depot
contrairement a ce qu affirme CLAUDE.md, ni dans la moindre page de
documentation. Une route dont le secret n est documente nulle part n a
pas d appelant configure. Le 307 n est donc pas ce qui a empeche la
regeneration evenementielle de tourner, il est ce qui l aurait empechee
si quelqu un avait essaye. La panne est reelle et n a encore rien
coute, ce qui est la seule bonne nouvelle de cette section.

La correction est de la meme forme que celle des crons : sortir avant
toute lecture de session, sur une condition de chemin, et exclure du
matcher. Elle ne doit pas etre ecrite comme un second cas particulier a
cote de `isCronPath`. Ce qui distingue ces routes n est pas leur
prefixe, c est leur mode d authentification : elles se gardent par
en-tete. La bonne forme est un unique predicat des chemins gardes par
en-tete, dont `/api/cron/` et `/api/sectoral/event-trigger` sont les
deux membres actuels, teste contre la liste reelle des routes qui
lisent `authorization`, sur le modele du test qui compare deja le
matcher aux six chemins de `vercel.json`. Sans ce verrou, la huitieme
route posera le probleme une troisieme fois.

### Constat adjacent : quatre routes qui travaillent apres avoir repondu

Le meme scan a fait apparaitre un motif voisin, que je consigne sans le
confondre avec le precedent : la couche transverse n y rend pas le
dispositif inatteignable, elle le rend ininterrompu seulement par
chance.

Quatre sites lancent un travail de fond apres avoir retourne un 202 :
`app/api/sectoral/event-trigger/route.ts:157`,
`app/api/inter-sectoral/regenerate/route.ts:133`, et
`app/api/admin/sectoral/regenerate/route.ts` en deux endroits, lignes
147 et 222. Tous suivent la forme `void job()`, ou `job` contient un
appel LLM d une minute. Sur l execution serverless de Vercel,
l instance peut etre gelee des la reponse rendue : le travail lance et
non attendu n a aucune garantie d achevement, et le mecanisme prevu
pour cela, `waitUntil`, n est importe nulle part dans le depot. La
seule occurrence du mot est une option de Puppeteer dans
`export-pdf/route.ts:163`, sans rapport.

Je le donne comme un risque structurel et non comme une panne
constatee, parce que je ne l ai pas mesure en production : une
regeneration qui aboutit et une regeneration coupee a mi-course se
distinguent dans les fiches persistees, pas dans le code. La
verification tient en une lecture des fiches sectorielles regenerees
par declencheur `admin` et de leur taux d aboutissement, et elle est a
faire avant de decider quoi que ce soit.
