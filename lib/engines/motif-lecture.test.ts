// ============================================================
// Tests deterministes des motifs de non-lecture
// ------------------------------------------------------------
// Ce que ces tests prouvent : aucun motif de refus n affirme sur le
// document, les deux moteurs qui en produisent disent la meme chose
// par la meme fonction, et deux causes distinctes ne sortent plus par
// une phrase unique reliee par un « ou ».
//
// « Aucun montant annonce » etait faux de tout dossier qui en porte un
// que la lecture a manque, et faux en silence : le partner y lit une
// propriete du dossier, donc il ne redemande rien, donc la lacune de
// lecture ne remonte jamais.
//
// Le jeu d essai entre par la porte de la production, et il fait
// varier la seule cause de lecture entre deux dossiers par ailleurs
// identiques : si les deux rendaient la meme phrase, il mesurerait
// l identite de deux branches et non la dependance du motif a ce que
// la lecture a fait.
//
// Execution : npx tsx lib/engines/motif-lecture.test.ts
// ============================================================

import { motifChampNonLu, causeChamp } from './motif-lecture';
import { analyzeBenchmarks } from './benchmark-engine';
import { __testables } from './valuation-engine';
import type { ExtractionOutput } from './types';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Une extraction minimale mais typee, sans cast de complaisance. */
function extraction(fundraise: Partial<ExtractionOutput['fundraise']>): ExtractionOutput {
  return {
    companyName: 'Dossier temoin',
    sector: 'SaaS',
    subSector: 'vertical',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2019,
    founders: [],
    marketPitch: '',
    productDescription: '',
    businessModel: '',
    traction: { metrics: [] },
    fundraise: {
      stage: 'series-A-early',
      amount: '',
      operationType: 'levee',
      operationTypeEvidence: 'levee de Series A',
      ...fundraise,
    },
    competitorsCited: [],
    rawSummary: '',
  };
}

async function main() {
  console.log('\n[Suite 1] aucune phrase n affirme sur le document');
  {
    for (const champ of ['montant', 'valorisation'] as const) {
      for (const cause of ['non-rendu', 'non-cite', null, undefined] as const) {
        const m = motifChampNonLu(champ, cause);
        check(
          !/aucun montant annonce|aucune valorisation annoncee|le document ne|le dossier ne porte/i.test(m),
          `${champ}/${cause}: ne prononce pas le document muet`,
        );
        check(/dossier/.test(m), `${champ}/${cause}: parle de la lecture du dossier`);
      }
    }
  }

  console.log('\n[Suite 2] les deux causes ne sortent pas par le meme canal');
  {
    const nonRendu = motifChampNonLu('montant', 'non-rendu');
    const nonCite = motifChampNonLu('montant', 'non-cite');
    check(nonRendu !== nonCite, 'une valeur refusee faute de citation ne se dit pas comme une valeur non rendue');
    check(/refuse/.test(nonCite), 'et le refus est nomme, parce qu il y a quelque chose a aller rechercher');

    // Le contrat anterieur ne porte pas la question. Son silence n est
    // pas une reponse : il recoit la phrase prudente, pas celle qui
    // affirme qu une valeur a ete refusee.
    check(motifChampNonLu('montant', undefined) === nonRendu, 'le contrat anterieur recoit la phrase prudente');
    check(motifChampNonLu('valorisation', 'non-cite') !== nonCite, 'et les deux champs ne se disent pas au masculin unique');
  }

  console.log('\n[Suite 3] la cause se lit sans supposer que le champ existe');
  {
    check(causeChamp(extraction({ amountCause: 'non-cite' }), 'montant') === 'non-cite', 'la cause du montant est lue');
    check(causeChamp(extraction({}), 'montant') === undefined, 'absente sur une extraction qui ne la porte pas');
    check(causeChamp(null, 'montant') === undefined, 'et sur une extraction absente');
    check(causeChamp(undefined, 'valorisation') === undefined, 'sans jeter');
  }

  console.log('\n[Suite 4] le moteur de valorisation sert le motif de la lecture');
  {
    const rendu = __testables.parseTicket(extraction({ amount: '', amountCause: 'non-rendu' }));
    const cite = __testables.parseTicket(extraction({ amount: '', amountCause: 'non-cite' }));

    check(rendu.total === null && cite.total === null, 'aucun ticket lu dans les deux cas');
    check(!/aucun montant annonce/i.test(rendu.causeMotif || ''), 'le motif ne dit plus aucun montant annonce');
    check(
      rendu.causeMotif !== cite.causeMotif,
      'et il depend de ce que la lecture a fait, seule chose qui differe entre les deux dossiers',
    );
    check(/refuse/.test(cite.causeMotif || ''), 'le montant refuse faute de citation est nomme comme tel');

    // Contrat anterieur : ni citation ni cause. La phrase prudente, et
    // surtout pas celle qui affirme un refus qui n a pas eu lieu.
    const heritage = __testables.parseTicket(extraction({ amount: '' }));
    check(heritage.causeMotif === rendu.causeMotif, 'une analyse anterieure recoit la phrase prudente');
  }

  console.log('\n[Suite 5] le moteur de benchmarks sert le meme motif');
  {
    const rendu = await analyzeBenchmarks(
      extraction({ amount: '', amountCause: 'non-rendu', valuation: '', valuationCause: 'non-rendu' }),
      null,
    );
    const cite = await analyzeBenchmarks(
      extraction({ amount: '', amountCause: 'non-cite', valuation: '', valuationCause: 'non-cite' }),
      null,
    );

    const wRendu = rendu.warnings.join(' | ');
    const wCite = cite.warnings.join(' | ');

    check(!/non extractible/i.test(wRendu), 'l avertissement ne dit plus non extractible du dossier');
    check(wRendu !== wCite, 'et il varie avec la cause de lecture');
    check(/refusee?/.test(wCite), 'la valeur refusee faute de citation est nommee comme telle');

    // Le resume du positionnement separe la valeur non lue du benchmark
    // absent, la ou une seule phrase reliait les deux par un « ou ».
    const resumes = rendu.preMoney.summary + ' ' + rendu.dealSize.summary;
    check(!/ou benchmark indisponible/i.test(resumes), 'les deux causes ne sont plus reliees par un ou');
    check(
      rendu.preMoney.summary.includes('valorisation non extraite du dossier'),
      'le resume pre-money nomme ce que la lecture a fait',
    );
    check(
      /benchmark de stade, lui, est disponible/.test(rendu.dealSize.summary),
      'et il dit que le benchmark, lui, etait la : la cause manquante est nommee, pas devinee',
    );

    // Stade inconnu : le benchmark manque aussi. Les deux causes se
    // disent, et separement.
    const sansStade = await analyzeBenchmarks(
      extraction({ stage: 'inconnu', amount: '', amountCause: 'non-rendu' }),
      null,
    );
    check(
      /aucun benchmark de taille de tour/i.test(sansStade.dealSize.summary),
      'benchmark absent : le resume le dit',
    );
    check(
      /montant non extrait du dossier/i.test(sansStade.dealSize.summary),
      'et il dit aussi que le montant n a pas ete lu, sans choisir entre les deux',
    );

    // Une valeur lue passe : le motif ne s invite pas quand il n a rien
    // a faire la.
    const lu = await analyzeBenchmarks(
      extraction({ amount: '4 M€', amountEvidence: 'levee de 4 M€', amountCause: null }),
      null,
    );
    check(
      !/non extrait/i.test(lu.dealSize.summary),
      'un montant lu ne declenche aucun motif de non-lecture',
    );
  }

  console.log(`\n${pass} OK, ${fail} KO\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
