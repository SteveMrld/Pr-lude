# Grappe 6, la tracabilite

Derniere grappe critique avant qu un fonds puisse voir le produit. Le
sujet n est pas technique : un acheteur institutionnel demandera a
rejouer une instruction sur pieces, et la reponse etait non.

## 1. Les mesures anterieures au 2 aout sont des bornes inferieures

Consequence du bloc 1, plus lourde que l exhaustivite qui le motivait.

La mesure passait par `addCall`, appele par le moteur **apres** un
retour reussi du modele. Un appel qui echouait et reussissait a la
reprise ne comptait donc qu une fois, et un appel qui echouait
definitivement ne comptait pas du tout. Le client SDK est configure
avec `maxRetries: 1`, donc chaque appel peut valoir deux appels reels
factures.

Toutes les mesures de duree et de tokens produites avant le commit
0cb0dc6 sont donc **des bornes inferieures et non des mesures**. Cela
vaut pour celles qui ont servi a dimensionner les fenetres de deadline
au brief 15 : les fenetres ont ete calibrees sur un cout sous-estime,
d une ampleur inconnue qui depend du taux de reprise reel.

Le registre pose au bloc 1 enregistre l appel avant de savoir s il
reussira, et re-leve l erreur apres l avoir enregistree. Le prochain
run donnera l ecart entre l ancienne et la nouvelle mesure sur un meme
dossier, et c est ce chiffre qu il faudra regarder avant de reutiliser
une fenetre calibree.

## 2. Le modele appele devient verifiable

Second gain du meme deplacement, et il porte sur le stamp lui-meme.

Le version stamp declarait le modele de chaque moteur en le lisant dans
son registre statique, `LLM_ENGINES`, ou chaque entree porte `model:
'primary' | 'fast' | 'mixed'`. C etait une declaration d intention, pas
une observation : si un moteur appelait un autre modele que celui que
le registre lui prete, rien ne l aurait montre, et le `modelsHash` du
fingerprint aurait affirme une identite fausse entre deux runs.

Le registre du bloc 1 lit le modele dans les parametres reels de la
requete. La comparaison entre les deux devient possible, et tout ecart
entre le modele declare et le modele appele se voit. Aucun ecart n est
etabli a ce jour : la verification n existait pas, donc son absence de
resultat ne prouve rien.

## 3. Les prompts systeme sont tous statiques

Lecture faite au bloc 2, avant ecriture, sur les trente-trois
declarations de prompt systeme du depot.

Aucune n est construite dans une fonction : toutes sont au niveau
module. Les seules interpolations qu elles contiennent sont deux
constantes importees, `SOURCE_TAGGING_INSTRUCTION` et
`EDITORIAL_VOICE_INSTRUCTION`, elles-memes des litteraux statiques.
Aucune donnee de dossier n entre dans un prompt systeme ; ce qui varie
par dossier vit dans les `userPrompt`, construits a l appel, et n a pas
vocation a entrer dans l empreinte puisqu il change legitimement d un
dossier a l autre.

Un hash de prompt systeme est donc stable entre deux runs du meme code
et bouge si un prompt change. C etait la condition posee : un hash
mouvant aurait ete pire qu une empreinte absente, il aurait donne
l illusion d une mesure.

Obstacle de cout releve au passage : deux prompts sur trente-trois sont
exportes, trente et un ne le sont pas. Les hasher par import suppose de
les exporter.

## 4. Mesure finale, et ce que le stamp garantit

### Les appels au modele

Quarante-quatre sites d appel dans le depot, dont quatorze deposaient
une mesure avant la grappe. Le chiffre de reference du brief, onze sur
vingt-six, datait du 1er aout et six briefs l avaient perime.

