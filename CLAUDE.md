# CLAUDE.md

Brief de contexte pour toute session Claude Code lancee dans le
repo Prelude. A lire en entier avant tout travail.

## Identite du projet

Prelude est une plateforme d instruction de dossiers de venture
capital, vendue aux fonds institutionnels (Eurazeo, Tikehau,
Ardian, Axa Equity et homologues europeens). Le positionnement
commercial est Palantir vertical du capital risque, avec un tarif
cible 15 a 25 mille euros par mois et par fonds. La plateforme se
distingue des outils existants (Affinity, Carta, PitchBook, decks
manuels) par sa rigueur doctrinale et son refus de la complaisance.

Le produit livre une note d instruction de 4 a 8 pages pour chaque
dossier analyse, plus un dashboard analytique qui detaille chaque
moteur. La note se lit comme une dissertation Le Grand Continent,
pas comme un rapport SaaS.

## Architecture technique

Stack principale : Next.js 14 App Router, TypeScript, Tailwind, et
Supabase pour la persistence et l auth. Hebergement Vercel.

Le coeur du produit est un pipeline de moteurs d analyse
sequentiel et parallele dans `app/api/analyze/route.ts`. Chaque
moteur est un module dans `lib/engines/` qui implemente une these
analytique calibree sur la doctrine. Le pipeline orchestre quatorze
moteurs en early stage et neuf moteurs en growth, selon le track
choisi par le partner en page d entree.

Les sept patterns du moteur Fragilite structurelle (Phase 4) sont
dans `lib/engines/fragility-structurelle/`. Chaque pattern a sa
fiche doctrinale dans `docs/patterns/` qui sert de source de
verite pour le SYSTEM_PROMPT de l implementation TypeScript.

Le moteur Trajectoire (Score de Trajectoire) est dans
`lib/engines/trajectory/`. Il consomme deux ou plusieurs analyses
du meme dossier pour calculer les deltas de scores et les
combinaisons diagnostiques apparues, resolues, persistantes.

## Preferences personnelles de Steve

Steve communique en voix dictee mobile. Les transcriptions sont
souvent imprecises. Interprete l intention plutot que les mots
exacts. Si la transcription est incoherente avec le contexte,
signale-le et propose ta lecture la plus probable.

Voix editoriale Le Grand Continent ou The Atlantic dans tout ce
que tu produis : prose dense, phrases longues quand le sujet le
justifie, peu de listes a puces, peu de gras, peu de headers
decoratifs.

Pas d em-dashes (—) dans les textes que tu produis. Tirets simples
ou virgules a la place.

Pas de flatterie. Pas de Excellente question, pas de Tu as
raison de, pas de Tout a fait, pas de recap emerveille du
travail accompli.

Tu agis comme tech lead autonome. Tu executes les changements sans
demander de validation a chaque etape. Tu fais des commits propres
tagues (feat, fix, refactor, docs, test, chore). Les messages de
commit sont denses, prose en francais, expliquent le pourquoi et
la portee structurelle, pas juste le quoi.

Tu pushes directement sur GitHub. Tu ne lui envoies jamais de
blocs de code a appliquer manuellement. Si tu n as pas de token
configure, tu le demandes.

Tu ne proposes jamais d arreter une session ou de reporter le
travail. C est Steve qui decide quand on arrete. Tu continues ou
reprends quand il demande, sans suggerer de pause.

Quand Steve demande des modifications, elles doivent etre
structurelles (au niveau des moteurs, des prompts, des matrices
de configuration), pas cosmetiques (juste l affichage ou le
formatage). Un changement structurel beneficie a tout
l ecosysteme, pas seulement a un cas particulier. Toujours
privilegier la racine du probleme sur le symptome visible.

## Discipline tests et build

Avant chaque commit, lance tsc et la suite de tests. Ne commit
jamais avec des erreurs de typage ou des tests rouges. Les
commandes utiles :

```
npx tsc --noEmit
npx tsx lib/engines/<nom>.test.ts
```

La suite globale compte plus de 700 tests deterministes. Les
tests sont en TypeScript pur, executables avec tsx, sans framework
de tests externe (pas de Jest, pas de Vitest). Le pattern :
fonctions check et checkTrue qui incrementent des compteurs pass
et fail, plus un process.exit final.

Les tests qui necessitent un appel LLM reel (calibration des
patterns, tests E2E du pipeline) ne sont pas dans la suite
deterministe. Ils sont dans des scripts a lancer separement avec
ANTHROPIC_API_KEY configuree.

## Discipline de mesure

Une mesure de couverture qui trouve des trous se confirme en lisant la
structure, jamais en comptant des occurrences de texte.

La regle est nee de trois erreurs en une semaine, toutes de la meme
forme. Une mesure de la table de benchmarks par appel a
getSectorMultiples a conclu que la colonne series-c-plus etait vide sur
les vingt et une classes : elle mesurait en fait un normaliseur qui ne
lisait pas sa propre sortie, et la table etait complete. Une mesure de
couverture de baseExits par expression reguliere a conclu que trois
classes manquaient : la regex excluait les chiffres, et saas-b2b,
marketplace-b2c et services-b2b portent tous un chiffre dans leur nom.
Une mesure du nombre de sites portant une cause de non-production a
compte des occurrences de type et de commentaire avec les vrais sites.

Deux de ces trois erreurs ont fait ecrire un diagnostic faux dans un
brief avant d etre corrigees.

En pratique, quand une mesure conclut a une lacune, refaire la lecture
en interrogeant l objet et non son texte : parcourir les clefs de la
table plutot que grepper ses litteraux, appeler la fonction sur chaque
valeur du catalogue plutot que compter ses branches, lire le type
plutot que ses mentions. Le cout est de quelques lignes de script, et
il se paie une fois contre un diagnostic faux qui oriente un brief
entier.

Le corollaire vaut aussi : une mesure qui ne trouve aucun trou est
moins suspecte, mais elle merite la meme lecture structurelle quand
elle sert a affirmer qu un correctif couvre tout.

Second corollaire, ajoute le 3 aout 2026 : une mesure faite avec un
instrument de la meme nature que ce qu elle evalue ne borne rien. Il a
sa section propre plus bas, parce qu il a rencontre depuis une seconde
forme qui ne parle plus de mesure du tout.

Troisieme corollaire, ajoute le 3 aout 2026 : mesurer sur la bonne
table n est pas un detail d execution, c est la question elle-meme.

Pour savoir ce que l absence du cron de detection de jalons avait
coute, j ai mesure `analysis_outcomes`, qui portait onze lignes de
juillet. Le selecteur lit `realized_outcomes`, qui est vide. Les deux
noms se ressemblent, les deux tables parlent de dossiers dont l issue
est connue, et la premiere mesure aurait conclu sur onze dossiers dont
aucun n entre dans le champ du cron. La conclusion n a pas ete affinee
en lisant quelle table le code interroge, elle a change de nature.

La faute est de la meme famille que les precedentes, avec un cran de
plus : les autres portaient sur la maniere de lire l objet, celle-ci
sur l identite de l objet. Une mesure irreprochable sur le mauvais
support ne se detecte par aucune relecture de sa methode, puisque sa
methode est juste. Le seul controle est de remonter du code au support,
jamais du nom au support.

En pratique, avant de mesurer ce qu un module produit ou omet, lire
dans le module quelle table, quel champ, quelle date il interroge, et
mesurer exactement ceux-la. Le detour coute une lecture de fonction.

## Un instrument qui ne borne pas son objet

Un dispositif de controle peut etre exact et ne rien apprendre. La
faute ne porte alors ni sur sa methode ni sur son resultat, mais sur le
rapport entre lui et ce qu il pretend tenir, et c est pourquoi elle
survit a toutes les relectures : il n y a rien a corriger dans ce qu on
lit.

La premiere forme est la mesure faite avec un instrument de la meme
nature que son objet. Le detecteur d evenements cherche un fait date
dans de la prose par expression reguliere. Pour mesurer son taux de
faux positifs, j ai classe ses sorties en faits et en constats, par
expression reguliere. La mesure a rendu dix-huit pour cent, et elle a
classe « le pitch articule un scenario chiffre vers la profitabilite »
comme un fait date. Le taux reel est donc superieur, d un montant que
cette mesure ne peut pas donner, puisqu elle echoue exactement la ou
l objet mesure echoue.

Une telle mesure garde une valeur : elle etablit un plancher et elle
compare un avant a un apres, ce qui suffit a dire qu un resserrage a
ameliore quelque chose. Elle ne donne pas de niveau. La regle est donc
d annoncer le chiffre comme un plancher et jamais comme un taux, et de
dire par quoi la mesure est bornee. Quand un jugement est necessaire
pour mesurer un jugement, la seule sortie est une lecture humaine sur
un echantillon, ou une mesure indirecte par une consequence observable
qui, elle, se compte.

