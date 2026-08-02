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
