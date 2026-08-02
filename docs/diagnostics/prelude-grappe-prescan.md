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

## 5. Doctrine tranchee, et ordre des travaux

Arbitre le 2 aout 2026, apres la mesure. L ordre compte autant que le
contenu, et il decoule d une phrase de l enquete : un vote a trois
passes sur un test faux produit un faux resultat avec plus de
confiance. Multiplier les tirages avant de reparer ce qui est tire,
c est acheter de la certitude sur une erreur.

L argument qui justifie cet ordre est un fait du corpus et non une
preference. Les deux tirages du 2 aout rendent tous deux
`not_recommended` : sous l unanimite comme sous la majorite simple,
In Haircare aurait ete ecarte. Le vote ne l aurait pas sauve. Seule la
correction de `sector_fit` l aurait fait, puisque c est ce test qui a
declare hors these un dossier consumer alors que le profil du fonds
porte `Consumer` et `E-commerce` parmi ses vingt-six secteurs cibles.
Le dispositif dont on debattait le plus n aurait rien change ; celui
dont on ne debattait pas etait la cause.

### 1. Ce qui est comparable se compare, ce qui se juge se juge

Secteur, stade et ticket sont des comparaisons entre une donnee du
dossier et une donnee du profil du fonds. Elles sortent du prompt et
deviennent deterministes. Le modele ne conserve que ce qui demande un
jugement, coherence narrative, credibilite du fondateur, plausibilite
financiere, drapeau rouge, et il ne redecide jamais la these.

La raison est que `sector_fit` ne mesure pas de la variance : il
demande au modele de juger ce qu une comparaison etablit. Un profil qui
liste vingt-six secteurs et n en exclut aucun, qui ne filtre aucun
stade et couvre les tickets de 500 euros a 15 millions, ne laisse rien
a apprecier. Le taux d echec observe sur ces tests le confirme et
l aggrave : `stage_ticket` echoue treize fois sur dix-neuf,
`stage_fit` dix fois sur les quinze runs ou il est present,
`ticket_fit` sept fois sur dix-huit. Les tests les plus defaillants du
dispositif sont exactement ceux qui n auraient jamais du etre confies
au modele.

Ce point precede tous les autres parce qu il retire du perimetre du
jugement ce qui n en relevait pas. Tout ce qui suit ne porte plus alors
que sur ce qui se juge reellement.

### 2. Le denominateur est fixe

`totalTests` vaut le nombre de tests demandes, pas le nombre de tests
rendus. Un test omis par le modele est un test en echec de production,
declare comme tel, et non un test qui disparait.

La raison est que la forme actuelle,
`validatedTests.length || (fundProfile ? 10 : 6)`, transforme une
defaillance en avantage. Un test omis ne peut pas echouer, et il retire
en meme temps une unite au denominateur, donc il remonte mecaniquement
le ratio. Quatre pre-scans du corpus sont juges sur neuf tests et un
sur huit sans que rien ne le signale. Deux passes qui ne rendent pas le
meme nombre de tests ne sont pas comparables, ce qui rend le point 2
prealable au point 3 : on ne peut pas faire voter des bulletins dont on
ignore le format.

C est aussi la forme exacte que la grappe 3 a tranchee ailleurs. Un
test absent est une non-production, elle a une cause, et cette cause
est `incident` et non `absence` : le modele devait le rendre.

### 3. Le vote vient apres, et seulement si la variance subsiste

Une fois 1 et 2 poses, la question se repose sur ce qui reste, les
tests de jugement, avec un denominateur stable. Si la variance a
disparu, le vote est sans objet et le couperet peut rester a une passe.
Si elle subsiste, la regle est celle etablie a la section 3 : trois
passes en parallele, au maximum des trois durees et non a leur somme,
elimination seulement si les trois rendent `not_recommended`, sinon le
pipeline part avec le bandeau d alerte.

L asymetrie de cout ne bouge pas et reste le fondement de l unanimite.
Un faux positif fait tourner un pipeline pour rien et coute trois
dollars. Un faux negatif fait disparaitre un dossier de l instruction
sans que personne ne le sache, et le partner ne voit jamais ce qu il n a
pas lu. Une majorite simple laisserait une passe dissidente sans effet,
alors que c est precisement le signal recherche.

Le vote est donc conditionnel et arrive en troisieme, non parce qu il
serait couteux, il coute moins de trois pour cent de ce qu il protege,
mais parce que sa valeur depend entierement de ce que 1 et 2 auront
laisse.

### 4. Le stamp des runs elimines