La seconde forme est le cachet lu au mauvais endroit, et elle ne parle
plus de mesure mais d identite. Le champ `temperature` du version stamp
valait `api-default` pour les trente moteurs. La valeur etait exacte :
aucun site d appel ne construisait le parametre, ni `callClaude` ni
`callClaudeWithUsage` ne savaient le porter. Le cachet disait donc la
verite sans rien apprendre a personne, et deux runs a temperatures
differentes auraient rendu le meme `enginesHash`. Comme la calibration
segmente sur ces empreintes, deux instruments se seraient melanges dans
le meme segment sans que rien ne le signale. Le cachet etait lu la ou
la valeur est declaree, et non la ou elle est decidee.

Les deux formes ont le meme squelette. Un dispositif de controle
n a de pouvoir que par sa difference avec ce qu il controle, et il perd
ce pouvoir de deux facons : en partageant le mode de defaillance de son
objet, ou en etant preleve en amont de l endroit ou l objet se decide.
Dans les deux cas il rend un resultat juste, ce qui est precisement le
probleme, puisqu un resultat faux se remarque. Le heartbeat de la
plateforme est la meme chose vue une troisieme fois, ou l instrument ne
partage pas seulement la nature de son objet mais son mode de panne.

En pratique, deux questions se posent devant tout controle avant de
croire ce qu il rend. Par quoi echouerait-il, et est-ce la meme chose
qui ferait echouer ce qu il mesure. Et ou la grandeur qu il rapporte
est-elle decidee, par rapport a l endroit ou il la prend. Une reponse
franche a la premiere degrade le chiffre en plancher ; une reponse
franche a la seconde deplace le point de prelevement, ce qui est
toujours possible et generalement peu couteux.

## Discipline de precision

Une precision non donnee ne doit pas produire une severite qu elle ne
fonde pas.

La regle est nee le 3 aout 2026 sur l ancre temporelle du module de
validite d operation, mais elle ne lui appartient pas. Un document qui
porte « 2023 » sans mois n autorise pas a le traiter comme s il datait
de janvier : le lire ainsi ferait declencher une reserve sur tout
evenement de l annee, alors que le document a pu etre ecrit en
decembre. L ancre se pose donc en fin d annee, et seul un evenement
clairement ulterieur declenche quelque chose.

Le principe se formule sans son cas : quand une donnee arrive moins
precise que le calcul qui la consomme, l arrondi se fait du cote qui
retient la conclusion, pas du cote qui la produit. Une date partielle
s arrondit vers le tard quand on cherche ce qui lui est posterieur, et
vers le tot quand on cherche ce qui lui est anterieur. Un montant sans
unite n est pas un montant. Un stade non revendique n est pas un stade
deduit du chiffre d affaires.

C est le pendant de la regle anti-divination, qui interdit d inventer
une valeur absente. Celle-ci interdit d inventer une precision absente,
ce qui est la meme faute a un cran de subtilite : la valeur est bien
la, mais on lui prete une finesse qu elle n a pas, et cette finesse
seule suffit a faire basculer une conclusion.

## Une regle de conformite porte sur le code, pas sur le commit

Un controle qui verifie qu on execute bien ce qu on a relu doit comparer
ce qui produit le resultat, jamais ce qui date le depot.

La regle est nee le 3 aout 2026, a l entree du dernier run de gel. Le
premier etage de la relecture exigeait que `app.commitSha` porte un sha
precis, sous peine d arret. Entre l ecriture de cette exigence et le
lancement, deux commits n avaient touche que `docs/`. Le sha ne
correspondait donc plus, et la regle demandait d arreter un run dont le
code etait identique a l octet pres a celui qu elle protegeait : meme
`enginesHash`, memes empreintes de prompts, memes hachages de fichiers
sources. Elle aurait fait perdre un run entier et dix minutes pour une
divergence qui n existait pas.

La faute est de prendre un identifiant pour la chose qu il designe. Un
sha de commit date un etat du depot entier, documentation comprise ; ce
qu on veut verrouiller est l etat du code qui va s executer. Les deux
coincident presque toujours, ce qui rend la confusion invisible jusqu au
jour ou un commit de prose les separe. C est la meme famille que la
mesure faite sur la mauvaise table : la methode est irreprochable et
l objet est faux, donc aucune relecture du controle ne le revele.

Le dispositif juste existe deja et il est dans le depot. Le version
stamp calcule des empreintes par moteur, un `enginesHash` et un hachage
de doctrine des prompts, precisement pour dire si deux runs ont
rencontre le meme code. C est lui l objet de comparaison, et le sha n en
est qu une approximation commode.

En pratique, une regle de conformite s ecrit sur l empreinte quand elle
existe. Quand elle s ecrit quand meme sur un sha, par commodite, elle
doit porter sa clause de sortie : un sha different dont le diff ne
touche aucun fichier execute satisfait la regle, et la preuve tient en
une commande. Ce qui ne doit jamais arriver, c est qu un run soit arrete
ou lance sur la foi d un identifiant que personne n a remonte jusqu au
code.

La regle a depuis son organe, `scripts/conformite-relecture.ts`, ajoute
le 4 aout 2026, parce qu un commentaire seul n est ni un point de
passage, ni une garde de contrat, ni un test. Il lit la reference dans le
version stamp du dernier run persiste plutot que dans une constante
ecrite a la main, rend son verdict sur `doctrineHash`, `enginesHash` et
`modelsHash`, et imprime le sha et les configs a cote du verdict sans
leur donner de voix. La liste des fichiers qui different quand le sha
bouge seul est une piece a conviction et non un juge : trancher a partir
d elle demanderait de tenir a la main la liste des fichiers executes,
c est-a-dire de reintroduire la faute par l autre bout.

Le corollaire se prend par l autre bout et il coute plus cher, parce
qu il fabrique des defauts qui n existent pas. Deux runs a des commits
differents ne sont pas deux tirages du meme systeme, et les comparer
pour mesurer une variance mesure le changement de code, pas la variance.

Le cas est du 3 aout 2026. Le meme memorandum, analyse a seize heures
d intervalle, ressortait classe `industrial-hardware` puis `saas-b2b`,
et la conclusion evidente etait une instabilite de l arbitrage de classe
d actif, assez grave pour interdire un gel puisque la fourchette varie
d un facteur six entre les deux classes. La lecture des cinq extractions
persistees a rendu l inverse : `sector` vaut « SaaS » sur les cinq,
`subSector` et `businessModel` disent la meme chose, la chaine de
production detectee vaut `hardware-physical` sur les cinq, et les trois
champs qui lisent du logiciel sont les memes partout. L entree ne bouge
pas. Ce qui a bouge est le code : `arbitrerClasseActif` est apparu au
commit `d533d92` et n est devenu effectif qu au commit `24b9142`, entre
les deux runs. Le premier run n avait pas d arbitrage, le second en a
un, et la trace persistee ne figure que dans le second. Ce ne sont pas
deux tirages, ce sont deux systemes.

Le releve etendu au corpus le confirme et donne la bonne question.
Quatre dossiers ont ete analyses plusieurs fois ; toutes les bascules de
classe observees coincident avec un changement de commit, et les seules
paires de runs partageant un meme sha rendent la meme classe. Le releve
est mince, deux paires seulement, donc il etablit un plancher et pas un
taux, et il faut l annoncer ainsi. Mais il suffit a dire que la question
n etait pas « ce dossier a-t-il bascule » mais « la bascule survit-elle
a commit constant », et que personne ne l avait posee sous cette forme.

En pratique, avant d attribuer une variance a un moteur, lire le
`commitSha` des runs compares. S ils different, la seule mesure valide
est un rejeu a code egal, et le stamp existe precisement pour rendre
cette lecture possible. Une variance mesuree entre deux versions n est
pas une variance, c est un diff.

## Retirer la declaration plutot que la mettre a jour

Quand une liste ecrite a la main se revele incomplete, le reflexe est de
la completer. C est presque toujours le mauvais geste : une liste
incomplete ne l est pas par accident, elle l est parce qu elle enumere
ce que son auteur avait en tete un jour donne, et la completer reconduit
exactement cette propriete. Le bon geste est de chercher la propriete
observable qui distingue les elements a retenir, et de supprimer la
liste.

La semaine du 3 aout 2026 en a donne trois cas, ce qui en fait un motif
et non une anecdote.

La detection d evenements enumerait quatre chemins de champs du moteur
Equipe. L evenement cherche vivait dans le moteur Fragilite structurelle
et aucun ajout de chemin raisonnable ne l aurait attrape. La liste a ete
remplacee par un parcours structurel qui descend dans l objet et retient
toute chaine assez longue pour porter une phrase.

La garde de confidentialite des prompts nommait six noms de code de
dossiers reels a interdire. Le nettoyage des prompts a retire ces noms,
la garde s est retrouvee sans objet, et allonger la liste n aurait
protege que contre les noms deja connus. Ce qui se verifie est desormais
la forme du marqueur, un nom de code forme de Project suivi d un nom
d animal ou de relief, ce qui couvre les six retires et tous les
suivants sans nommer personne.

