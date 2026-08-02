# Grappe pre-scan, la porte d entree du pipeline

Ouverte le 2 aout 2026, en lecture seule, apres le run de validation de
la grappe 6. Aucun code n est modifie par cette note.

La grappe existe parce que le pre-scan commande tout le reste. Un
dossier ecarte n est jamais instruit : les six grappes de la semaine,
de la base de valorisation a la tracabilite des appels au modele,
portent sur ce qui se passe apres une porte dont on ne savait pas si
elle s ouvrait sur un critere ou sur un tirage.

La doctrine retenue avant l enquete : soit il vote, soit il ne coupe
pas.

## 1. Pourquoi plusieurs verdicts sur le meme deck

### Ce qui est lu dans le code

`lib/engines/prescan-engine.ts:270`. Le moteur appelle
`callClaudeWithPDF` avec `FAST_MODEL` et une temperature de zero,
posee explicitement en sixieme argument.
`lib/engines/anthropic-client.ts:570` ne transmet la temperature que
si elle est definie ; zero etant defini, elle part bien dans la
requete. La temperature est donc reellement passee sur ce chemin, ce
qui n allait pas de soi et qui ecarte la premiere hypothese.

Le modele est Haiku 4.5. L appel ne porte aucun outil, donc aucune
recherche web : cette variance-la est exclue par construction.

Le bloc document porte `cache_control: { type: 'ephemeral' }`. Deux
tentatives rapprochees sur le meme PDF ne suivent donc pas le meme
chemin numerique, l une ecrivant le cache et l autre le lisant.

Le prompt systeme est construit par `buildSystemPrompt(fundProfile)` a
partir du profil de fonds lu en base. Le profil de l organisation n a
pas ete modifie depuis le 6 mai 2026, `created_at` et `updated_at`
portant la meme valeur. Le prompt est donc identique entre juillet et
aout pour la partie these, aux evolutions du code pres.

### Ce qui est lu dans les donnees

Le deck In Haircare a ete soumis quinze fois. Cinq de ces runs portent
un pre-scan reellement execute, les dix autres rejouant un verdict
anterieur par override du partner, `__overrideReason: force-prescan`,
sans nouvel appel au modele.

```
2026-07-15 16:04   ready_for_pipeline      9/10   aucun echec
2026-07-16 07:29   pipeline_with_caveats   6/10   stage_ticket, ticket_fit, stage_fit
2026-07-16 09:45   pipeline_with_caveats   6/10   stage_ticket, ticket_fit, stage_fit
2026-08-02 20:41   not_recommended         9/10   sector_fit
2026-08-02 20:47   not_recommended         5/10   stage_ticket, thesis_fit, sector_fit, stage_fit
```

Les trois valeurs possibles de `recommendation` sont sorties du meme
fichier. C est le fait central de cette grappe.

### Ce que ce tableau etablit, et ce qu il n etablit pas

Il faut separer trois lectures, parce que la premiere formulation que
j ai rendue a Steve etait plus forte que les donnees.

Les deux tirages du 16 juillet sont rigoureusement identiques, meme
score, meme trio de tests en echec, a deux heures d intervalle. Le
determinisme n est donc pas absent : il tient parfois.

Les deux tirages du 2 aout, a six minutes d intervalle, sur le meme
fichier et le meme profil, rendent le meme verdict par des chemins
opposes : neuf sur dix avec un seul test en echec, puis cinq sur dix
avec quatre. La justification est instable meme quand la conclusion ne
l est pas. Un partner qui lit le bandeau de refus ne lit donc pas une
raison, il lit une raison parmi d autres.

L ecart entre juillet et aout, lui, n est pas imputable au seul
echantillonnage : le code a change entre les deux, et rien dans les
runs de juillet ne porte d empreinte du prompt de pre-scan, les
empreintes de prompt n existant que depuis la grappe 6. La bascule de
`ready_for_pipeline` a `not_recommended` sur le meme deck est donc
constatee et non expliquee. Elle est aussi la plus grave.

