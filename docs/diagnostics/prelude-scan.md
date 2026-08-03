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

- [ ] 1. Le champ optionnel jamais renseigne
- [ ] 2. La valeur posee par un repli la ou un choix etait requis
- [ ] 3. La regle ecrite dans un commentaire, appliquee a une ligne
- [ ] 4. Deux catalogues du meme produit qui ne se confrontent jamais
- [ ] 5. Le correctif branche en aval du point de perte
- [x] 6. Le dispositif rendu inatteignable par une couche transverse
- [ ] Question laterale : ce qu il faudrait pour exercer Trajectoire

Base : HEAD `a139335`, arbre propre.

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
