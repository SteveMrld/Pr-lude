# Grappe fetchers, la fiabilite des entrees externes

Grappe a part entiere, ouverte au brief 24 et volontairement non
traitee. Elle a ete sortie de la grappe 3 parce qu elle n est pas un
probleme de message mais de contrat.

## Le fait

Les moteurs Equipe et Reference checks lisent un resultat vide venu
des sources externes et concluent a une absence de signal. Ce vide peut
etre un timeout, une erreur reseau, un quota depasse ou une source
indisponible. Rien dans la sortie ne permet de faire la difference,
et le pipeline ne conserve aucune trace de ce qui a echoue.

## Ce qui est lu

`lib/data-fetchers/sources.ts:205-210`. `withBudget` enveloppe chaque
appel de source dans un budget de temps. Le `catch` emet un evenement
SSE `fetcher:timeout` puis retourne `emptyValue`, la valeur vide de la
source. L appelant recoit exactement ce qu il aurait recu d une
recherche aboutie et sans resultat.

`lib/data-fetchers/sources.ts:212-223`. `fetchWithTimeout` retourne
`null` sur toute exception, `AbortError` de timeout comme erreur
reseau. Un 404 legitime et une coupure produisent le meme `null`.

`lib/data-fetchers/sources.ts:646, 654, 662` et suivantes. Une dizaine
d appels de la forme `searchX(...).catch(() => null)`. Le `catch` sans
argument ne journalise rien : l erreur est perdue au moment ou elle
survient.

Les evenements `fetcher:timeout` et `fetcher:miss` n existent nulle
part ailleurs que dans `sources.ts`. La distinction est donc
definitivement perdue des que le run est termine, y compris pour un
rejeu hors ligne.

**Correction du 2 aout 2026, la premiere lecture etait plus indulgente
que la realite.** Cette note affirmait que les evenements vivaient le
temps d une connexion SSE puis disparaissaient. Ils ne sont jamais
emis. `opts?.emit` n est appele que si un appelant fournit un objet
`FetcherOpts`, et aucun ne le fait : le moteur Equipe passe
explicitement `undefined` en troisieme position de
`gatherFounderRealData` (`team-engine.ts:419`), le moteur macro appelle
`gatherMacroRealData` avec un seul argument, et la recherche de
`FetcherOpts` hors de `sources.ts` ne rend aucun autre site. Les cinq
evenements, `fetcher:start`, `hit`, `miss`, `timeout`, `skipped` et
`budget_exceeded`, sont cables et sans emetteur.

Le mecanisme d observabilite existe pourtant en entier : `trackedSource`
distingue deja le hit du miss et du timeout, avec une heuristique sur
le temps ecoule proche du budget. Rien de tout cela ne sort de la
fonction.

C est la cinquieme occurrence de la famille des mesures fausses de la
semaine, et la premiere qui ne vienne pas d une commande trop etroite
mais d une lecture de code qui a suppose un cablage sans le verifier.
Elle a une consequence de conception directe, consignee plus bas : un
parametre optionnel jamais fourni est la preuve empirique que cette
forme ne tient pas, et reconduire la meme forme en promettant de la
brancher serait refaire le pari en connaissance de cause.

Consequence en aval, lue sur les consommateurs : `realData` du moteur
Equipe et les checks du moteur Reference checks sont construits a
partir de ces resultats. Un fondateur dont la recherche OpenAlex,
GitHub et Wikipedia a echoue produit le meme `realData` vide qu un
fondateur reellement absent de ces sources. Le moteur Equipe en tire un
`evaluability: 'non-evaluable'` et un score plancher, presente comme
« non instruit », ce qui est vrai mais ne dit pas que personne n a pu
instruire faute d avoir joint les sources.

## Pourquoi ce n est pas la grappe 3

La forme tranchee au brief 24, un champ de cause a cote du message,
suppose qu il existe un endroit ou declarer la cause. Ici il n y en a
pas : la couche de fetchers ne rend pas un objet de resultat portant
un statut, elle rend la donnee elle-meme, ou son equivalent vide. Poser
un champ demande de changer le type de retour de chaque source, donc
le contrat entre la couche de donnees et les moteurs.

C est la question de la cascade team du brief 21, posee sur les entrees
externes plutot que sur les dependances entre moteurs. La cascade
disait : un moteur ne doit pas consommer en silence une entree que son
amont n a pas produite. La meme phrase vaut ici, avec les sources
externes comme amont.

## Ce qui reste a etablir

Le perimetre exact des sources concernees et leur poids reel. Combien
d appels distincts, lesquels alimentent une dimension du score
mecanique et lesquels ne servent qu a enrichir la note. Un timeout sur
une source decorative et un timeout sur une source qui pese dans le
score ne meritent pas le meme traitement.

La forme du contrat. Envelopper chaque retour dans un objet portant la
donnee et l etat de la recolte est la solution complete et la plus
couteuse, elle touche tous les appelants. Un journal de recolte
agrege par run, persiste dans `result_json`, est moins invasif et
suffirait a rendre la distinction recuperable a posteriori sans changer
la signature des sources. Le second n empeche pas un moteur de
conclure a tort pendant le run, il permet seulement de s en apercevoir
apres.

Ce qu un moteur doit faire quand il apprend que ses entrees sont
incompletes. Baisser sa confiance, se declarer non applicable, ou
produire en signalant. La reponse n est probablement pas la meme pour
Equipe, dont le score entre dans la note mecanique, et pour Reference
checks, dont la sortie est une liste de contacts a appeler.

Le cout d un rejeu. Si la recolte est journalisee, un dossier dont les
sources ont echoue devient identifiable et rejouable. C est peut-etre
la reponse la plus simple : ne rien changer aux moteurs, rendre le
defaut visible, et rejouer.