Le compte des sites mesures n a plus de sens depuis le bloc 1, et c est
le resultat recherche. La mesure ne se fait plus au site d appel mais
au point de passage unique vers le SDK : les dix `messages.create` du
client Anthropic sont tous derriere `getClient`, dont le
`messages.create` est enveloppe. Les quarante-quatre sites sont donc
mesures, y compris `callClaudeMultiDocs` qui vit dans
dd-technical-engine et n emprunte aucun des trois helpers exportes, et
un moteur ajoute demain le sera sans que personne n y pense. La bonne
formulation n est plus « combien de sites sont mesures » mais « un site
peut-il ne pas l etre », et la reponse est non.

### Ce que le stamp couvre

Six champs entrent dans le fingerprint : `commitSha`, `doctrineHash`,
`configsHash`, `enginesHash`, `inputsHash`, `modelsHash`. Les
vingt-neuf moteurs portent une empreinte de prompt, contre zero sur les
cinq derniers runs de production, et le `doctrineHash` agrege les
trente-trois prompts systeme du depot.

**Ce que deux runs portant le meme fingerprint garantissent.** Ils ont
tourne sur le meme code applicatif, au commit pres. Sur la meme
doctrine, c est-a-dire sur des prompts systeme identiques mot pour mot,
ce que le stamp ne savait pas dire jusqu ici. Sur les memes
calibrations de scoring, poids de dimensions et seuils de verdict. Sur
les memes entrees, deck, texte et business plan au hachage pres. Et sur
le meme regime de sampling, modele et temperature par moteur.

Un acheteur qui compare deux runs de meme fingerprint et observe deux
verdicts differents tient donc une variance imputable au modele seul,
et non a une derive de version, de doctrine ou d entree. C est la
propriete que le produit doit pouvoir promettre.

**Ce qu ils ne garantissent toujours pas.** Trois choses, et il faut
les dire avant qu un acheteur les trouve.

D abord, les prompts utilisateur ne sont pas couverts. Seuls les
prompts systeme entrent dans l empreinte. Ce qui varie par dossier est
construit a l appel, et l assemblage de ces blocs, injection
sectorielle, cadrage macro, verdicts de pertinence, peut changer sans
que le fingerprint bouge. Deux runs de meme fingerprint peuvent donc
avoir recu des prompts utilisateur differents si le code d assemblage a
change entre-temps sans changer le commit, ce qui est impossible, ou si
une donnee amont a change, ce qui est couvert par `inputsHash` pour le
deck mais pas pour les fiches sectorielles.

Ensuite, les donnees externes ne sont pas dans l empreinte. Deux runs
identiques a tous egards peuvent avoir interroge des sources qui ont
repondu differemment, ou echoue pour l un et pas pour l autre. Le
journal de recolte de la grappe 5 rend cette difference lisible apres
coup, il ne la fait pas entrer dans le fingerprint.

Enfin, le fingerprint ne dit rien du non-determinisme du modele
lui-meme. Deux runs de meme fingerprint peuvent rendre deux verdicts
differents, et c est meme tout l interet de la propriete : elle isole
cette variance au lieu de la confondre avec les autres. Ce que le
produit peut promettre est un verdict reproductible dans une plage
mesurable, pas un texte identique.

### Ce que le prochain run devra verifier

Le cout mesure doit **remonter** par rapport aux runs precedents.

La mesure passait par `addCall`, appele apres un retour reussi. Un
appel qui echouait puis reussissait a la reprise ne comptait qu une
fois, un appel definitivement echoue ne comptait pas, et le client
porte `maxRetries: 1`. Le registre du bloc 1 enregistre l appel avant de
savoir s il reussira et re-leve l erreur apres l avoir enregistree.

Si le cout total en tokens et en duree ne bouge pas sur un dossier
comparable, la conclusion n est pas que le taux de reprise est nul :
c est que quelque chose n est pas branche. Le controle a faire est
donc double, `llmLedger.totalCalls` non nul dans `result_json.meta`, et
comparaison du cumul avec un run anterieur du meme deck. Un ecart nul
sur les deux est un signal d alarme, pas une confirmation.
