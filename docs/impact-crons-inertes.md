# Ce que les six taches planifiees n ont pas fait

Mesure du 3 aout 2026, sur la base de production, en lecture seule.
Etablit ce que l inertie des six crons a reellement produit, par
opposition a ce qu elle aurait pu produire.

La reponse courte contredit l intuition qui a motive la mesure. On
pouvait craindre que les six lignes fantomes de l Historique soient la
partie visible d un dommage plus lourd. Elles sont en fait le seul
dommage. Quatre des cinq autres taches n avaient aucun travail a
faire, faute de donnees remplissant leurs conditions d eligibilite. La
cinquieme a manque un rendez-vous unique, rattrapable, et une echeance
arrive dans huit jours.

## Nettoyage des runs bloques, le seul degat consomme

Six analyses en `status='running'`, dont deux du 8 juin. Le cron aurait
du les basculer en `failed` a son passage suivant, quinze minutes plus
tard. Elles sont restees, et un partner qui ouvre l Historique voit
depuis deux mois des analyses presentees comme en cours.

Leur `updated_at` porte une confirmation laterale utile au chantier du
heartbeat : les deux lignes du 8 juin affichent toutes deux
`2026-08-02 12:14:58.903697+00`, a la microseconde identique. Ce n est
pas de l activite, c est une ecriture de masse qui a traverse la table.
La ligne de ce matin, creee a 08:02, acheve la demonstration : si le
cron des quinze minutes tournait, elle serait deja basculee.

## Reanalyse de trajectoire, sans objet

La tache selectionne les dossiers `in_portfolio = true` dont le dernier
instantane depasse cent quatre-vingts jours. Le portefeuille compte
zero dossier marque, sur cinquante-sept analyses. La table
`trajectory_snapshots` est vide et `analyses_versions` aussi.

Aucune donnee ne manque du fait du cron. Le fait notable est ailleurs
et il n a rien a voir avec la panne : le moteur Trajectoire, livre et
declare en production, n a jamais ete exerce sur des donnees reelles,
ni par le cron ni par la voie manuelle. Un dossier passe en
portefeuille serait le premier a l eprouver.

## Digest hebdomadaire, sans objet

Le digest agrege les alertes de cran trois de la semaine sur les
dossiers en portefeuille. Le portefeuille etant vide, il n avait rien a
agreger et aucun courriel n a ete manque. La tache aurait tourne douze
fois depuis sa mise en service et rendu douze fois un digest vide.

## Detection de jalons, sans objet

Le selecteur exige une decision posee depuis plus de cent quatre-vingts
jours, lue dans `realized_outcomes.decision_date`. La table est vide.
La table voisine `analysis_outcomes`, qui porte onze lignes, ne
concerne pas cette tache : ses `observed_at` du 13 et 14 juillet
n auraient de toute facon rendu aucun dossier eligible avant janvier
2027.

Cette distinction merite d etre notee parce que la premiere mesure a
interroge la mauvaise table et aurait conclu sur onze dossiers dont
aucun n entre dans le champ du cron. C est la discipline de mesure
appliquee a la lettre : la conclusion s est confirmee en lisant quelle
table le selecteur interroge reellement, et non en cherchant la table
dont le nom ressemblait le plus a la question.

## Regeneration sectorielle, rien de perdu et une echeance dans huit jours

Les treize fiches du catalogue existent toutes, ce qui se verifie en
parcourant `SECTORS` et non en comptant des lignes : treize secteurs
declares, treize fiches en base. Elles portent toutes la date du 13 mai
2026 et le declencheur `manual`, aucune n a jamais ete produite par le
cron.

Le seuil de regeneration est de quatre-vingt-dix jours. Les fiches en
ont quatre-vingt-deux. Aucune n a donc encore franchi le seuil, et le
cron n aurait rien regenere depuis sa mise en service : rien n est
perdu.

La premiere echeance tombe le 11 aout 2026, dans huit jours. Sans le
correctif du middleware, elle serait passee inapercue, et la plateforme
aurait servi des benchmarks sectoriels perimes sans que rien ne le
signale, la fiche restant affichee comme une fiche. C est le seul
endroit ou la panne allait cesser d etre benigne, et le correctif tombe
avant.

## Regeneration inter-sectorielle, le seul rendez-vous manque

La table `inter_sectoral_briefs` est vide. La tache agit le premier
jour de chaque trimestre civil, et un seul rendez-vous est tombe depuis
sa mise en service du 13 mai 2026 : le 1er juillet. Le brief du
troisieme trimestre n existe donc pas.

Il ne se rattrapera pas tout seul. La garde de date renvoie `skipped`
tous les autres jours, et le prochain declenchement est le 1er octobre,
qui produira le brief du quatrieme trimestre sans revenir sur le
precedent. Le rattrapage passe par la voie manuelle,
`POST /api/inter-sectoral/regenerate` avec `period_quarter` valant
`2026-Q3`, qui ne porte pas la garde de date. Nous sommes encore dans
le trimestre, la periode courante est la bonne.

Une reserve sur la valeur de ce rattrapage. L agregateur consomme les
fiches sectorielles du trimestre courant et du precedent. Les treize
fiches datent du 13 mai, donc du deuxieme trimestre. Un brief du
troisieme trimestre se construirait sur zero fiche courante et treize
fiches precedentes, ce qui le fera probablement tomber sous la garde de
completude et rendre `rejected_no_data`. L ordre utile est donc de
laisser d abord la regeneration sectorielle du 11 aout repeupler le
trimestre courant, puis de declencher le rattrapage inter-sectoriel.

## Ce que cette mesure ne dit pas

Elle porte sur l etat present des tables, pas sur l historique des
declenchements. Une tache qui aurait tourne et echoue sans rien ecrire
serait indiscernable, ici, d une tache jamais appelee. C est le
diagnostic du middleware, et non ces chiffres, qui etablit qu aucune
n a ete appelee ; ces chiffres etablissent seulement ce que leur
absence a coute.

La preuve directe de non-appel ne vaut par ailleurs que pour
`cleanup-stale-running`, seule des six a tracer ses invocations. Pour
les cinq autres, l inference tient au partage du meme chemin et du meme
matcher, ce qui est solide sans etre une preuve.
