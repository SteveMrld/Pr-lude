# Prélude Platform v2

Plateforme d'instruction de pitch decks pour fonds VC européens early-stage. Sept moteurs interconnectés. Le moteur d'équipe est désormais enrichi par interrogation de sources publiques externes en temps réel (OpenAlex, GitHub, Wikipedia, arXiv).

## Ce qui change avec la v2

Le moteur d'équipe ne fait plus que paraphraser le pitch deck. Pour chaque fondateur extrait du deck, il lance en parallèle quatre requêtes vers des APIs publiques gratuites :

- **OpenAlex** récupère les vraies publications académiques, le h-index, les citations, les institutions
- **GitHub** récupère le vrai profil, les followers, les top repos avec étoiles
- **Wikipedia** vérifie l'existence d'une page publique structurée
- **arXiv** récupère les vrais preprints récents

Ces données vérifiées sont ensuite croisées avec les déclarations du pitch deck par Claude, qui produit une analyse rigoureuse identifiant ce qui est confirmé, ce qui n'est pas vérifiable, et les écarts éventuels.

Un nouvel onglet "Données vérifiées" dans l'UI affiche directement les chiffres récupérés des sources publiques, sans interprétation IA.

## Architecture des sept moteurs

1. **Extraction** · structure les données du pitch deck
2. **Équipe** ⚡ · interroge sources publiques + croise avec déclaratif
3. **Marché** · taille perçue vs intensité réelle, défensibilité
4. **Macro** · cycle, géopolitique, fenêtre temporelle critique
5. **Pattern matching** · algorithme de proximité + corpus de 32 cas
6. **Retournement causal** · sept angles morts, questions à instruire
7. **Orchestration** · score global, recommandation finale

Les moteurs 2, 3, 4 s'exécutent en parallèle. Les moteurs 5, 6, 7 en cascade.

## Stack

- Next.js 14 + TypeScript
- API Anthropic (claude-sonnet-4-5)
- APIs publiques gratuites pour data réelle
- Server-Sent Events streaming
- Déployable Vercel

## Installation locale

```bash
npm install
cp .env.example .env.local
# Ajouter ANTHROPIC_API_KEY dans .env.local
npm run dev
```

## Déploiement Vercel

1. Pousser sur GitHub
2. Importer dans Vercel
3. Ajouter `ANTHROPIC_API_KEY` dans Settings > Environment Variables
4. Déployer

## Test du moteur d'équipe en standalone

Le script Python `team_engine.py` (livré séparément) permet de tester le moteur d'équipe sans déployer.

```bash
pip install requests
python3 team_engine.py
```

Il analyse l'équipe Mistral AI par défaut. Modifie `mistral_team` à la fin du fichier pour analyser une autre équipe.

## Coûts

- API Claude : 0.30 à 0.60 USD par pipeline complet
- APIs OpenAlex / GitHub / Wikipedia / arXiv : gratuites sans limite raisonnable

## Pour aller plus loin

Le moteur d'équipe v2 est un modèle. Les autres moteurs peuvent être enrichis de la même manière en ajoutant des sources dans `lib/data-fetchers/sources.ts` :

- **Moteur de marché** : Hacker News Algolia, Crunchbase Basic API, Wikipedia secteur
- **Moteur macro** : FRED API, ECB Statistical Data Warehouse, World Bank API
- **Moteur de pattern matching** : déjà enrichi par la base de 32 cas structurés

C'est l'architecture Aladdin appliquée au VC. Pas un wrapper d'API. Une couche de données réelles agrégées + des moteurs analytiques par-dessus.