Une derniere source de variance est structurelle et non stochastique.
`totalTests` vaut le nombre de tests que le modele a rendus, pas le
nombre de tests demandes : `lib/engines/prescan-engine.ts:290`,
`validatedTests.length || (fundProfile ? 10 : 6)`. Sur les dix-neuf
pre-scans a profil lisibles du corpus, `stage_fit` est absent quatre
fois et `ticket_fit` une fois. Le denominateur du ratio bouge donc
avec la docilite du modele, et un test omis est un test qui ne peut
pas echouer. Quinze runs sont juges sur dix tests, trois sur neuf, un
sur huit.

### L erreur de fond, qui n est pas une question de variance

Le profil de fonds liste vingt-six secteurs cibles, dont `Consumer` et
`E-commerce`, aucun secteur exclu, aucun stade filtre, et une gamme de
tickets de 500 euros a 15 millions. Le pre-scan du 2 aout a 20h41
ecrit pourtant : « ce dossier releve du consumer beauty, secteur absent
de la these du fonds ». C est faux contre le contenu meme du prompt qui
lui a ete remis, et c est ce test-la, `sector_fit`, qui a declenche
l elimination.

Le meme constat vaut sur les autres tests de these. Les stades ne sont
pas filtres, et `stage_fit` echoue dix fois sur les quinze runs ou il
est present. Le ticket recherche, 800 000 euros, est dans la gamme, et
`ticket_fit` echoue sept fois sur dix-huit, `stage_ticket` treize fois
sur dix-neuf. Un profil qui n exclut rien produit un taux d echec de
these qui est le plus eleve du dispositif.

Il y a donc deux problemes distincts, et le second ne se resout pas par
un vote. Le premier est que le tirage est instable. Le second est que
les quatre tests de these sont mal poses : ils ne comparent pas le
dossier au profil, ils redecident de la these. Un vote a trois passes
sur un test faux produit un faux resultat avec plus de confiance.

### La doctrine du moteur contredit deja la route

`lib/engines/prescan-engine.ts:17` : « Architecture conservatrice : le
pre-scan NE BLOQUE PAS le pipeline. Il produit un verdict consultatif
que le partner peut utiliser pour decider. »
`app/api/analyze/route.ts:767` arrete le pipeline et ferme le flux.

Le commentaire n a pas ete mis a jour quand le gating est arrive, mais
il dit ce que la conception voulait. Le passage du consultatif au
couperet s est fait sans que la fiabilite du verdict soit reevaluee.

## 2. Combien de dossiers ont ete ecartes, et combien sont retrouvables

Cinquante-trois analyses en base. Par statut : vingt-neuf `completed`,
quinze `completed_with_gaps`, quatre `running`, trois `failed`, deux
`knockout`.

Verdicts de pre-scan persistes : quinze `not_recommended`,
vingt-sept `pipeline_with_caveats`, deux `ready_for_pipeline`, neuf
sans pre-scan.

Le chiffre qui compte est ailleurs. Sur ces cinquante-trois runs, sept
seulement portent un pre-scan produit par le modele dans ce run-la et
qui garde le detail de ses tests. Trente-cinq rejouent un verdict
anterieur par override. Deux, ceux d aujourd hui, gardent un resume
sans le detail des tests. Neuf n en ont pas.

**Eliminations qui ont effectivement arrete un pipeline et qui sont
retrouvables : deux, toutes deux du 2 aout 2026.** Ce sont les deux
premieres depuis que le bloc 4 de la grappe 6 persiste la prediction.

**Eliminations prononcees puis annulees par le partner : treize.** Ce
sont les runs `not_recommended` portant `__overrideReason`. Elles sont
retrouvables parce que le partner a insiste, pas parce que le systeme
les a gardees. C est le seul corpus d eliminations exploitable
aujourd hui, et il est biaise par construction : il ne contient que
celles que quelqu un a jugees assez douteuses pour passer outre.