La collecte des sources de la reserve de validite enumerait trois
moteurs. La liste avait ete ecrite en regardant un run early stage ; le
parcours growth neutralise le premier des trois, et la note est sortie
sans reserve sur un dossier dont un quatrieme moteur portait deux
mentions datables. Le critere est desormais que la prose du moteur porte
une citation de source externe, propriete des donnees et non nom, si
bien qu un moteur ajoute demain entre sans qu on y pense et qu un moteur
qui raisonne sur le seul document reste dehors sans qu on l exclue.

Les trois cas partagent leur forme. La liste est une declaration sur le
monde, faite a un instant, par quelqu un qui regardait un cas ; elle
vieillit des que le monde bouge, et rien ne signale son vieillissement
puisqu elle continue de rendre des resultats plausibles. La propriete
observable, elle, est evaluee a chaque execution sur les donnees
presentes, donc elle se deplace avec ce qu elle decrit.

Le test qui distingue les deux se pose avant d ecrire la liste : si un
element etait ajoute au systeme demain, faudrait-il modifier cette
liste pour qu il soit traite correctement. Si oui, la liste est une
dette a echeance inconnue, et il faut chercher ce qui rend ses membres
semblables plutot que les nommer.

Deux reserves, parce que la regle n est pas absolue. Une propriete
observable peut etre plus large que voulu, et il faut alors une
exclusion explicite, courte et motivee : la collecte des sources exclut
la sortie du module de validite lui-meme, sans quoi elle relirait au
rejeu la mention qu elle vient d ecrire. Et certaines listes sont
legitimes parce qu elles portent un arbitrage plutot qu un inventaire,
comme les seuils de verdict : leur contenu ne se deduit d aucune
propriete, il se decide. La question est donc de savoir si la liste
constate ou si elle tranche. Une liste qui constate se remplace ; une
liste qui tranche se garde et se date.

## Borner une cause ne protege pas quand l effet depend d autre chose

Une garde qui limite l intensite d une cause ne protege de rien si
l effet redoute ne depend pas de cette intensite. Il faut alors chercher
de quoi il depend reellement, et c est presque toujours une proximite
plutot qu une amplitude.

La regle est nee le 4 aout 2026 sur la comparabilite d un verdict.
Le probleme etait qu un score calcule sur une assiette partielle, quatre
dimensions sur six, pouvait rendre un verdict different de celui qu une
assiette pleine aurait rendu. La garde attendue etait un plancher de
poids evalue : en dessous d un certain poids, ne plus rendre de verdict.
C etait borner la cause par son intensite, et la mesure l a refuse.

Sur les onze analyses dont les six dimensions avaient ete evaluees, en
retirant une puis deux dimensions, deux cent trente et un cas : le
deplacement du score est petit, mediane un demi-point, maximum cinq.
Mais pres de cinq pour cent des cas changent de verdict, et ces bascules
ne decroissent pas avec le poids. Il y en a a quatre-vingt-cinq pour
cent de poids comme a soixante-trois. La raison se voit une fois
formulee : une bascule ne demande pas un grand deplacement, elle demande
un score proche d un seuil. Un plancher aurait donc laisse passer des
bascules au-dessus de lui et refuse des verdicts stables en dessous,
c est-a-dire echoue dans les deux sens a la fois.

La forme generale se lit sans son cas. Quand un effet se produit par
franchissement d un seuil, il depend du produit de deux grandeurs, le
deplacement possible et la distance au seuil, et borner la premiere seule
ne dit rien. La garde juste compare les deux. Elle a une propriete qu un
plancher n a pas : elle est inerte quand le deplacement est nul, et elle
se declenche a n importe quelle intensite des lors que la marge est plus
petite. Elle n est donc pas monotone dans la cause, ce qui est
exactement ce qui la rend correcte et ce qui la faisait paraitre
compliquee.

En pratique, devant une garde a ecrire, nommer l effet redoute puis
demander de quoi il depend, plutot que de borner ce qui saute aux yeux.
Si l effet est un franchissement, la reponse comporte toujours un terme
de position que l intensite seule ignore.

Corollaire de methode, et c est la faute la plus difficile a voir
puisque tout devient vert. Trois assertions du verrou de comparabilite
avaient ete ecrites sur l intuition qu un score a mi-bande resterait
comparable a soixante-cinq pour cent de poids. La mesure disait le
contraire. Il y avait deux facons de rendre la suite verte : changer le
test, ou baisser la constante jusqu a ce que l assertion passe. La
seconde aurait produit une suite verte, une garde plus permissive, et
aucune trace du desaccord. Ajuster une borne pour obtenir la reponse
attendue est calibrer l instrument sur la conclusion, et cela ne laisse
aucun signe : le test ne rougit pas, le code ne ment pas, il ne reste
qu une constante dont plus personne ne sait qu elle a ete choisie apres
coup. La regle est donc qu une constante mesuree ne se retouche jamais
pour faire passer une assertion. Soit l assertion avait tort et elle
change, soit la mesure etait mauvaise et elle se refait, et dans les
deux cas cela s ecrit.

## Discipline des jeux d essai

Un repli qui rend la meme valeur que sa source rend la source invisible
a toute mesure de dependance. Corollaire : un jeu d essai doit faire
diverger une source de son repli, sinon il mesure leur identite et pas
la dependance.

La regle est nee le 3 aout 2026 du verrou du graphe de dependances.
Le moteur de benchmarks lit `financialData.currentRound.amount` avec un
repli sur `extraction.fundraise.amount`. Le jeu d essai portait le meme
montant des deux cotes : vider la source rendait exactement la meme
sortie, et la dependance paraissait fausse alors qu elle etait
seulement masquee par son propre repli.

C est le pendant, cote verification, de ce que la semaine a rencontre
trois fois cote production : une chose qui existe mais que rien
n exerce. Le parametre jamais passe, le champ jamais rempli, la regle
ecrite dans un commentaire et appliquee a une ligne. Ici la chose est
exercee mais la mesure ne peut pas la voir, ce qui produit le meme
resultat, une couverture affirmee et absente.

En pratique, quand un jeu d essai doit prouver qu une sortie depend
d une entree, il faut que cette entree porte une valeur que rien
d autre ne peut fournir. Un montant different du repli, un identifiant
qui n existe qu a cet endroit, une date qu aucune autre source ne
donne. La valeur n a pas besoin d etre realiste, elle a besoin d etre
discriminante.

Corollaire de redaction : ce qu un jeu d essai n exerce pas doit etre
imprime et non tu. Compter comme succes une assertion que le jeu ne met
pas en jeu revient a revendiquer une couverture qu on n a pas.

Second corollaire, ajoute le 3 aout 2026 : une fixture ecrite dans la
meme erreur que le code qu elle teste mesure leur accord, pas la
justesse.

La journee en a donne deux formes. Fixed Cost Trap et Growth Subsidized
Model lisaient trente et une clefs absentes de leur contrat, derriere un
`const f: any` qui empechait tsc de le dire. Les fixtures des huit tests
portaient les memes clefs inventees, six fois a l identique et sous le
meme `as any` : la clef fausse du moteur trouvait la clef fausse du jeu
d essai, les huit tests etaient verts, et les deux patterns rendaient un
snapshot vide sur tous les dossiers, y compris ceux qui arrivent avec un
business plan complet. Le cast ne desarmait pas un controle, il en
desarmait deux, et le second est celui qui aurait rattrape le premier.

L autre forme est la reimplementation. Le test du contrat de type
d operation rejouait dans son propre fichier une copie de la garde
post-parse, au motif que le moteur ne l exposait pas separement.
Le passage aux composantes a change la garde dans le moteur sans toucher
la copie, et quatorze assertions sont restees vertes en verifiant qu une
logique s accordait avec elle-meme, plusieurs jours apres que le moteur
avait cesse de l executer. Un test qui traverse une reecriture du module
qu il teste sans bouger ne le teste pas, et c est un signe qu on peut
chercher sans rien casser : il suffit de regarder si le commit qui a
reecrit le module a touche le fichier de test.

C est le pendant, cote jeu d essai, de la septieme discipline. Celle-ci
dit qu une fixture prouve que le code fait ce qu on lui demande et non
qu on lui a demande la bonne chose. Le corollaire descend d un cran : la
fixture ne prouve meme plus ce que le code fait, parce qu elle a ete
ecrite dans le meme systeme de croyance que lui, par la meme personne au
meme moment. Le desaccord est le seul organe de mesure d un test, et
deux ecritures de la meme hypothese n en produisent aucun.

En pratique, deux exigences. Le jeu d essai entre par la porte de la
production : il appelle la fonction exportee, et si elle ne l est pas,
c est elle qu on exporte et non elle qu on recopie. Et il se soumet au
meme controle de type que le code, sans cast de complaisance, faute de
quoi le compilateur ne tombe ni du cote mesure ni du cote mesurant. Le
controle qui reste, quand ces deux-la manquent, est de casser
volontairement une lecture et de compter ce qui rougit ; un chiffre nul
n est pas un test solide, c est un test absent.

