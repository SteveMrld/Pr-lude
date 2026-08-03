#!/usr/bin/env bash
# ============================================================
# SUITE DETERMINISTE COMPLETE
# ------------------------------------------------------------
# Un lanceur plutot qu une ligne de commande reecrite a chaque fois.
#
# La raison est un defaut mesure le 3 aout 2026. La boucle que
# j utilisais lisait la derniere ligne de chaque fichier et y cherchait
# un compteur d echecs. Or les fichiers de test n impriment pas tous
# leur compteur en derniere ligne : plusieurs terminent par une ligne
# vide, et pour ceux-la la lecture portait sur du blanc. Elle a donc
# rendu « zero rouge » sur quatre releves consecutifs alors qu une
# assertion etait rouge depuis le premier.
#
# L instrument etait de la meme nature que son objet, une lecture de
# texte pour juger d une sortie de texte, et il echouait exactement la
# ou son objet echouait. C est le second corollaire de la discipline de
# mesure, applique cette fois a l outil qui verifie les autres.
#
# La correction ne consiste pas a lire une ligne de plus. Elle consiste
# a ne plus lire la sortie du tout : le code de sortie du processus est
# la grandeur qui porte le verdict, chaque fichier finissant par
# `process.exit(fail > 0 ? 1 : 0)`. Il n y a rien a interpreter.
#
# Usage : bash scripts/run-all-tests.sh
# ============================================================

set -uo pipefail
cd "$(dirname "$0")/.."

# Les fichiers qui exigent un appel au modele reel ne sont pas dans la
# suite deterministe, par doctrine. Ils sortent en erreur sans cle, ce
# qui est leur comportement correct : les compter comme rouges rendrait
# la suite rouge en permanence, et une suite toujours rouge ne dit plus
# rien. Ils sont nommes ici plutot que devines, et le fait qu ils ne
# tournent pas est imprime plutot que taire.
requiert_cle() {
  grep -ql 'ANTHROPIC_API_KEY' "$1" 2>/dev/null
}

rouges=()
ecartes=()
total=0

while IFS= read -r f; do
  if requiert_cle "$f" && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    ecartes+=("$f")
    continue
  fi
  total=$((total + 1))
  if ! sortie=$(npx tsx "$f" 2>&1); then
    rouges+=("$f")
    echo "ROUGE  $f"
    echo "$sortie" | grep -E "KO|FAIL|fail|Error" | head -5 | sed 's/^/       /'
  fi
done < <(find lib scripts app -name "*.test.ts" | sort)

echo
if [ ${#ecartes[@]} -gt 0 ]; then
  echo "${#ecartes[@]} fichier(s) ecarte(s), appel au modele reel requis et ANTHROPIC_API_KEY absente :"
  printf '  %s\n' "${ecartes[@]}"
  echo
fi
echo "$total fichiers, ${#rouges[@]} rouge(s)."
if [ ${#rouges[@]} -gt 0 ]; then
  printf '  %s\n' "${rouges[@]}"
  exit 1
fi