**Eliminations anterieures au 2 aout ayant arrete un pipeline : nombre
inconnu, et il le restera.** Avant `markAnalysisKnockedOut`, le
knockout fermait le flux sans rien ecrire ; la ligne restait `running`
jusqu au balayage des mort-nees, qui la passe en `failed` sans
`result_json`. Les trois lignes `failed` sans resultat, du 8 juin au
2 aout, sont indistinguables entre un knockout, une coupure SSE et une
panne. Les quatre lignes `running` sont dans le meme cas.

Le taux d elimination reel du dispositif n est donc pas mesurable
retrospectivement. Il le devient a partir d aujourd hui.

## 3. Ce qu un vote couterait

### Ce qui est mesure

Seize durees de pre-scan sont persistees dans le corpus : minimum
21 984 ms, mediane 28 620 ms, maximum 35 333 ms. Le pre-scan annonce
dans son propre en-tete un triage « en 5-8 secondes ». Il en prend
vingt-neuf en mediane, soit quatre fois la cible affichee.

Aucune mesure de tokens n existe pour le pre-scan. Le seul run portant
un registre d appels, celui de 20h48, a emprunte le chemin d override
et n a donc pas appele le modele pour son pre-scan : le registre y
compte vingt et un appels dont aucun ne correspond au plafond de 2 500
tokens du pre-scan. Le premier chiffre reel viendra du prochain run non
force. Le cout monetaire couramment cite, 0,025 dollar par passe, est
une constante ecrite en dur dans le moteur, pas une mesure.

### Ce qu un vote a trois passes coute

Sur le chemin critique, le pre-scan est en tete de pipeline et
bloquant. Trois passes lancees en parallele coutent le maximum des
trois tirages et non leur somme, soit un ordre de trente a
trente-cinq secondes contre vingt-neuf aujourd hui. Le surcout en
temps est de quelques secondes. Trois passes en sequence couteraient
au contraire quatre-vingt-six secondes, ce qui serait le mauvais
choix.

En tokens, le vote triple mecaniquement le cout du pre-scan, avec une
reserve favorable : le cache ephemere du document est ecrit par la
premiere passe et lu par les deux autres, donc les deux passes
supplementaires ne repaient pas l integralite du PDF.

Rapporte a ce qu il protege, l ordre de grandeur est ecrasant. Trois
passes coutent environ 0,075 dollar contre 2,20 a 2,80 dollars pour le
pipeline complet, soit moins de trois pour cent. Le gating a ete
introduit pour economiser ces 2,80 dollars ; le vote coute trois pour
cent de la somme qu il securise.

### La regle de decision

Le cout des deux erreurs n est pas symetrique. Un faux positif fait
tourner un pipeline pour rien et coute trois dollars. Un faux negatif
fait disparaitre un dossier de l instruction sans que personne ne le
sache, et le partner ne voit jamais ce qu il n a pas lu.

La regle qui suit de cette asymetrie est l unanimite pour couper.
Trois passes, elimination seulement si les trois rendent
`not_recommended`, sinon le pipeline part avec le bandeau d alerte.
Une majorite simple serait plus economique et moins juste : elle
laisserait une passe dissidente sans effet, alors que c est
exactement le signal qu on cherche.

Deux precisions que la mesure impose. D abord le score n est pas la
decision : six sur dix a produit `not_recommended` six fois et
`pipeline_with_caveats` deux fois, parce que la liste des cinq tests
critiques de `prescan-engine.ts:305` decide seule. Le vote doit donc
porter sur `recommendation`, ou mieux sur chaque test critique pris
separement, et non sur le score. Ensuite, le denominateur variable doit
etre traite avant le vote : un test absent doit compter comme non
rendu et non comme non applicable, sans quoi trois passes a neuf, dix
et huit tests ne sont pas comparables.