## Ce qui vient d un document en porte l extrait, y compris les nombres

Une valeur acquise ailleurs que dans le raisonnement porte la trace de
son acquisition, sinon elle n est pas une lecture, c est une
affirmation. La regle a maintenant trois occurrences et elles ont la
meme forme, ce qui la fait passer du cas a la doctrine.

La premiere portait sur les sources web. La plateforme rendait les pages
atteintes a cote de la prose, le pipeline les jetait, et ce qui tenait
lieu de tracabilite etait un tag `[web : crunchbase]` ecrit de memoire
par le modele sur instruction du prompt. Un tag n est pas une source,
c est un souvenir qui a la forme d une preuve. Le releve sur quarante
analyses rendait quinze mille quatre cents revendications de lecture web
et zero URL.

La deuxieme portait sur les montants d operation. `amount` et
`valuation` sortaient sans citation, donc sans moyen de distinguer un
chiffre lu d un chiffre reconstitue, et la reparation a ete identique :
une evidence obligatoire, un refus sans elle.

La troisieme est du 5 aout 2026 et elle porte sur tous les nombres
extraits d un document. Le classeur de Project Hello porte 3334 cellules
numeriques ; aucune ne rend l une des quatre valeurs que l extraction a
inscrites. La plus proche de 2025 est une ligne d EBITDA de l annee
suivante, celles de 2027 et 2028 sont la ligne B2B et non le total, et
la seule qui vise la bonne ligne est approximee d un pour cent.

Le point commun n est pas le domaine, c est le rapport a la preuve. Un
chiffre sans son verbatim est le meme objet qu un tag `[web]` sans
capture : une affirmation sur un document que rien ne permet de
verifier. Il est meme plus dangereux, pour deux raisons. Un nombre ne se
relit pas, alors qu une phrase fausse accroche l oeil. Et un nombre
entre dans un calcul, donc il se propage la ou une phrase reste ou elle
est.

Trois exigences, et la deuxieme est celle qu on oublie.

Le verbatim est ce que le document ecrit, tel quel, sans normalisation.
La valeur normalisee en descend et jamais l inverse. Un systeme qui
fabrique un verbatim a partir d une valeur a inverse la dependance et ne
prouve plus rien, exactement comme un modele a qui l on demande de
reconstituer sa source.

Un ecart entre les deux au-dela de ce qu un arrondi peut couter est un
incident declare, jamais une correction silencieuse. Substituer la
valeur du verbatim effacerait la trace de la divergence, qui est
l information. Et le seuil ne se pose pas au jugement : il descend de la
precision que la valeur declare elle-meme, un demi de sa derniere
decimale, ce qui ne demande aucun arbitrage et ne vieillit pas. C est la
discipline de precision prise dans son sens direct.

Une valeur sans verbatim devient non fondee, de la meme bascule qu une
revendication de lecture web sans capture. Ce qui distingue une lecture
d une reconstitution est la trace, et son absence ne se compense pas par
la plausibilite du resultat.

En pratique, la question se pose devant toute donnee que le systeme va
chercher hors du raisonnement : si la source disparaissait, resterait-il
de quoi etablir ce qu elle a dit. Pour une page web c est l URL, la date
et l extrait. Pour un nombre c est le chiffre tel qu il est ecrit. Dans
les deux cas, la reponse « non » ne demande pas de couper l acquisition,
elle demande d ecrire la capture.

## Un multiple ne se calcule qu entre deux valeurs de meme nature

Un rapport entre deux nombres n est un multiple que si les deux nombres
mesurent la meme grandeur. Entre une valeur d entreprise et un prix
d actifs, le rapport existe arithmetiquement et ne veut rien dire.

Le cas est du 5 aout 2026, apparu pendant la collecte de comparables.
Made.com vaut 775 M£ a son IPO de 2021 ; en 2022, apres liquidation, la
marque et la propriete intellectuelle sont reprises pour 3,4 M£. Ecrire
que la societe a ete divisee par deux cent vingt-huit donne un chiffre
spectaculaire et faux : le second nombre est le prix d un actif
incorporel isole, vendu une fois que les stocks, les creances et les
baux ont ete realises separement. Ce n est pas ce que valait
l entreprise, c est ce que valait ce qui restait apres qu on l a
demontee.

La faute est facile a commettre et couteuse a porter. Facile, parce que
les deux nombres sont vrais, sourcables, et qu ils decrivent bien la
meme societe a deux dates. Couteuse, parce qu un partner qui connait le
dossier voit l erreur en trente secondes, et qu un ratio faux dans une
note detruit la confiance dans tous les ratios justes qui
l accompagnent.

Ce qui la rend generale plutot qu anecdotique est qu elle ne se limite
pas aux faillites. Le meme piege existe entre une valorisation
post-money et une valeur d entreprise, entre un prix d acquisition qui
inclut une reprise de dette et un autre qui ne l inclut pas, entre un
chiffre d affaires consolide et un chiffre d affaires a perimetre
constant. Dans tous les cas, deux nombres exacts et une operation licite
produisent une grandeur qui n existe pas.

En pratique, avant d ecrire un rapport entre deux chiffres, nommer ce
que chacun mesure. Si les deux noms different, il n y a pas de multiple,
il y a deux faits a raconter cote a cote. Et quand la sortie est une
liquidation, une reprise d actifs ou une acquisition a prix non public,
la valeur finale vaut null plutot qu un nombre : un champ vide se lit
comme une absence, un nombre se lit comme une mesure.

Le corollaire vaut pour ce qu on ne refuse pas. Un echec reste un
comparable de premier ordre, et c est meme la raison de la regle.
Made.com instruit mieux la fragilite d un modele e-commerce a forte
intensite logistique que trois reussites. Ce qu on interdit n est pas de
citer l echec, c est de lui coller un ratio qui n existe pas.

## Une garde qui verifie un axe donne l air de fermer les autres

Une liste peut etre complete et la garde qui la parcourt rester
partielle. Elle donne alors l impression de fermer tout ce qu elle
enumere, alors qu elle ne verifie qu une propriete sur plusieurs, et
rien dans son nom ni dans son contenu ne dit laquelle.

Le cas est du 5 aout 2026. `SITES_A_DECLARER`, dans le test du budget
d appel, enumere les onze sites qui appellent le client partage sans
passer par la table. La liste etait juste et complete. Elle ne
verifiait que la temperature. Le balayage de temperature avait ete fait
un jour donne, celui des fenetres ne l avait pas ete, et la liste ne dit
pas la difference : Friction d execution y figurait, sa temperature
etait declaree, et il a herite des soixante secondes du client avec une
reprise, jusqu a sortir a 120 397 ms sur un run de demonstration.

La faute est plus difficile a voir que la liste incomplete, qui a sa
section plus haut. Une liste incomplete se corrige des qu on rencontre
un element absent ; ici il n y a rien d absent, et le seul signe est
qu on ne trouve pas ce qu on ne cherche pas. La garde rend vert, la
liste est exhaustive, et l axe non verifie n existe nulle part comme
question.

Le releve des autres listes de perimetre du depot en a rendu une
seconde, et elle est du meme jour. `ENGINES`, dans le test
d instrumentation, enumere six moteurs et verifie sur chacun quatre
axes : le canal d appel, l absence de l ancien canal qui jetait l usage,
le puits de mesure, le depot de l appel. Onze moteurs deposent une
mesure dans la route. Les cinq qui manquent sont Equipe, Marche, Macro,
Coherence financiere et la synthese finale, c est-a-dire la porte
entiere, celle dont la chute coute le plus. Les cinq respectent le
contrat en fait ; rien ne le verifie.

Cette seconde occurrence a une difference qui vaut d etre notee : son
titre de section annonce « les six moteurs », donc elle declare son
perimetre. C est le minimum, et cela suffit a ne pas tromper un lecteur
attentif.

Ce qui manque encore est la raison du decoupage, et c est elle qui
distingue une liste bornee d une liste incomplete. Une liste bornee dit
pourquoi ce qui est dehors est dehors, donc elle se relit et se conteste
sur le critere. Une liste incomplete se contente d enumerer, donc rien
en elle ne dit si un absent l est par arbitrage ou par oubli, et la
seule facon de le savoir est de retrouver celui qui l a ecrite. La
regle complete est donc en deux temps : une liste de perimetre declare
sur combien d axes elle a ete balayee, et pourquoi elle s arrete ou elle
s arrete.

En pratique, une garde qui parcourt une liste declare ce qu elle
verifie, et surtout ce qu elle ne verifie pas, dans la liste elle-meme.
La question a poser devant toute liste de perimetre est : sur combien
d axes ce perimetre a-t-il ete balaye, et lesquels. Quand la reponse est
un seul, elle s ecrit a cote de la liste, faute de quoi la prochaine
lecture la prendra pour un inventaire ferme.