Le stamp est construit apres `processFileRefs`, la ou vit deja
`deckHashPrecoce`, et `sealVersionStamp` le ferme a la cloture. Dans le
meme geste, `markAnalysisKnockedOut` cesse de laisser tomber le tableau
`tests`, le modele et la duree.

La raison est que ce point conditionne la verification des trois
autres. Sans stamp sur les runs elimines, aucune des corrections
ci-dessus ne pourra etre attribuee a un commit ni a une version de
doctrine, et la seule categorie de runs ou la reproductibilite se joue
restera celle qui n en garde aucune trace. Sans le detail des tests sur
les lignes ecartees, la variance residuelle du point 3 ne sera pas
mesurable, puisque les seuls runs qui coupent sont aujourd hui les
seuls dont on ne peut pas lire les tests.

Il est place en quatrieme parce qu il n a pas besoin de preceder les
autres pour etre juste, mais il ne doit pas les suivre de loin : le
premier run qui validera 1 et 2 devra deja le porter.

### Ce qui reste ouvert et ne doit etre impute a rien

La bascule de juillet a aout sur le meme deck, de `ready_for_pipeline`
a `not_recommended`, est constatee et non expliquee. Le code a change
entre les deux, aucun run de juillet ne porte d empreinte de prompt, et
le profil de fonds n a pas bouge. Cela suffit a exclure le profil, cela
ne designe rien d autre. Elle reste ouverte comme telle jusqu a ce qu un
run l etablisse, et aucune des quatre decisions ci-dessus ne doit etre
justifiee par elle.

## 6. Mesure du brief 28, et ce qu elle ne peut pas dire

### Le rejeu demande est bloque, et il faut le dire avant les chiffres

Le bloc 4 demandait de rejouer le pre-scan sur les dossiers du corpus
dont le deck est disponible, pour mesurer ce qui reste de variance une
fois les comparaisons sorties du jugement. Les decks sont la, quatre-
vingts PDF dans le bucket `dossier-uploads`, rattaches aux analyses par
`uploaded_files[].storagePath`, et vingt-huit noms de fichiers
distincts. La cle d API Anthropic est en place.

Le telechargement, lui, ne passe pas.
`SUPABASE_SERVICE_ROLE_KEY` porte toujours le R parasite du 2 aout,
220 caracteres au lieu de 208, et l API Storage la refuse avec un
`Bucket not found` qui est un refus d authentification deguise. La cle
anon, elle, rend `Object not found`, c est-a-dire un 404 de RLS. Aucune
des deux ne permet de lire un deck, et la consigne est de ne pas
toucher a `.env`.

Le rejeu attend donc une cle de service valide. Son cout est borne :
vingt-huit decks distincts, trois passes chacun pour mesurer une
variance, soit quatre-vingt-quatre appels Haiku, de l ordre de deux
dollars et d une demi-heure en parallele. Il ne demande aucun run
complet.

**Ce qui suit ne mesure donc pas la variance residuelle.** Cela mesure
ce que le corpus permet d etablir sans rappeler le modele, et la
distinction compte : la premiere question du bloc 4 reste ouverte.

### Ou tombaient les verdicts defavorables

Sur tous les pre-scans du corpus dont le detail des tests est lisible,
quarante-sept echecs de test sont enregistres. Trente-quatre portent
sur les cinq tests devenus deterministes, treize sur les cinq tests de
jugement. **Soixante-douze pour cent des echecs sortent du domaine du
jugement**, et avec eux la variance qu ils portaient. Les alertes
suivent la meme pente, vingt-deux contre quinze.

C est la mesure qui justifie l ordre des travaux : la majorite de ce
que le pre-scan reprochait aux dossiers relevait d un calcul, pas d une
appreciation.

### Mais les eliminations ne suivent pas la meme repartition

Treize eliminations du corpus gardent le detail de leurs tests. Leur
decomposition dement la lecture optimiste que le chiffre precedent
invite a faire.

```
elimineees par un couperet devenu deterministe seul : 1
elimineees par un couperet de jugement seul         : 9
couperet mixte, jugement et comparaison             : 3
elimineees par le score seul                        : 0
```

Une seule elimination sur treize reposait uniquement sur un test que le
code tranche desormais. Neuf reposaient sur `narrative` ou sur
`thesis_fit`, qui restent des jugements. Trois etaient mixtes : la part
comparative disparait, la part de jugement coupe toujours.

Autrement dit, la correction retire la majorite des echecs et la
minorite des eliminations. Les deux chiffres sont vrais et ils ne
disent pas la meme chose, parce que le couperet ne compte pas les
echecs, il regarde cinq tests critiques.

### Correction sur In Haircare, contre ce que j avais avance