Enfin, l honnetete oblige a dire ce que le vote n aurait pas repare.
Les deux tirages du 2 aout rendent tous deux `not_recommended` : sous
l unanimite comme sous la majorite, In Haircare aurait ete ecarte. Ce
qui l aurait sauve n est pas le vote mais la correction de
`sector_fit`, qui contredit le profil de fonds place dans son propre
prompt. Le vote traite l instabilite, il ne traite pas l erreur
systematique.

## 4. Le stamp des runs elimines

La seule categorie de runs ou la reproductibilite se joue vraiment est
celle qui n en garde aucune trace. Les deux lignes `knockout` du
2 aout portent un `result_json` reduit a `meta` et `preScan`, ou `meta`
vaut trois champs, `predictedAt`, `outcome` et `cause`. Aucun
`versionStamp`, donc aucun `commitSha`, aucun `doctrineHash`, aucune
empreinte de prompt. Le commit sur lequel ces eliminations ont ete
prononcees ne se lit pas, il s infere du deploiement et de l horaire.

Le point le plus tot ou le stamp pourrait etre construit est
identifiable, et il est plus haut qu on ne croirait.
`buildVersionStamp` ne depend de rien qui vienne du pipeline :
`commitSha` vient de l environnement, `models`, `configs` et `engines`
sont statiques, `runMode` est connu des la lecture de la requete, et
`inputs` ne demande que les empreintes du deck, du business plan et du
texte. Toutes ces valeurs sont disponibles immediatement apres
`processFileRefs`, a l endroit exact ou la grappe 6 calcule deja
`deckHashPrecoce` pour le deposer sur la ligne.

L architecture anticipe meme ce decoupage : `sealVersionStamp` existe
et n ajoute que `durationMs` a un stamp deja construit. La separation
entre construction et cloture est donc deja ecrite, elle n est
simplement pas utilisee dans cet ordre.

Consequence a instruire dans le chantier : construire le stamp au meme
endroit que `deckHashPrecoce`, le deposer a la creation de la ligne, et
le sceller a la fin pour les runs qui vont au bout. Un run elimine
porterait alors tout ce qui permet de le rejouer, ce qui est la
condition pour repondre a un fonds qui demande pourquoi son dossier n a
pas ete instruit.

Une seconde perte, plus discrete, est a corriger au meme moment. La
prediction persistee par `markAnalysisKnockedOut` retient
`recommendation`, `score`, `totalTests`, `failedTests` et `summary`,
mais laisse tomber le tableau `tests`, le modele et la duree. Les deux
eliminations d aujourd hui sont donc les seules du corpus dont on ne
peut pas lire le detail des tests, alors que ce sont les seules qui ont
reellement coupe. Les treize eliminations overridees, elles, gardent
tout, parce qu elles transitent par le client.

## Dettes ouvertes par cette grappe

**Le nom de societe n est pas repris sur les lignes ecartees.** Les
deux lignes `knockout` s appellent encore `(analyse en cours)`, libelle
pose par `createPendingAnalysis` avant l extraction, alors que le
`summary` du pre-scan de la meme ligne commence par « In Haircare est
une marque de soins capillaires ». Le nom est disponible au moment de
la cloture et n est pas ecrit. Un dossier ecarte est donc identifiable
par son `deck_hash` mais pas par son nom, ce qui est l inverse de ce
qu un partner attend en rouvrant sa liste le lendemain.

**Le commentaire d en-tete du moteur decrit un dispositif consultatif
qui n existe plus.** A corriger en meme temps que la doctrine du
gating, pas avant : tant que la question du vote n est pas tranchee,
c est le commentaire qui dit la bonne intention.

**Le taux d elimination du dispositif n a pas de valeur historique.**
Toute mesure de ce taux commence au 2 aout 2026. Les affirmations du
type « le pre-scan ecarte trente pour cent des dossiers entrants »,
presentes en commentaire de la route, sont des estimations d origine
inconnue et non des mesures.