## Une valeur neutre n est neutre que si le calcul sait qu elle est absente

Remplacer une donnee manquante par une valeur qui ne deplace rien ne
suffit pas. La valeur ne reste neutre que tant que le calcul qui la
consomme sait qu elle est un remplacement, et un calcul ne le sait
jamais tout seul.

La regle est nee le 5 aout 2026 sur l ajustement dialectique de la
synthese. Aveuglement arrivait nul, la lecture de son score levait, et
le module de protection des racines existait deja pour ce cas : il
remplace une racine absente par un objet vide, et chaque interpolation
retombe sur le repli qu elle declarait. Applique ici, il aurait ferme
l exception. Il aurait aussi rendu un score de zero, et zero traverse
l arithmetique comme une mesure : sur la resolution `blindspots
-dominate`, la penalite vaut alors exactement moins quinze points, tiree
d un moteur qui n a jamais tourne. L exception aurait ete remplacee par
un chiffre plausible, ce qui est strictement pire, puisqu une exception
se voit.

C est le `?? 50` de TOLSON sous une autre forme, et la parente est le
point : la, un score de dimension absent prenait la valeur mediane et
entrait dans la moyenne comme une note ; ici un score de moteur absent
prend zero et entre dans une penalite. Les deux fois, la valeur choisie
est defendable en soi et fausse dans son role, parce que le calcul ne
distingue pas ce qu il a mesure de ce qu on lui a donne pour ne pas
casser.

La sortie n est pas de mieux choisir la valeur. Il n existe pas de
nombre qui signifie « absent » dans une arithmetique. La sortie est que
le calcul recoive l absence en plus de la valeur, et qu il en tire une
consequence explicite : ici l ajustement vaut zero parce qu il n a pas de
fondement, et il sort avec un drapeau qui distingue ce zero-la d un
equilibre entre deux moteurs qui ont tourne.

Le corollaire est symetrique et il s applique aux bornes plutot qu aux
valeurs. Un calcul de pire cas trop prudent ne protege pas, il bloque.
Celui de la convergence sommait la porte et la chaine aval, donc il
supposait que les deux consomment leur maximum ensemble, alors qu une
porte qui echoue ne laisse rien partir derriere elle. Il interdisait
ainsi une reprise de contrat justifiee au nom d un scenario qui n existe
pas, et rien ne le contredisait puisqu il ne se trompe jamais du cote
qui casse. Une borne qui ne peut se tromper que dans un sens ne se fait
jamais corriger par l experience : elle se corrige en relisant ce
qu elle suppose.

En pratique, devant toute valeur de repli qui entre dans un calcul,
poser la question dans cet ordre. Que vaut le calcul si cette valeur est
un remplacement. Si la reponse est un resultat different de celui qu on
aurait rendu en refusant de calculer, alors le repli ne protege pas, il
fabrique. Et la garde juste ne porte pas sur la valeur mais sur la
presence, qui doit voyager avec elle.

## Discipline des regles ecrites

Quand une regle est ecrite dans un commentaire, elle doit etre portee
par le code ou verrouillee par un test. Sinon elle ne vaut que pour la
ligne qui la porte.

La regle est nee le 3 aout 2026 d un constat repete. Le repli de
recalcul de la valorisation porte, sur son champ `asOf`, un commentaire
qui enonce la regle generale : « un rejeu ne doit pas produire une
fourchette que le run d origine n aurait pas produite ». La regle est
juste, elle est ecrite au bon endroit, et elle n a ete appliquee qu a
cette ligne. Le meme repli neglige la matrice de pertinence, les
composantes d operation et les regles de domaine, et produit donc
exactement ce que son propre commentaire interdit.

C est le troisieme cas de la semaine et les deux autres ont coute
davantage. Le parametre optionnel `opts?.emit` des fetchers portait six
evenements cables et aucun emetteur, depuis l origine. Le parametre
`measure` des moteurs etait passe onze fois sur quarante-quatre sites.
Dans les trois cas la conception etait juste et la discipline a cede,
parce qu une regle qui depend de celui qui l applique ne tient pas.

Trois formes de portage, par ordre de solidite. Le point de passage
unique, qui rend l oubli impossible : le registre d appels au modele
branche sur le client plutot que sur les sites d appel. La garde de
contrat, qui refuse ce qui ne respecte pas la regle : la citation
obligatoire, le perimetre obligatoire. Et a defaut le test qui compare
le declare au reel, sur le modele du registre de prompts, qui echoue le
jour ou les deux divergent.

Un commentaire seul n est aucune des trois.

## Une garde inerte est plus dangereuse qu une garde absente

Une garde qui a la forme d une garde et ne se declenche jamais est pire
que pas de garde du tout, parce qu une garde absente laisse un trou
qu un releve finit par trouver, tandis qu une garde inerte occupe la
place et fait cesser la recherche.

Le cas est du 3 aout 2026. Le prompt d extraction impose depuis
l origine « si une information n est pas presente dans le deck, retourne
une chaine vide ». Les moteurs en aval se gardaient contre null :
`${extraction.fundraise?.amount ?? '?'}`. La coalescence nulle ne
rattrape pas la chaine vide, donc la garde ne s est jamais declenchee
sur le seul cas qu elle visait, et le modele recevait « Montant
annonce : » suivi de rien. Ce qu un modele fait d une ligne tronquee
n est pas neutre : il ne voit pas un champ vide, il voit une phrase
interrompue, et il la comble comme le reste de sa lecture. La garde
ecrite pour eviter exactement cela le favorisait. Le releve a rendu
quatre-vingt-dix-huit sites sur seize modules, dont les sept patterns de
fragilite, la ou l inventaire de depart en comptait six.

La faute ne se voit pas a la relecture, et c est ce qui la definit. Le
code nomme le bon champ, pose le bon defaut, et il ne lui manque que
d etre vrai. Il n y a rien a chercher, puisque rien ne manque. C est la
dissymetrie du battement present et du battement absent, transposee au
code : l oubli laisse une trace, le simulacre n en laisse aucune.

La forme generale se lit sans son cas. Un operateur de defaut est un
contrat entre deux modules sur ce que veut dire « pas de valeur », et
les deux doivent en avoir la meme definition. Quand le producteur dit
chaine vide et que le consommateur teste null, ils sont d accord sur
l intention et en desaccord sur l objet, ce qui est le pire des trois
etats possibles : le desaccord franc casse et se repare, l accord
fonctionne, l accord apparent dure.

En pratique, deux exigences. La definition d absence vit a un seul
endroit, une fonction que les sites appellent, et non un operateur
recopie ; ainsi la corriger les corrige tous. Et un test parcourt les
sources pour refuser la forme fautive a un nouveau site, faute de quoi
le point de passage n empeche que les oublis de celui qui le connait.
Le meme test doit prouver qu il voit la faute quand on la lui donne :
un verrou qui ne cherche rien est vert pour la mauvaise raison.

## Discipline de non-retroactivite des contrats

Un contrat plus fin ne requalifie pas les donnees produites sous le
contrat ancien. Elles ne portent pas la precision qu on leur
appliquerait.

La regle est nee le 3 aout 2026 sur le passage du type d operation a
une representation composite. La nouvelle regle est que la dilution
suppose une composante de cash-in ; l ancienne etait que seule une
cession totale la mettait hors domaine, parce qu une cession partielle
pouvait accompagner une augmentation de capital que rien ne permettait
de constater. Appliquer la nouvelle regle aux analyses anterieures
aurait declare hors domaine des dilutions calculees a bon droit, sur la
foi d une composante absente non pas du dossier mais du contrat qui l a
produit.

Le raisonnement vaut au-dela du cas. Une absence sous un contrat ancien
n est pas une negation, c est un silence : le champ n existait pas, la
question n etait pas posee. Traiter ce silence comme une reponse est la
meme faute que la divination, prise par l autre bout, puisqu on tire
une conclusion de ce qui n a jamais ete demande.

En pratique, tout consommateur d un champ nouveau doit porter deux
branches, celle qui lit le champ et celle qui applique la regle
anterieure a l identique quand il est absent. La branche ancienne n est
pas un repli degrade, c est la lecture juste des donnees anciennes, et
elle se supprime le jour ou plus aucune donnee ancienne n est lue.

## Portee d un moteur : la sortie qu on lit et celle qui agit

La portee d un module s etablit en enumerant ses consommateurs, jamais
en suivant celle de ses sorties qu on a sous les yeux.

Le cas est du 3 aout 2026, dans la relecture de la note Braincube. Les
sept patterns de fragilite y etaient classes non prioritaires pour la
stabilite, au motif que leur sortie est une prose qui ne commande aucun
autre moteur. C est exact du chainage : aucun moteur ne lit leur texte,
et leur variance textuelle ne se propage nulle part. C est faux du
score, ou le verdict de chaque pattern entre dans le calcul mecanique,
qui entre dans la recommandation finale, qui est la premiere page que le
partner lit. Leur variance n etait donc pas neutre, elle etait
seulement invisible a l endroit ou on la cherchait.

