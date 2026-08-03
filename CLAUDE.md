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
instrument de la meme nature que ce qu elle evalue ne borne rien.

Le detecteur d evenements cherche un fait date dans de la prose par
expression reguliere. Pour mesurer son taux de faux positifs, j ai
classe ses sorties en faits et en constats, par expression reguliere.
La mesure a rendu dix-huit pour cent de faux positifs, et elle a classe
« le pitch articule un scenario chiffre vers la profitabilite » comme
un fait date. Le taux reel est donc superieur, d un montant que cette
mesure ne peut pas donner, puisqu elle echoue exactement la ou l objet
mesure echoue.

Une telle mesure garde une valeur : elle etablit un plancher et elle
compare un avant a un apres, ce qui suffit a dire qu un resserrage a
ameliore quelque chose. Elle ne donne pas de niveau. La regle est donc
d annoncer le chiffre comme un plancher et jamais comme un taux, et de
dire par quoi la mesure est bornee.

Quand un jugement est necessaire pour mesurer un jugement, la seule
sortie est une lecture humaine sur un echantillon, ou une mesure
indirecte par une consequence observable qui, elle, se compte.

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
silence. C est la forme generale du second corollaire de la discipline
de mesure : un instrument de la meme nature que son objet ne borne
rien. Ici l instrument ne partage pas seulement la nature de l objet,
il partage son mode de defaillance.

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
rien. Un run complet coute une vingtaine de dollars et dix minutes ;
il ne doit plus servir a explorer.

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
pipeline complet.** Rejouer l extraction seule trois fois sur un deck
coute quelques centimes ; le pipeline entier coute vingt dollars pour
la meme information, et il melange la variance du moteur mesure a
celle de tous les autres. L outil est `scripts/engine-stability.ts`.

**Un run complet ne se lance que pour confirmer ce qui a deja ete
etabli hors ligne, jamais pour explorer.** Si l on ne sait pas d avance
ce que le run doit montrer, c est qu il ne faut pas le lancer.

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