La note affirmait plus haut que seule la correction de `sector_fit`
aurait sauve In Haircare. C est vrai du premier tirage du 2 aout, ou
`sector_fit` etait le seul test en echec sur neuf sur dix. C est faux
du second, ou `thesis_fit` a echoue en meme temps que `sector_fit`,
`stage_ticket` et `stage_fit`.

Apres les blocs 1 et 2, le premier tirage ne coupe plus. Le second
coupe toujours, parce que `thesis_fit` reste un jugement et qu il a
rendu `fail` sur une marque de soins capillaires.

Ce qui ouvre le vrai sujet. `thesis_fit` s appelle « fit de these » et
son enonce dit l inverse : « signaux d alarme integrite, claims
grossierement faux, projet manifestement illegal », et le prompt
precise meme qu il ne concerne pas la these d un fonds. Le modele
echoue ce test sur des dossiers ou aucun drapeau rouge n existe, et
c est le deuxieme motif d elimination du corpus. L hypothese la plus
economique est que l identifiant l emporte sur l enonce, mais elle
reste une hypothese : rien ici ne l etablit, et seul le rejeu bloque
pourrait la trancher.

### Les denominateurs amputes que le bloc 2 ferme

Quatre pre-scans sur dix-neuf ont ete juges sur un denominateur inferieur
a dix, trois sur neuf tests et un sur huit. Un cinquieme du corpus etait
donc note sur un bareme que le modele avait raccourci lui-meme. Ces
quatre-la sont mecaniquement fermes par le bloc 2, sans rien attendre
d un rejeu.

## 7. Le rejeu, execute le 2 aout 2026

Vingt-six decks du corpus, trois passes chacun, sur le pre-scan issu
des blocs 1 et 2. Soixante-dix-huit passes lancees, soixante-six
exploitables.

### Quatre decks ne peuvent pas etre pre-scannes du tout

Quatre decks echouent aux trois passes, et la cause n est pas le
pre-scan. Deux depassent la limite de cent pages PDF de l API, deux
depassent la taille maximale du document encode. Ce sont des
memorandums d information, les plus lourds du corpus.

En production, `runPreScan` leve, la route attrape et poursuit avec
`preScan` a null, donc le pipeline complet tourne sans triage. **Quinze
pour cent du corpus n est jamais triee, et rien ne le signale.** Le
comportement de repli est le bon, un incident d API ne doit pas
empecher une analyse, mais il est muet la ou il devrait etre declare.
C est la meme forme que la non-production du bloc 2, restee en dehors
parce qu elle vit dans la route et non dans le moteur.

### La variance residuelle

```
verdict identique aux trois passes : 20/22  (91%)
score identique                    : 14/22  (64%)
vecteur des dix tests identique    : 13/22  (59%)
```

Le verdict tient sur vingt-deux dossiers sur vingt-deux moins deux. La
justification tient beaucoup moins : quatre dossiers sur dix rendent un
vecteur de tests different d une passe a l autre sans que le verdict
bouge. La lecture du 2 aout se confirme donc et se precise : ce qui
etait instable n etait pas d abord la conclusion, c etait le motif.

Ou vit ce qui reste :

```
                        instable sur   echecs
narrative     jugement       1/22       0/66
founder       jugement       1/22       1/66
financial     jugement       4/22       1/66
market        jugement       1/22       0/66
thesis_fit    jugement       4/22       0/66
stage_ticket  comparaison    1/22       6/66
sector_fit    comparaison    0/22       0/66
geography_fit comparaison    0/22       0/66
ticket_fit    comparaison    1/22       1/66
stage_fit     comparaison    0/22       0/66
```

Trois des cinq comparaisons ne bougent jamais. Les deux qui bougent ne
bougent pas d elles-memes : elles sont deterministes par construction,
et l instabilite leur vient des faits. Le fait `sector` varie sur deux
dossiers, `stage` sur deux, `ticketEur` sur un, et cette variation
traverse la comparaison sans que celle-ci y soit pour rien.

La conclusion de conception est que sortir un test du jugement ne le
sort pas du modele. Elle deplace le point de variance de l appreciation
vers l extraction, ou il est beaucoup plus facile a voir, a citer et a
contredire, mais elle ne le supprime pas.

### Le cas qui le montre, et qui corrige une limite du bloc 1

Sur Pen Group, la troisieme passe extrait un ticket de 51 250 000 euros
la ou les deux premieres lisent 5 125 000. Un facteur dix, avec une
citation a l appui dans les trois cas. La comparaison fait alors
exactement ce qu on lui demande et rend `fail` sur `ticket_fit`, ce qui
fait basculer le verdict.