La faute a une cause qui la rend recurrente plutot qu accidentelle. Un
moteur qui produit a la fois de la prose et un nombre a deux publics. La
prose est ce qu on lit, ce qu on relit, ce qu on corrige ; le nombre
voyage sans etre lu. Le canal visible est celui qu on juge, le canal
muet est celui qui agit, et rien dans l experience de relecture ne
signale le second.

C est la meme famille que le constat de l indicateur en bout de chaine,
ou un taux d echec attribue au dernier maillon mesurait en realite
l etat de son amont. Dans les deux cas la lecture est juste et l objet
est faux, et dans les deux cas aucune relecture du raisonnement ne le
revele, puisque le raisonnement se tient. Seul un detour par le code le
montre.

En pratique, avant de declarer un moteur sans effet, enumerer les champs
qu il exporte et, pour chacun, qui les lit. Le detour coute une
recherche. Le corollaire vaut pour tout classement de priorite de
stabilite : le rang d un moteur y est une affirmation sur ses
consommateurs, donc une affirmation verifiable, donc une affirmation a
verifier plutot qu a sentir.

## Collision de deux exigences sur un meme texte

Quand deux exigences differentes reposent sur la meme chaine de
caracteres, un changement fait au nom de l une depense l autre sans
qu aucun arbitrage soit rendu. Le mecanisme n a rien de particulier au
cas qui l a revele, et il se reproduira.

Le cas est du 3 aout 2026. Le brief 25 avait ecrit dans le prompt
d extraction six noms de code de processus et trois noms de vendeurs
lus dans le corpus, en marqueurs de cession, et un test verrouillait
qu ils soient nommes, precisement pour que ces marqueurs restent des
observations et non des suppositions. Le commit `2177651` a retire tous
les noms de dossiers reels des prompts, parce qu un nom de client dans
la note d un autre client est disqualifiant devant un fonds. Les deux
exigences etaient justes, elles portaient sur les memes caracteres, et
la seconde a emporte la premiere sans que personne s en apercoive. Le
diff du nettoyage est irreprochable lu seul, l assertion de la garde est
irreprochable lue seule, et la contradiction n existe que dans leur
intersection, qui ne vit dans aucun fichier.

C est ce qui rend la collision invisible a la relecture. Il n y a ni
import a declarer, ni type a satisfaire, ni appelant a mettre a jour :
une chaine de caracteres est une ressource partagee sans proprietaire,
et le compilateur ne connait pas ses usages. Rien ne signale au commit
qui la modifie qu il retire l objet d une garde, et rien ne signale a la
garde que son objet a change de raison d etre.

Ce qui aurait du alerter est un test devenu rouge apres un commit sans
rapport apparent avec lui. C est le seul signe que la collision produit,
et c est un bon signe : il est precis, il est date, il nomme les deux
parties. Le danger est le reflexe qui suit, reparer le test rouge, qui
consiste a rendre l arbitrage une seconde fois dans le meme sens et a
l enterrer pour de bon. Un test rouge dont le commit fautif ne parlait
pas du sujet du test n est pas une reparation a faire, c est un
arbitrage a rendre, et il se rend explicitement.

La sortie, quand elle existe, est de monter d un cran d abstraction.
Un exemple satisfait une exigence et viole l autre ; la regle qui a
produit l exemple les satisfait souvent toutes les deux. Ici, ce qui se
verifie est desormais la forme du marqueur, un nom de code forme de
Project suivi d un nom d animal ou de relief, et non le nom du dossier
ou il a ete lu. La garde couvre les six noms retires et tous les
suivants, et elle ne nomme personne. Les deux exigences y gagnent, ce
qui est le signe qu on a trouve le bon niveau et pas un compromis.

Cette sortie n est pas toujours disponible. Quand elle ne l est pas,
l arbitrage se tranche et s ecrit, avec ce qu il coute au perdant. Ce
qu on ne veut a aucun prix, c est qu il soit rendu par le hasard de
l ordre des commits.

## Acquerir un fait, ou dependre de sa disponibilite

Le reseau et la reproductibilite ne s opposent pas. Ce qui s oppose est
l acquisition d un fait et la dependance a sa disponibilite. Confondre
les deux fait renoncer a l acquisition pour sauver une reproductibilite
qu on n avait deja plus.

La question posee le 5 aout 2026 etait de savoir s il fallait couper la
recherche web pour qu un run soit rejouable. Elle etait mal posee. Un run
qui interroge le reseau acquiert un fait, et un fait acquis ne redevient
pas incertain parce que sa source a change depuis. Ce qui rend un run
irrejouable n est pas d etre alle chercher, c est de n avoir rien
rapporte de sa recherche.

Le cas est le plus grave rencontre jusqu ici, parce que le dispositif
fautif avait exactement la forme de celui qui manquait. La plateforme
rendait, a cote de la prose, les pages reellement atteintes avec leur
adresse et leur titre, et les citations rattachant un passage du texte a
une page avec l extrait cite. `callClaude` ne gardait que les blocs de
texte, les concatenait, retirait les balises de citation pour que la note
ne les affiche pas, et jetait tout le reste au retour. La tracabilite
arrivait et le pipeline la detruisait. Ce qui la remplacait etait une
declaration du modele sur sa propre source, produite sur instruction du
prompt : « mentionne brievement la source si tu peux la reconstituer ».
Un tag `[web : crunchbase]` n a donc jamais ete une source. C est un
souvenir, invérifiable par construction, et il avait la forme d une
preuve. Le releve sur quarante analyses persistees rend cinquante-deux
mille tags de provenance, dont quinze mille quatre cents annoncent une
lecture web, et zero run portant la moindre URL.

La regle se formule sans son cas. Une acquisition se capture au moment ou
elle a lieu, avec ce qui permet de la reconnaitre plus tard : l identite
de ce qui a ete lu, la date de la lecture, et l extrait sur lequel la
conclusion repose. Capturee ainsi, elle cesse de dependre de la
disponibilite de sa source : la page peut disparaitre, le fait reste
opposable parce que la lecture est datee et citee. Non capturee, elle
depend de sa source pour toujours, et une source ne repond pas deux fois
la meme chose.

Trois exigences suivent, et la premiere est celle qu on oublie. La
capture vit a cote de la prose et non dedans, parce qu une trace logee
dans le texte se retrouve un jour en collision avec le rendu, et que le
rendu gagne toujours. Une instruction qui demande au modele de
reconstituer sa provenance se retire, parce qu elle produit une
affirmation de plus a verifier tout en donnant a croire que la
tracabilite existe. Et une revendication de lecture que la capture ne
porte pas devient non fondee, traitee comme telle par le controle : la
propriete observable remplace la declaration, faute de quoi le tag
continue de tenir lieu de preuve par la seule force de son apparence.

Le corollaire est ce qu on promet au fonds, et il se dit plutot qu il ne
se cache. Deux runs ouverts lances en meme temps peuvent trouver des
choses differentes, parce que le monde bouge entre les deux et que c est
exactement ce qu on leur demande. Ce qui est promis n est donc pas
l identite des tirages, c est la verifiabilite du tirage rendu : tout
fait exterieur porte l adresse d ou il vient, la date ou il a ete lu et
le passage cite, et le fonds peut refaire le chemin. C est ce qu une due
diligence teste, et c est tenable. Promettre l identite ne l est pas, et
la promettre quand meme se paie au premier controle.

La regle deborde les sources web, et c est la raison de l ecrire ici
plutot que dans le module. Elle vaut pour toute donnee que le systeme va
chercher ailleurs que dans le dossier : un registre d entreprises
interroge, un cours releve, un document telecharge, la sortie d un moteur
qu on ne rejouera pas. Le test est le meme partout : si la source
disparaissait demain, resterait-il de quoi etablir ce qu elle a dit.
Quand la reponse est non, ce n est pas la source qu il faut couper, c est
la capture qu il faut ecrire.

## Discipline de provenance

Une mention de provenance ne doit jamais etre la seule chose qui
distingue une decision d une panne. Si le lecteur en a besoin pour
savoir si l outil a decide, la decision n a pas ete ecrite.

La regle est nee le 3 aout 2026 sur la reserve de validite d operation,
et elle porte sur la place autant que sur le contenu. La mention etait
exacte, elle disait que la reserve reposait sur une lecture de prose et
non sur une donnee structuree. Placee en troisieme phrase d un
paragraphe qui refusait de discuter un prix, elle devenait un aveu de
faiblesse au milieu meme de la justification, et un partner y lisait un
echec la ou il fallait lire un arbitrage.

Ce qui fonde une affirmation se lit apres elle, ce qui la limite se lit
avec elle. La provenance fonde, elle ne limite pas, donc elle suit, en
retrait typographique. Rien n est cache, l ordre seul change, et
l ordre decide de ce que le lecteur comprend.

## Limite structurelle de la surveillance interne

