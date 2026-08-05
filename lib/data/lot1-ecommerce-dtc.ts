// ============================================================
// LOT 1 DE COLLECTE, CLASSE ecommerce-dtc
// ------------------------------------------------------------
// Treize fiches collectees le 5 aout 2026, au format cible, EN ATTENTE
// D INGESTION. Ce module n exporte rien vers VERIFIED_COMPARABLES et
// n est lu par aucun moteur.
//
// POURQUOI IL VIT DANS LE DEPOT PLUTOT QUE SUR UN BUREAU
//
// L etat d une collecte est une mesure, et une mesure qui vit dans un
// document sur un disque ne se refait pas. Ici, `npx tsx
// lib/data/lot1-ecommerce-dtc.test.ts` rend a tout moment ce qui manque
// encore, champ par champ, sans que personne ait a relire treize fiches.
// Le jour ou les sources arrivent, le meme test passe au vert et le lot
// devient ingerable.
//
// CE QUE CE LOT EST, ET CE QU IL N EST PAS
//
// C est un palliatif, et le referentiel juridique le dit mieux que moi :
// une fiche de comparable n est pas definie par la societe mais par le
// couple entite x perimetre comptable. Sezane publie sous Benda Bili,
// Cabaia sous Valtex, Typology sous Good Brands ; About You Holding SE
// publie un consolide IFRS et un social HGB, meme entite, meme date,
// deux chiffres non additionnables. Ces fiches sont indexees par le nom
// commercial, donc elles ne savent pas representer cela.
//
// Elles restent utiles pour ce qu elles portent vraiment : des pieges
// d usage, qui ne dependent d aucune source, et des trajectoires
// qualitatives. Le rapport Made.com, le numerique a 7 pour cent de
// Jimmy Fairly, la borne de Respire qui borne sans mesurer, l attendu de
// Tediber : ce sont des regles de lecture et elles valent tout de suite.
//
// ETAT AU 5 AOUT 2026
//
// Zero fiche recevable. Trente-deux refus portent sur les sources, en
// deux familles que le validateur separe et qui ne se ferment pas de la
// meme facon. Vingt-deux annoncent une collecte a faire, elles partent
// en collecte. Dix nomment un type de document sans l identifier, et
// celles-la attendent le referentiel juridique : « comptes agreges » sur
// Cabaia ne designe rien tant que Valtex n est pas nomme.
// ============================================================

import type { FicheComparable } from './fiche-comparable';

/** Marqueur de source non encore collectee, volontairement refuse par le contrat. */
const A_COLLECTER = 'a recoller';

