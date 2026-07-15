// ============================================================
// Tests SSR SectionFallbackLine
// ------------------------------------------------------------
// Prouve que la prop enginesStatus atteint bien le composant et
// que ses data-attributes discrets refletent la valeur recue.
// Rendu server via renderToStaticMarkup, aucun dom navigateur.
// ============================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SectionFallbackLine from './SectionFallbackLine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - enginesStatus vivant atteint bien le composant
// ============================================================

console.log('\n[Suite 1] enginesStatus atteint bien SectionFallbackLine');

{
  const html = renderToStaticMarkup(
    React.createElement(SectionFallbackLine, {
      kind: 'market',
      enginesStatus: {
        market: { status: 'empty_output', durationMs: 0, attempts: 1 },
        narrativeDrift: { status: 'timeout', durationMs: 120000, attempts: 1, errorMessage: 'deadline-exceeded' },
      },
      engineKey: 'market',
    })
  );
  check(html.includes('data-engines-status="present"'), 'enginesStatus non nul => data-engines-status="present"');
  check(html.includes('data-engine-key="market"'), 'engineKey remonte en data-attribute');
  check(html.includes('data-engine-status="empty_output"'), 'status specifique remonte pour la cle demandee');
  check(html.includes('data-kind="market"'), 'kind remonte');
  // Le texte visible reste la copie doctrinale, non consomme aujourd hui
  check(html.includes('L’analyse de marché'), 'copie doctrinale market rendue');
  check(!html.includes('empty_output') || html.match(/empty_output/g)?.length === 1, 'empty_output n apparait que dans le data-attribute, pas dans la copie');
}

{
  const html = renderToStaticMarkup(
    React.createElement(SectionFallbackLine, {
      kind: 'section-generic',
      enginesStatus: null,
      engineKey: 'extraction',
    })
  );
  check(html.includes('data-engines-status="absent"'), 'enginesStatus null => data-engines-status="absent"');
  check(!html.includes('data-engine-status='), 'aucun data-engine-status quand snapshot vide');
}

{
  const html = renderToStaticMarkup(
    React.createElement(SectionFallbackLine, {
      kind: 'section-generic',
      enginesStatus: undefined,
    })
  );
  check(html.includes('data-engines-status="absent"'), 'enginesStatus undefined => absent');
}

{
  const html = renderToStaticMarkup(
    React.createElement(SectionFallbackLine, {
      kind: 'section-generic',
      enginesStatus: {},
    })
  );
  check(html.includes('data-engines-status="absent"'), 'enginesStatus objet vide => absent (snapshot present mais pas peuple)');
}

{
  // Snapshot avec entree ok pour le engineKey demande
  const html = renderToStaticMarkup(
    React.createElement(SectionFallbackLine, {
      kind: 'section-generic',
      enginesStatus: {
        extraction: { status: 'ok', durationMs: 4200, attempts: 1 },
      },
      engineKey: 'extraction',
    })
  );
  check(html.includes('data-engines-status="present"'), 'snapshot peuple => present');
  check(html.includes('data-engine-status="ok"'), 'entree ok remontee');
}

{
  // engineKey qui n existe pas dans le snapshot
  const html = renderToStaticMarkup(
    React.createElement(SectionFallbackLine, {
      kind: 'market',
      enginesStatus: { extraction: { status: 'ok', durationMs: 4200, attempts: 1 } },
      engineKey: 'market',
    })
  );
  check(html.includes('data-engines-status="present"'), 'snapshot peuple mais cle absente => still present');
  check(!html.includes('data-engine-status='), 'aucun data-engine-status si cle demandee absente du snapshot');
}

// ============================================================
// SUITE 2 - Contrat source InvestmentNoteView
// ------------------------------------------------------------
// Verifie que les trois SectionFallbackLine du composant note
// utilisent bien la prop typee et non plus (r as any).
// ============================================================

console.log('\n[Suite 2] Contrat source InvestmentNoteView');

{
  const src = require('fs').readFileSync('/home/steve/Pr-lude/app/components/InvestmentNoteView.tsx', 'utf-8') as string;
  check(!src.includes('(r as any)?.pipelineEnginesStatus'), 'aucun (r as any)?.pipelineEnginesStatus residuel');
  check(src.includes('pipelineEnginesStatus?: Record<string, any> | null'), 'prop typee declaree dans Props');
  check(src.includes('pipelineEnginesStatus = null'), 'prop destructuree avec default null');
  const enginesStatusPasses = (src.match(/enginesStatus=\{pipelineEnginesStatus\}/g) || []).length;
  check(enginesStatusPasses >= 3, `au moins 3 sites passent enginesStatus depuis la prop (obtenu ${enginesStatusPasses})`);
}

{
  const src = require('fs').readFileSync('/home/steve/Pr-lude/app/HomeClient.tsx', 'utf-8') as string;
  check(src.includes('setPipelineEnginesStatus'), 'setPipelineEnginesStatus present dans HomeClient');
  check(src.includes('setPipelineEnginesStatus(data.analysis.pipelineEnginesStatus'), 'HomeClient stocke la valeur lue depuis l API');
  const propagations = (src.match(/pipelineEnginesStatus=\{pipelineEnginesStatus\}/g) || []).length;
  check(propagations >= 2, `au moins 2 InvestmentNoteView recoivent la prop (obtenu ${propagations})`);
}

// ============================================================
// SORTIE
// ============================================================

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