Un heartbeat prouve la vie, il ne signale pas la mort. Aucun dispositif
interne ne corrige cela, et il faut le tenir pour une limite de
conception et non pour une dette a resorber.

Le constat est ne le 3 aout 2026 de la decouverte que les six taches
planifiees declarees dans `vercel.json` n avaient jamais atteint leur
handler, interceptees par le middleware d authentification et
redirigees en 307 vers `/login`. La question qui suit n est pas
pourquoi la panne est survenue, elle est pourquoi elle a dure.

Le battement present est un fait positif que l on peut ecrire. Le
battement absent n est un evenement pour personne : aucun processus ne
se declenche parce que rien ne s est produit. Il faut donc un tiers
qui, a un moment qu il choisit, constate le silence.

Et ce tiers ne peut pas vivre dans la plateforme qu il surveille. Un
cron de surveillance branche sur `/api/cron/monitor` aurait ete
redirige en 307 comme les six autres et aurait garde exactement le meme
silence. C est le cas limite de l instrument qui ne borne pas son
objet, decrit plus haut : ici l instrument ne partage pas seulement la
nature de l objet, il partage son mode de defaillance.

L instrumentation ne manquait d ailleurs pas. Le cron de nettoyage
ecrivait sa trace d invocation dans `error_logs` avant meme d evaluer
l autorisation, avec un commentaire annoncant qu elle servait de
heartbeat. Elle a fonctionne : c est son absence totale qui a permis
d etablir la panne. Elle a mis une semaine, et seulement parce qu un
humain est alle la lire en cherchant autre chose. Le defaut n etait pas
dans l ecriture, il etait dans la lecture, et aucune table mieux tenue
n y aurait rien change.

La seule reponse qui tienne est un interrupteur d homme mort chez un
tiers : chaque tache reussie envoie un signal a un service exterieur,
et c est ce service, qui ne depend ni de Vercel ni de Supabase ni du
middleware, qui alerte quand le signal cesse. L inversion est tout le
sujet. Ce n est plus la plateforme qui doit avoir la presence d esprit
de signaler sa propre panne, c est le silence qui devient l evenement.
C est le seul dispositif qui aurait alerte le 8 juin, jour de la
premiere ligne restee bloquee, plutot que le 3 aout.

Son cout est une dependance externe, et il n est pas seulement
technique. Un tiers qui sait quand Prelude se tait sait aussi quand
Prelude travaille, sur quelle cadence et avec quelles interruptions,
pour une plateforme vendue a des fonds institutionnels sur sa rigueur.
La question est de gouvernance avant d etre d ingenierie, et elle se
tranche a ce niveau, pas dans un ticket.

En attendant cet arbitrage, la mesure interne utile est la lecture
placee la ou tourne quelque chose qui ne depend pas des taches
planifiees : le rendu d une page que des humains ouvrent. Elle ne
detecte rien tant que personne ne regarde, ce qui est une garantie
faible, et il faut la presenter comme telle plutot que la laisser tenir
lieu de surveillance.

## Discipline de verification

Trois regles, nees le 3 aout 2026 apres cinq runs complets dans la
journee, dont deux ont servi a decouvrir qu un correctif ne faisait
rien. Un run complet coute trois a quatre dollars et demi et dix
minutes ; il ne doit plus servir a explorer, mais pas pour la raison
qu on croyait.

**Un correctif n est pas fait tant qu il n a pas ete exerce sur les
donnees reelles du dernier run persiste.** Pas sur une fixture
construite. Les deux corrections inertes du 3 aout, l arbitrage de
classe d actif et la detection d evenements posterieurs, ont passe
leurs tests et n ont rien fait en production : leurs fixtures portaient
mon hypothese sur la forme des donnees au lieu de la lecture des
donnees. L arbitrage attendait un indice sectoriel logiciel quand la
route lui passait deja une classe industrielle ; la detection lisait
quatre listes du moteur Equipe quand l evenement vivait dans le moteur
Fragilite, sans annee sur la ligne. Une fixture prouve que le code fait
ce qu on lui demande, elle ne prouve pas qu on lui a demande la bonne
chose.

**La stabilite se mesure moteur par moteur, hors ligne, jamais par le
pipeline complet.** Rejouer un moteur seul coute entre deux et quinze
centimes, mediane six ; le pipeline entier coute plusieurs dollars pour
la meme information, et il melange la variance du moteur mesure a
celle de tous les autres. Les outils sont `scripts/engine-stability.ts`
pour la dispersion et `scripts/banc-moteurs.ts` pour les relations.

**Un run complet ne se lance que pour confirmer ce qui a deja ete
etabli hors ligne, jamais pour explorer.** Si l on ne sait pas d avance
ce que le run doit montrer, c est qu il ne faut pas le lancer.

## Un dispositif qui ne conclut pas ne s accumule pas

Un outil de verification qui rend un tableau plutot qu un verdict
depense l attention qu il devait economiser. C est le critere de
conception de tout ce qui s ajoute au dispositif, et il prime sur la
finesse de la mesure.

Le constat est du 5 aout 2026. Trois outils existaient pour eprouver le
pipeline hors production et aucun ne portait d assertion.
`engine-stability` rejoue un moteur N fois et rend une dispersion champ
par champ. `replay-partial` reconstitue une note en recalculant les
moteurs deterministes et rend un JSON. Les fixtures de calibration
decrivent des attentes sur des dossiers de reference. Les trois sont
justes, et les trois exigent une lecture humaine pour qu on sache si
quelque chose ne va pas. Un defaut trouve par leur intermediaire coute
donc autant a redetecter la fois suivante qu il a coute la premiere
fois, et rien ne se capitalise.

Une propriete, elle, se paie une fois. Elle s ecrit apres un defaut
constate, elle rend rouge ou vert, et elle s evalue sur tout le corpus
persiste a chaque passage sans qu on la relise. C est ce qui transforme
une observation faite sur une note en un taux mesure sur toutes, et
c est la seule question qui n etait jamais posee : ce defaut touche
combien de notes.

Trois exigences suivent, et la deuxieme est celle qu on oublie.

Toute propriete porte le defaut constate dont elle est nee. Sans cela
c est une intuition, et une intuition qui rougit fait perdre plus de
temps qu elle n en fait gagner.

Toute propriete est eprouvee sur le corpus AVANT d entrer, et son taux
de faux positifs est mesure puis ecrit a cote d elle. Le cas type est du
5 aout : la propriete « la recommandation cite au moins un driver »
rendait dix violations sur cinquante, et les dix portaient le drapeau du
repli degrade, qui fonctionnait exactement comme prevu. Cent pour cent
de faux positifs, sur une propriete plausible ecrite en trois minutes,
qui aurait fait chercher un defaut inexistant dans dix notes. Une autre,
sur les patterns de fragilite, comparait une etiquette a un litteral
ecrit a la main qui ne correspondait a rien dans les donnees : elle
rendait soixante-dix-sept pour cent de violations, toutes fausses, et
elle commettait exactement la faute qu elle avait ete ecrite pour
traquer.

Toute propriete declare ce qu elle lit, parce que ce qu une violation
prouve en depend. Une propriete qui lit une sortie deterministe mesure
le code d aujourd hui. Une propriete qui lit de la prose mesure le code
du jour ou le run a eu lieu, et son taux global n a aucun sens : il se
rend segmente par empreinte de code, faute de quoi on mesure l etat des
notes anciennes en croyant mesurer le produit. C est la meme regle que
pour la variance, ou deux runs a des commits differents ne sont pas deux
tirages du meme systeme.

Le dispositif est `lib/controle/`, et son catalogue sert deux
consommateurs a dessein. Le controleur de corpus l applique aux notes
persistees, hors ligne et sans cout. Le bulletin de fiabilite l applique
a la note qu on vient de produire, et la note le porte en tete. Sans ce
partage les deux divergeraient, et celui que le client lit serait le
moins tenu des deux.

## Ce que coute un run, et comment un chiffre faux s installe

Un run complet coute entre trois et quatre dollars et demi, et dix
minutes. Le goulet n est pas la facture, c est l attention : les dix
minutes de calcul, puis la demi-heure de lecture qui les suit et qui est
le veritable detecteur de defauts.

Le chiffre precedent, une vingtaine de dollars, etait faux d un facteur
cinq a huit. Il a ete ecrit le 3 aout 2026 dans la discipline de
verification, et il a oriente deux jours de decisions : ce qu on
s autorisait a lancer, ce qu on renoncait a verifier, et jusqu a la
forme des dispositifs qu on envisageait de construire pour l eviter.
Personne ne l a jamais mesure. Il est ne d une estimation faite une
fois, plausible, jamais confrontee, et il a acquis l autorite d une
donnee par sa seule presence dans un document de reference.

