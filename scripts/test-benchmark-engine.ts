import { analyzeBenchmarks } from '../lib/engines/benchmark-engine';
import type { ExtractionOutput, FinancialDataExtraction } from '../lib/engines/types';

async function testBenchmarkEngine() {
  console.log('=== Test 1: Series A IA française à 50M$ pre-money, 12M$ deal ===\n');

  const extraction1: ExtractionOutput = {
    companyName: 'Mistral Test',
    sector: 'AI',
    subSector: 'Foundation models',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2023,
    founders: [{ name: 'Test Founder', role: 'CEO', background: 'ex-DeepMind' }],
    marketPitch: 'Pitch IA generative',
    productDescription: 'Foundation model open source',
    businessModel: 'API SaaS',
    traction: { metrics: ['100K developers'], revenue: '5M€' },
    fundraise: {
      stage: 'Series A',
      amount: '12M€',
      valuation: '50M€',
    },
    competitorsCited: ['OpenAI', 'Anthropic'],
    rawSummary: 'test',
  };

  const financial1: FinancialDataExtraction = {
    hasBP: true,
    fileSource: 'both',
    revenueProjection: [],
    grossMarginProjection: [],
    ebitdaProjection: [],
    fcfProjection: [],
    unitEconomics: { estimatedCAC: '', estimatedLTV: '', estimatedLtvCacRatio: '', averageContractValue: '', grossMarginPerUnit: '' },
    headcount: [],
    opexProjection: [],
    currentRound: { amount: '12M€', runwayMonths: '24', monthlyBurn: '500K€' },
    marketAssumptions: { tamCited: '', samCited: '', targetMarketShare: '', targetCustomersByYearN: '' },
    rawNotes: '',
  };

  const result1 = await analyzeBenchmarks(extraction1, financial1);
  console.log(JSON.stringify(result1, null, 2));

  console.log('\n\n=== Test 2: Seed non-IA US à 25M$ pre-money, 5M$ deal ===\n');
  const extraction2: ExtractionOutput = {
    ...extraction1,
    sector: 'Fintech',
    subSector: 'Payment infrastructure',
    country: 'United States',
    fundraise: { stage: 'Seed', amount: '$5M', valuation: '$25M' },
  };
  const result2 = await analyzeBenchmarks(extraction2, null);
  console.log(JSON.stringify(result2, null, 2));

  console.log('\n\n=== Test 3: Series B IA UK à 250M$ pre-money, 60M$ deal ===\n');
  const extraction3: ExtractionOutput = {
    ...extraction1,
    sector: 'AI',
    subSector: 'Enterprise AI agents',
    country: 'United Kingdom',
    fundraise: { stage: 'Series B', amount: '$60M', valuation: '$250M' },
  };
  const result3 = await analyzeBenchmarks(extraction3, null);
  console.log(JSON.stringify(result3, null, 2));
}

testBenchmarkEngine().catch((err) => {
  console.error(err);
  process.exit(1);
});
