# Validation extraction financiere sur corpus

Rapport genere le 2026-07-15, harnais scripts/validate-extraction-corpus.ts.
Timeout Anthropic local 180000ms (SDK production reste 60s, non modifie).
Alignement pipeline : lecture de tous les fichiers via processFileRefs, extraction avec pitchDeck.payload + businessPlan.payload comme en production.

## Trois questions

- Q1. Sur combien de dossiers le modele produit une valeur lastActualYear ?
- Q2. Sur combien il s abstient explicitement (extraction reussie mais valeur null) ?
- Q3. Sur combien la valeur passe les gardes de la primitive (evidence non vide, annee presente dans les projections, annee non posterieure a la derniere annee des projections) ?

## Chiffres bruts

- Dossiers total en corpus : 4
- Dossiers avec upload : 4
- Dossiers skip (pas d upload) : 0
- Erreurs download / extraction / classification : 0
- Dossiers avec business plan classifie : 1
- Dossiers avec fichier "others" non integre en extraction : 0

**Q1 :** 4 / 4 dossiers avec upload produisent une valeur lastActualYear non nulle.
**Q2 :** 0 / 4 dossiers avec upload : extraction reussie mais lastActualYear=null (abstention).
**Q3 :** 4 / 4 dossiers passent les gardes de la primitive.

Duree totale : 252s.

## Tableau par dossier

| Dossier | Statut | Fichiers | BP classifie | Others | lastActualYear | Evidence (extrait) | MaxProj | Primitive |
|---|---|---|---|---|---|---|---|---|
| Redcats Children and Family Br | ok | 1 | non |  | 2011 | «2009a 2010a 2011a» dans les tableaux financiers détaillés ; | 2015 | OK |
| Braincube | ok | 1 | non |  | 2021 | Tableau P&L page 19/100 : colonnes '2020a' et '2021a' avec l | 2027 | OK |
| Smart&co | ok | 1 | non |  | 2012 | "Historical consolidated accounts as published" et "Pro Form | — | OK |
| TOLSON | ok | 2 | oui |  | 2024 | BP feuille Management BP et Outputs : colonne '2024A' avec R | 2026 | OK |

## Motifs de rejet par la primitive

- aucun rejet

## Justesse

Ce rapport mesure ce que le modele produit, il ne sait pas ce qui est vrai.
Verification manuelle sur echantillon a effectuer separement.