## Ce qu on ne touche pas

`fetchCache` a `sources.ts:138-147` supprime l entree du cache quand la
promesse echoue, de sorte qu un echec ne soit pas memorise pour tout le
run. Ce comportement est correct et doit le rester : il garantit qu un
second appel dans le meme pipeline retente reellement.

## Annexe operatoire : la surveillance du deploiement apres le passage en SSH

Consigne ici parce que la question se posera au premier push de cette
grappe, et qu elle a ete tranchee avant d etre rencontree.

Le remote `origin` est passe en SSH le 2 aout 2026, avec une paire
ed25519 generee sur la machine. Plus aucun identifiant ne transite par
la conversation pour pousser. Mais l API GitHub, qu interroge le script
de surveillance du deploiement pour lire l etat Production d un sha, ne
connait pas SSH : elle veut un token.

Trois options avaient ete posees, une seule est retenue.

**Retenue.** Un token a portee reduite, stocke dans `.env.local` et
injecte par le meme mecanisme que le PAT Supabase, c est-a-dire le
serveur local sur le port 7778. Il ne transite jamais par le chat. La
portee minimale suffit : lecture des deployments et de leurs statuts
sur un depot prive, soit `repo` en classic ou la permission Deployments
en lecture seule en fine-grained.

**Ecartee, l abandon de la verification automatique.** Elle a servi a
chaque push de la semaine et a plusieurs fois corrige une conclusion
hative, dont une ou le script concluait sans imprimer sa ligne de
detail. S en priver rendrait la confirmation declarative.

**Ecartee, l exposition du sha deploye sur l URL de production.** Ce
serait ajouter une surface publique pour resoudre un probleme interne :
un endpoint qui publie la version deployee renseigne autant un
attaquant qu un operateur.

Etat de la configuration git apres bascule, verifie : `origin` en
`git@github.com:SteveMrld/Pr-lude.git`, lecture authentifiee sans
token confirmee par `git ls-remote`, `~/.git-credentials` toujours a
0 octet. Le helper `store` reste declare en configuration globale et
un helper vide le neutralise en configuration locale ; les deux sont
desormais inertes pour ce depot, SSH n empruntant pas la chaine des
credential helpers. Ils sont laisses en place plutot que supprimes :
les retirer toucherait la configuration globale de la machine pour un
gain nul.

## Mesure du brief 26, et pourquoi elle est indirecte

### La mesure demandee est nulle par construction

Le brief demandait combien des dossiers du corpus portent au moins un
`fetcher:timeout` ou `fetcher:miss` dans leur run persiste. La reponse
est zero, et ce zero ne mesure rien.

Aucun run anterieur ne peut en porter, pour deux raisons cumulees. Le
champ `meta.sourceHarvest` n existait pas avant ce chantier, donc rien
ne les aurait accueillis. Et les evenements n etaient de toute facon
jamais emis, `opts?.emit` n ayant aucun emetteur. Mesure sur les
quarante-trois dossiers : **zero porte un journal de recolte**, ce qui
etait acquis avant de compter.

### Le proxy retenu, et ce qu il vaut

A defaut, on mesure la population ou la distinction aurait compte : les
dossiers dont le `realData` du moteur Equipe est vide alors que des
fondateurs sont nommes. Sur ces dossiers, le moteur a conclu sur un
vide sans savoir d ou venait ce vide.

Sur quarante-trois dossiers, trente-huit nomment au moins un fondateur.
**Huit d entre eux, soit 21% de cette population, ont un realData vide
ou sans aucun resultat de source.** Six portent au moins un fondateur
marque `non-evaluable`, donc affiche « Non instruit » dans la note.

Le detail separe deux situations que le proxy ne distingue pas mieux
que le pipeline ne le faisait. Six dossiers ont un `realData` de
longueur nulle, ce qui signifie que le moteur n a produit aucune entree
par fondateur, y compris sur Braincube et ses trois fondateurs. Deux
dossiers, les deux runs de Bemersive, ont un `realData` peuple mais
dont chaque entree a `sourcesFound` vide. Aucun ne porte le sentinel
`timeout` que le `Promise.race` du moteur Equipe pose sur depassement
de budget, ce qui exclut au moins le depassement global comme cause,
sans rien dire des echecs par source.

Ce que le proxy ne dit pas, et il faut le tenir pour une limite et non
pour un resultat : il ne distingue pas un fondateur reellement absent
des bases publiques d un fondateur dont les recherches ont echoue.
C est precisement la distinction que le journal introduit, et qui
n existe pas retrospectivement. Le chiffre de 21% borne la population
concernee, il ne la qualifie pas.

La mesure reelle se fera sur les runs a venir, ou `meta.sourceHarvest`
portera les issues et leurs causes.

### La determination des sources du moteur Marche reste ouverte

Le prompt du moteur Marche ne porte aucune regle sur le cas des
sources absentes, ni repli explicite comme macro, ni plancher de
convention comme equipe. Rien dans le code ne permet donc d etablir si
ses sources sont determinantes pour ses trois dimensions notees,
intensite du besoin a 0,45, defensibilite a 0,35, signaux organiques a
0,20.

**Hypothese a tester, et non constat** : les signaux organiques
seraient la dimension la plus exposee, etant celle que Hacker News et
les sources de traction alimentent le plus directement. Rien ne
l etablit a ce jour.

La methode qui trancherait est un rejeu comparatif, deux runs du meme
dossier avec et sans sources, en observant l ecart sur les trois
dimensions. Elle appartient a une autre grappe : ce n est pas une
lecture de code et elle consomme deux runs LLM par dossier teste.