C est le motif, et il vaut au-dela du cout. Une estimation ecrite dans
un document qui fait autorite cesse d etre lue comme une estimation des
le lendemain. Elle ne porte plus la marque de son incertitude, personne
ne se souvient qu elle n a pas ete mesuree, et elle est reprise par
celui qui la relit comme un fait etabli, y compris par son auteur. La
difference avec une mesure fausse est que la mesure fausse laisse une
methode qu on peut relire ; l estimation ne laisse rien, donc rien ne
peut la contredire.

Le releve du 5 aout : sept runs portent le registre d appels, qui rend
entre 1,18 et 1,64 dollar de tokens hors cache pour dix-huit a vingt-deux
appels, et entre 454 et 636 secondes de duree. Le registre ne comptait
pas les tokens de cache, par ou passe le PDF du dossier ; le PDF de
Woodpecker a ete mesure a deux cent trente-six mille tokens par
`count_tokens`, qui est gratuit, et il est porte par quatre appels.
Selon que le cache tient sur la duree du run, cela ajoute 1,10 a 2,84
dollars. Les deux champs manquants ont ete ajoutes au registre le meme
jour : le cout est desormais exact et non plus encadre.

En pratique, trois exigences. Un chiffre qui oriente une decision se
mesure avant d etre ecrit, ou il porte la mention qu il ne l a pas ete.
Une estimation qui survit plus d une journee dans un document de
reference doit etre soit mesuree soit retiree. Et quand l instrument de
mesure existe deja mais ne couvre qu une part de la grandeur, comme ce
registre qui ignorait le cache, ce n est pas une approximation : c est un
chiffre juste sur une part qui se lit comme un chiffre sur le tout.

## Ce qui fonde une conclusion n est pas toujours ce qui l accompagne

Une mesure qui conclut sans que son echantillon le permette doit nommer
ce qui la fonde vraiment. Le chiffre mis en avant et la raison de croire
sont deux choses, et les confondre fait passer une conclusion juste pour
une conclusion prouvee par le mauvais organe.

La regle est nee le 3 aout 2026 de la reprise du tirage d extraction sur
Woodpecker. Trois passes en serie ont rendu trois sorties sans echec, et
la tentation etait d ecrire que le tirage etait gueri. Elle ne l aurait
pas prouve : avec zero echec sur trois tirages, la borne haute du taux
reel reste vers soixante pour cent, et trois passes ne separent donc pas
un tirage gueri d un tirage a un tiers. Ce qui fondait la conclusion
etait ailleurs, dans les trois durees relevees, cinquante-sept a
soixante-quinze secondes contre une fenetre de trois cents, soit un
facteur quatre de marge, et dans la lecture du code qui etablit que
l ancien plafond etait de soixante secondes par tentative avec une
reprise, ce qui rend compte des deux minutes constatees.

Le compteur d echecs etait la mauvaise grandeur, la duree etait la
bonne, et les deux repondaient a la meme question. C est le cas general :
quand l evenement est un seuil pose sur une grandeur continue et que le
seuil est connu, la grandeur se mesure en trois tirages, l evenement
demande un ordre de grandeur de plus.

En pratique, une conclusion tiree d un petit echantillon s ecrit en deux
temps. D abord ce que l echantillon borne, avec sa borne. Ensuite ce qui
fonde reellement la conclusion, qui est souvent une lecture de code ou
une grandeur intermediaire, et qui doit etre nomme comme tel. Une
conclusion juste appuyee sur le mauvais chiffre se defait au premier
contre-exemple, alors que la meme conclusion appuyee sur ce qui la fonde
tient.

## Un test peut mentir sur sa couverture dans les deux sens

Un nom de test qui designe un module qu il ne touche pas produit deux
erreurs opposees, et on ne voit d ordinaire que la premiere. Le parent
nomme parait couvert alors qu il ne l est pas ; le module reellement
teste parait nu alors qu il est couvert. L inventaire se trompe deux
fois par ligne fausse.

Le constat est du 3 aout 2026. Quatre tests portaient le nom de leur
parent et testaient un sous-module pur voisin. Le releve de depart
nommait `version-stamp` parmi les modules sans test, et c etait faux
dans l autre sens : `version-stamp` etait couvert par treize assertions
vivant sous le nom `prediction-records-store.test.ts`, et c est
`prediction-records-store` qui n avait rien. Ecrire les tests d apres le
releve aurait donc double la couverture d un module deja couvert et
laisse l autre nu, en croyant corriger.

La raison pour laquelle seule la premiere erreur se voit est qu elle
seule laisse une trace : un module sans test se cherche et se trouve. Un
module couvert sous un autre nom ne se cherche pas, puisque rien ne
manque. C est la meme dissymetrie que le heartbeat, ou le battement
present est un fait et le battement absent n est un evenement pour
personne.

En pratique, un releve de couverture se fait sur les imports et jamais
sur les noms de fichiers, et il rend deux listes plutot qu une : les
modules sans assertion, et les assertions dont le nom ne designe pas ce
qu elles importent. La seconde liste est celle qui corrige la premiere.

## Conventions de commit

Tag obligatoire en prefixe : feat / fix / refactor / docs / test /
chore. Le scope est utile mais optionnel : feat(orchestrator),
test(trajectory).

Le corps du message explique le pourquoi structurel, pas le quoi.
Pour les commits qui changent l architecture, decrire la motivation
et les implications pour la suite.

Pas d em-dashes dans les messages de commit. Voix editoriale meme
en commit.

## Etat actuel du projet (mai 2026)

Livre et en production :
- Pipeline early stage avec quatorze moteurs (extraction, equipe,
  marche, macro, pattern matching, retournement causal, aveuglement,
  contrarien, financier, tech claim, friction d execution, lecture
  du langage, fragilite structurelle, orchestration finale).
- Moteur Fragilite structurelle (Phase 4) avec sept patterns
  calibres en doctrine : Growth Subsidized Model, Infrastructure
  Hostage, Fixed Cost Trap, Regulatory Time Bomb, Commoditization
  Drift, Capital Structure Fragility, Scale Mirage Risk. Plus sept
  combinaisons diagnostiques cross-patterns (Trajectoire WeWork,
  Pattern Britishvolt, Pattern Northvolt, Wrapper sans
  differenciation, etc).
- Moteur Trajectoire (Score de Trajectoire) avec API et UI dans
  l onglet Decision du dashboard.
- Selecteur de parcours en page d entree : early stage versus
  growth. En growth, les moteurs Equipe, Pattern Matching,
  Aveuglement, Causal sont skip. Pipeline allege a neuf moteurs.

Reste a faire avant prod commerciale :
- Calibration LLM reelle des sept patterns Fragilite structurelle
  sur dossiers de reference (WeWork, Theranos, Casper, MoviePass,
  Atlassian, Stripe, Mistral, Northvolt, Ynsect, Klarna). Une demi-
  journee par pattern. Necessite cle API. C est l item numero un.
- Tests E2E du pipeline en conditions reelles avec PDF reels.
- Adaptation de la note d instruction et du dashboard pour le
  parcours growth (cacher les sections moteurs skipped, mettre
  Fragilite structurelle et Trajectoire en couverture).

Reste a faire en optimisation :
- Persistence dediee snapshots Trajectoire en table Supabase
  separee (actuellement on agrege sur les versions existantes).
- Refactor des deux gros fichiers d interface, a egalite et non plus
  un seul : app/HomeClient.tsx (7015 lignes) et
  app/components/InvestmentNoteView.tsx (7008 lignes), a decouper en
  sous-composants. Le second est le fichier le plus souvent touche du
  depot, puisque toute evolution de la note d instruction y passe.
  Mesure au 2 aout 2026.
- Narrative Drift V2 (ingestion communications externes pour
  activer le sous-module KPI_EXTINCTION).

## Commandes utiles

```
# Build local
npm run build

# Lancer le serveur dev
npm run dev

# Type check
npx tsc --noEmit

# Lancer un test specifique
npx tsx lib/engines/<nom>.test.ts

# Lancer toute la suite tests deterministes (a configurer si pas
# encore fait : un script run-all-tests.sh qui boucle sur les
# fichiers .test.ts)

# Voir les commits recents
git log --oneline -20

# Voir l etat
git status
```

## Variables d environnement

Pour faire tourner le pipeline en local avec appels LLM reels, il
faut au minimum :
- ANTHROPIC_API_KEY pour les appels Claude
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY pour la persistence
- ENABLE_AUTH (true ou false) pour activer ou non le flow auth

Le fichier .env.local ne doit jamais etre commit. Le repo a un
.env.example qui liste les variables attendues.

## Hierarchie d urgence pour cette session

Si Steve demande quoi faire en priorite, l ordre est :
1. Calibration LLM des sept patterns Fragilite structurelle
2. Tests E2E pipeline sur dossier reel
3. Adaptation note et dashboard pour parcours growth
4. Refactor HomeClient.tsx et InvestmentNoteView.tsx
5. Narrative Drift V2
6. Persistence dediee snapshots Trajectoire

Ne propose jamais cette liste de but en blanc. Steve la connait.
Reagis a ce qu il demande, et trace.