La garde anti-divination attrape le fait absent et le fait sans
citation. Elle n attrape pas le fait faux. Une valeur citee mais mal
lue passe toutes les defenses, et le determinisme de la comparaison
donne alors a l erreur l apparence d un calcul. C est une limite a
inscrire au meme rang que les autres, et elle n a pas de correctif
evident : un controle de vraisemblance sur le ticket croiserait a
nouveau le stade, donc reintroduirait un jugement.

### Les eliminations

```
verdicts sur 66 passes : pipeline_with_caveats 36, ready_for_pipeline 29,
                         not_recommended 1
decks elimines aux trois passes            : 0/22
decks elimines au moins une fois sur trois : 1/22
```

Une seule elimination en soixante-six passes, sur Ytterbium, et elle ne
tient qu a une passe sur trois : `founder` y rend `fail` au troisieme
tirage et `pass` aux deux premiers. C est le dernier cas de la propriete
qui a ouvert la grappe, une porte dont l ouverture depend du tirage, et
il ne concerne plus qu un dossier sur vingt-deux. Il porte aussi sur un
test de jugement, ce qui est desormais le seul endroit ou il puisse
porter.

Aucun deck n est elimine aux trois passes. Le taux d elimination du
dispositif est donc, sur ce corpus et apres les deux blocs, de l ordre
d une passe sur soixante-six, contre quinze verdicts `not_recommended`
sur cinquante-trois runs historiques. La comparaison est indicative et
non rigoureuse : ce ne sont ni les memes conditions ni le meme nombre
de passes par dossier.

### In Haircare

Trois passes, trois fois `ready_for_pipeline`, neuf sur dix, avec des
faits rigoureusement identiques : secteur `Consumer`, zone `France`,
stade `growth`, ticket 800 000 euros. Le dossier qui a ouvert la grappe
obtient desormais le verdict le plus favorable des trois, de facon
reproductible.

Une correction au passage, contre ce que la note et les tests du bloc 1
supposaient. J avais ecrit que le stade n etait pas revendique et que
`stage_ticket` serait non produit. Le modele derive en realite un stade,
`growth`, et le test rend `fail`, puisque 800 000 euros sont tres en
deca de la fourchette usuelle d un growth. L echec est stable, motive et
non eliminatoire, mais mon hypothese de depart etait fausse : le
fixture du test portait une supposition sur le dossier, pas une lecture.

### L hypothese thesis_fit n a pas pu etre testee

La mesure demandee etait une passe supplementaire, sur les seuls
dossiers ou `thesis_fit` echouait, avec l identifiant renomme et
l enonce inchange.

**Sa condition ne s est jamais presentee : `thesis_fit` echoue zero fois
sur soixante-six passes**, la ou il etait le premier motif d elimination
du corpus historique, seul dans trois cas et associe dans trois autres
sur treize eliminations lisibles. La passe renommee n a donc tourne sur
aucun dossier.

Le resultat est spectaculaire et il ne prouve pas l hypothese. Deux
explications au moins le produisent, et le rejeu ne les separe pas. La
premiere est celle du brief, l identifiant cadre la lecture avant
l enonce, comme la ligne « Tour » des onze prompts. La seconde est au
moins aussi economique : le bloc 1 a retire la these du fonds du prompt,
donc le modele n a plus sous les yeux la matiere avec laquelle il
echouait ce test. On a supprime la cause possible en meme temps que le
symptome.

Ce qui trancherait est un protocole a deux bras et non une passe de
plus : reintroduire la these dans le prompt, puis faire varier le seul
identifiant entre les deux bras. Cela suppose de reconstruire une
version du prompt que le produit n a plus, et cela ne se fait pas en
marge d une grappe. L hypothese reste donc une hypothese, et elle est
desormais plus difficile a tester qu avant, ce qui est le prix d avoir
corrige d abord.

### La non-production, exercee d un seul cote

Soixante-neuf tests non produits sur soixante-six passes, tous de cause
`absence`, aucun de cause `incident`. Le modele a rendu ses cinq tests
de jugement a chaque passe : la branche que le bloc 2 a ouverte pour les
omissions n a pas ete empruntee une seule fois, et la regle qui interdit
d eliminer sur un incident n a donc pas ete exercee.

Les absences, elles, disent quelque chose du corpus. Le stade est nul
aux trois passes sur sept dossiers, le ticket sur onze, soit la moitie.
Ce sont pour l essentiel des memorandums d information de cession, et le
constat rejoint celui de la grappe 4 : le dispositif presuppose une
levee, et la moitie du corpus n en est pas une.

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