export const LOT1_ECOMMERCE_DTC: FicheComparable[] = [
  {
    name: 'Sezane', founded: 2013, assetClass: 'ecommerce-dtc', stade: 'mature',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, non cotee',
    sousSecteur: 'mode feminine', founders: 'Morgane Sezalory',
    modeleEconomique: 'marque de pret-a-porter nee en ligne, collections en gouttes, boutiques propres ouvertes ensuite',
    pieges: "aucun montant n a jamais ete publie sur les trois entrees au capital : la fiche ne peut fonder aucun multiple, seulement une trajectoire de chiffre d affaires.",
    conflitsConserves: ['annee de fondation : 2013 selon la presse, 2011 selon une base d annuaire'],
    jalons: [
      { annee: 2015, libelle: 'entree de Summit Partners au capital', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2018, libelle: 'entree de General Atlantic', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2021, libelle: "chiffre d affaires", montantVerbatim: '250 M€', devise: 'EUR', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2022, libelle: 'entree de Tethys Invest', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2024, libelle: "chiffre d affaires", montantVerbatim: '~500 M€', devise: 'EUR', fiabilite: 'presse', source: A_COLLECTER },
    ],
  },
  {
    name: 'Tediber', founded: 2015, assetClass: 'ecommerce-dtc', stade: 'scaleup',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, sous LBO',
    sousSecteur: 'literie',
    modeleEconomique: 'matelas et articles de sommeil en vente directe, gamme volontairement resserree',
    pieges: "le chiffre 2021 etait un attendu et non un realise : son montant a ete retire de la base le 5 aout 2026, la ligne garde son libelle. Un attendu n est pas un realise.",
    jalons: [
      { annee: 2016, libelle: 'amorcage mene par 360 Capital', montantVerbatim: '1,8 M€', devise: 'EUR', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2021, libelle: 'LBO, entree de Parquest et Eutopia', fiabilite: 'presse', source: A_COLLECTER },
      // Montant retire : declaratif, donc non citable avec un chiffre.
      { annee: 2021, libelle: "chiffre d affaires attendu, montant retire de la base", fiabilite: 'declaratif', source: A_COLLECTER },
    ],
  },
  {
    name: 'Cabaia', founded: 2015, assetClass: 'ecommerce-dtc', stade: 'scaleup',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, sous LBO',
    sousSecteur: 'accessoires de mode',
    modeleEconomique: 'accessoires personnalisables, vente en ligne et boutiques ephemeres',
    pieges: "la serie de chiffre d affaires est la mieux documentee du lot, un facteur treize en quatre ans : utile comme trajectoire, jamais comme valorisation. Les comptes sont publies sous Valtex et non sous le nom commercial.",
    conflitsConserves: ['investisseurs 2023 : Quilvest avec sortie de Trail Solutions et Spring Invest selon une collecte, Experienced Capital et Siparex selon l autre. Les deux peuvent etre vraies a des dates differentes.'],
    jalons: [
      { annee: 2020, libelle: "chiffre d affaires", montantVerbatim: '7,4 M€', devise: 'EUR', fiabilite: 'base-agregee', source: 'comptes agreges' },
      { annee: 2021, libelle: "chiffre d affaires", montantVerbatim: '15,1 M€', devise: 'EUR', fiabilite: 'base-agregee', source: 'comptes agreges' },
      { annee: 2023, libelle: 'LBO Quilvest', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2024, libelle: "chiffre d affaires", montantVerbatim: '98,7 M€', devise: 'EUR', fiabilite: 'base-agregee', source: 'comptes agreges' },
    ],
  },
  {
    name: 'Typology', founded: 2019, assetClass: 'ecommerce-dtc', stade: 'scaleup',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, non cotee',
    sousSecteur: 'cosmetique, soin de la peau', founders: 'Ning Li',
    modeleEconomique: 'formules courtes vendues exclusivement en direct, sans distribution tierce',
    pieges: "aucun piege d hallucination connu a ce jour. La ligne d amorcage 2019 est hors base tant que le conflit de devise n est pas tranche.",
    conflitsConserves: ['montant d amorcage 2019 : 10 M$ selon le fondateur, 10 M€ selon Beauty Independent. La ligne reste hors de la base tant que le conflit n est pas tranche : deux devises ne coexistent pas dans un champ ferme, et choisir au hasard serait la precision inventee.'],
    jalons: [
      { annee: 2025, libelle: 'constitution de la holding Good Brands pour une seconde marque', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2019, libelle: 'amorcage, montant hors base sur conflit de devise', fiabilite: 'presse', source: A_COLLECTER },
    ],
  },
  {
    name: 'Respire', founded: 2018, assetClass: 'ecommerce-dtc', stade: 'scaleup',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, non cotee',
    sousSecteur: 'cosmetique et hygiene',
    modeleEconomique: 'soins naturels, vente directe puis distribution selective',
    pieges: "la borne de chiffre d affaires n est pas un chiffre publie mais une deduction du seuil legal de confidentialite partielle. Elle borne, elle ne mesure pas, et elle ne doit jamais etre citee comme un chiffre d affaires.",
    conflitsConserves: ['la borne 2023 est inferee du regime de confidentialite partielle des comptes, elle n est pas une valeur publiee'],
    jalons: [
      { annee: 2023, libelle: 'augmentation de capital, montant non devoile', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2023, libelle: "chiffre d affaires, borne superieure inferee", montantVerbatim: '< 12 M€', devise: 'EUR', fiabilite: 'base-agregee', source: 'comptes' },
    ],
  },
  {
    name: 'Omie & Cie', founded: 2019, assetClass: 'ecommerce-dtc', stade: 'startup',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, non cotee',
    sousSecteur: 'alimentaire',
    modeleEconomique: 'marque alimentaire integree, du sourcing a la vente en ligne',
    pieges: "environ 35 M€ leves pour 1,8 M€ de chiffre d affaires en 2023. La fiche ne conclut rien et c est volontaire : le ratio est ce qu un moteur de fragilite doit voir, pas ce qu une fiche doit juger.",
    conflitsConserves: ['serie A 2023 : 15 M€ tout capital selon une source, 12 M€ de capital et 3 M€ de dette selon l autre. La difference change le calcul de dilution.'],
    jalons: [
      { annee: 2023, libelle: 'serie A, structure en conflit', montantVerbatim: '15 M€', devise: 'EUR', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2023, libelle: "chiffre d affaires", montantVerbatim: '1,8 M€', devise: 'EUR', fiabilite: 'base-agregee', source: 'comptes' },
      { annee: 2024, libelle: 'cumul leve depuis la creation', montantVerbatim: '~35 M€', devise: 'EUR', fiabilite: 'presse', source: A_COLLECTER },
    ],
  },
  {
    name: 'Poulehouse', founded: 2017, assetClass: 'ecommerce-dtc', stade: 'startup',
    outcome: 'failure', pays: 'France', statut: 'liquidee en 2022',
    sousSecteur: 'alimentaire, oeufs',
    modeleEconomique: "marque d oeufs sans abattage des poules, vente directe et distribution",
    pieges: "la rupture vient d un rappel de creances par un prestataire critique pendant une levee en cours, alors que la rentabilite etait declaree atteignable a un mois. C est une mort par dependance fournisseur et non par trajectoire commerciale : ne jamais la citer comme un echec de marche.",
    jalonUniqueMotif: "la valeur de cette fiche ne tient pas a sa trajectoire mais a son motif de mort, une dependance fournisseur que le corpus ne portait pas. Fabriquer un second jalon pour satisfaire le contrat aurait ajoute un chiffre sans source a une fiche dont l interet est ailleurs.",
    jalons: [
      { annee: 2022, libelle: 'liquidation judiciaire, 1er fevrier', fiabilite: 'officiel', source: 'jugement du tribunal de commerce, reference a recoller' },
    ],
  },
  {
    name: 'Jimmy Fairly', founded: 2010, assetClass: 'ecommerce-dtc', stade: 'mature',
    outcome: 'ongoing', pays: 'France', statut: 'en activite, controle majoritaire cede a HLD',
    sousSecteur: 'optique',
    modeleEconomique: 'lunettes a prix unique, reseau de boutiques propres avec une origine en ligne',
    pieges: "le numerique represente environ 7 pour cent du chiffre d affaires en 2021 : malgre son origine, ce n est plus un comparable de vente directe en ligne. A utiliser comme comparable de distribution specialisee, ou a ecarter. La classe ecommerce-dtc est conservee faute de classe de commerce de detail au catalogue, et non parce qu elle decrit le dossier. Exercice decale au 31 mars depuis 2021 : toute serie porte une duree non standard.",
    jalonUniqueMotif: "la collecte n a rendu qu une operation capitalistique documentee. Les series de chiffre d affaires demandent les comptes deposes, qui attendent le referentiel juridique.",
    jalons: [
      { annee: 2021, libelle: "cession majoritaire a HLD, sortie d Experienced Capital", montantVerbatim: '~150 M€', devise: 'EUR', fiabilite: 'presse', source: 'Mergermarket cite par la presse, non confirme' },
    ],
  },
  {
    name: 'Made.com', founded: 2010, assetClass: 'ecommerce-dtc', stade: 'mature',
    outcome: 'failure', pays: 'Royaume-Uni', statut: 'liquidee en 2022, marque reprise par Next',
    sousSecteur: 'mobilier et decoration',
    modeleEconomique: 'mobilier de designers en vente directe, production a la commande, stock reduit',
    pieges: "le rapport 775 M£ vers 3,4 M£ n est pas un multiple. Le second est un prix d actifs incorporels apres realisation du reste par les administrateurs, le premier une capitalisation d introduction. Aucun moteur ne doit deriver de ratio de ce couple. Le meme piege vaut pour Missguided et Matches.",
    jalons: [
      { annee: 2021, libelle: 'introduction en bourse, LSE', montantVerbatim: '775 M£', devise: 'GBP', fiabilite: 'officiel', source: A_COLLECTER },
      { annee: 2022, libelle: 'placement sous administration, novembre', fiabilite: 'officiel', source: A_COLLECTER },
      { annee: 2022, libelle: 'reprise des actifs incorporels par Next', montantVerbatim: '3,4 M£', devise: 'GBP', fiabilite: 'officiel', source: 'communique Next, novembre 2022' },
    ],
  },
  {
    name: 'Missguided', founded: 2009, assetClass: 'ecommerce-dtc', stade: 'mature',
    outcome: 'failure', pays: 'Royaume-Uni', statut: 'liquidee en 2022, propriete intellectuelle reprise par Frasers',
    sousSecteur: 'mode rapide',
    modeleEconomique: 'mode feminine a rotation rapide, vente en ligne exclusive',
    pieges: "quatre entites candidates portent ce nom au registre britannique, dont une, Missguided Retail Ltd, depose des comptes dormants. Chercher les comptes sous le nom commercial peut rendre une serie vide ayant l apparence d une serie. Meme piege de rapport que Made.com entre chiffre d affaires et prix de reprise.",
    jalons: [
      { annee: 2020, libelle: "chiffre d affaires", montantVerbatim: '287 M£', devise: 'GBP', fiabilite: 'presse', source: A_COLLECTER },
      { annee: 2022, libelle: 'placement sous administration, mai', fiabilite: 'officiel', source: A_COLLECTER },
      { annee: 2022, libelle: 'reprise de la propriete intellectuelle par Frasers', montantVerbatim: '20,0 M£', devise: 'GBP', fiabilite: 'officiel', source: 'communique Frasers, mai 2022' },
    ],
  },
  {
    name: 'Matches', founded: 1987, assetClass: 'ecommerce-dtc', stade: 'mature',
    outcome: 'failure', pays: 'Royaume-Uni', statut: 'liquidee en 2024',
    sousSecteur: 'mode de luxe',
    modeleEconomique: 'distribution en ligne de marques de luxe, selection editorialisee',
    pieges: "moins de trois mois separent l acquisition par un industriel du placement sous administration : c est un cas de diligence acquereur et pas seulement un echec d exploitation. Meme piege de rapport que Made.com entre prix d acquisition et passif.",
    jalons: [
      { annee: 2023, libelle: 'acquisition par Frasers, decembre', montantVerbatim: '52 M£', devise: 'GBP', fiabilite: 'officiel', source: 'communique Frasers, decembre 2023' },
      { annee: 2023, libelle: 'LBITDA ajuste', montantVerbatim: '-33,5 M£', devise: 'GBP', fiabilite: 'base-agregee', source: 'comptes' },
      { annee: 2024, libelle: 'placement sous administration, mars', fiabilite: 'officiel', source: A_COLLECTER },
      { annee: 2024, libelle: 'passif estime, plus de 500 creanciers', montantVerbatim: '~36 M£', devise: 'GBP', fiabilite: 'presse', source: A_COLLECTER },
    ],
  },
  {
    name: 'About You', founded: 2014, assetClass: 'ecommerce-dtc', stade: 'mature',
    outcome: 'contested', pays: 'Allemagne', statut: 'absorbee par Zalando, radiee le 6 novembre 2025',
    sousSecteur: 'mode',
    modeleEconomique: 'plateforme de mode en ligne a forte composante editoriale et sociale',
    pieges: "les deux montants sont des prix par action et non des valorisations : sans le nombre d actions, aucune valeur d entreprise n en descend. Le rapport entre les deux reste juste parce qu il rapporte deux grandeurs de meme nature. About You Holding SE publie un consolide IFRS et un social HGB, meme entite et meme date, deux chiffres non additionnables. L operation porte huit dates distinctes : celle du controle est le reglement-livraison du 11 juillet 2025, pas l annonce de decembre 2024.",
    jalons: [
      { annee: 2021, libelle: 'introduction en bourse, juin', montantVerbatim: '23 €/action', devise: 'EUR', fiabilite: 'officiel', source: A_COLLECTER },
      { annee: 2025, libelle: 'prise de controle par Zalando au reglement-livraison, 11 juillet', montantVerbatim: '6,50 €/action', devise: 'EUR', fiabilite: 'officiel', source: 'document d offre publique Zalando, janvier 2025' },
    ],
  },
];
