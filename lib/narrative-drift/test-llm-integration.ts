// ============================================================
// TEST LLM REEL - Narrative Drift sur six corpus calibres
// ------------------------------------------------------------
// Lance le moteur analyzeNarrativeDrift en VRAI sur chaque
// corpus deja calibre par calibration.test.ts. Compare ensuite
// les outputs LLM avec les attentes basees sur les metriques
// objectives :
//
//   WeWork (ratio 2.75) -> drapeau-rouge attendu
//   Theranos (ratio 5.20) -> drapeau-rouge attendu, score > 80
//   Airbnb (ratio 0.03) -> sain attendu, score < 30
//   Stripe (ratio 0.14) -> sain attendu malgre ton mission
//   Mistral (ratio 0.32) -> sain ou attention, score < 50
//   Controle SaaS (ratio 0.03) -> sain attendu
//
// Lance : ANTHROPIC_API_KEY=xxx tsx test-narrative-drift-llm.ts
// ============================================================

import { analyzeNarrativeDrift } from '../engines/narrative-drift-engine';
import type { ExtractionOutput } from '../engines/types';

// Reprend les corpus du fichier de calibration
const wework = `
We are a community company committed to maximum global impact. Our mission is to elevate
the world's consciousness. We have built a worldwide platform that supports growth, shared
experiences and true success. We provide our members with flexible access to beautiful
spaces, a culture of inclusivity and the energy of an inspired community, all connected by
our extensive technology infrastructure.
We believe our company has the power to elevate how people work, live and grow. Over the
past nine years, we have rapidly scaled our business while honoring our mission. Today,
our global platform integrates space, community, services and technology in over 528
locations in 111 cities across 29 countries. Our 527,000 memberships represent global
enterprises across multiple industries, including 38% of the Global Fortune 500.
Our mission is to elevate the world's consciousness. Philosophically, we believe in
bringing comfort and happiness to the workplace. We believe workers are yearning for a
re-invention of work as they search for more flexible solutions while doing more
independent work and becoming more willing to share spaces with others. Renters at
WeWork offices are not clients or customers, but members. Neighboring workers are not
just colleagues, but part of a community.
We dedicate this to the energy of we, greater than any one of us, but inside each of us.
Our powerful brand, global footprint, scalable business model and cost advantage are
significant competitive advantages that will allow us to further penetrate existing and
new markets and maximize the future impact of the WeWork effect. The We Company is
reinventing the way people work, helping them make a life, not just a living.
We are committed to maximum global impact. We are reinventing work. We are transforming
the human experience of community. We are building a platform of platforms, a worldwide
ecosystem dedicated to the elevation of human potential through space, technology, and
shared purpose.
`;

const theranos = `
Our mission is to revolutionize healthcare. We are democratizing access to actionable
health information by enabling consumers and physicians to take charge of their wellness.
We believe that every person deserves access to their own health information, and we
believe that the right to access this information is a fundamental human right.
Theranos is a transformative force in laboratory medicine. We are reinventing the way
that blood tests are performed, transforming the patient experience through a focus on
what truly matters: empowerment, dignity, accessibility. Our vision is to create a world
in which no one has to say goodbye too soon.
This is not just a technology company, it is a movement. A movement to reinvent the
relationship between people and their own health. A movement to elevate consciousness
around what is possible when access becomes universal. A movement to bring meaning back
to medicine.
Our work transcends the traditional boundaries of an industry. We are building a platform
that fundamentally redefines how diagnostic information flows. Through our infrastructure,
we are not just delivering tests, we are delivering the promise of a new era of healthcare.
This is what happens when you work to change things, and first they think you are crazy,
then they fight you, and then, all of a sudden, you change the world. We are dedicated
to the patients we serve. We are dedicated to the families. We are dedicated to the
fundamental human right of every person to know their own body. To know their own
biology. To know their own future.
Our technology is the manifestation of years of dedication to a single transformative
idea. The idea that healthcare should be a fundamental right, not a privilege.
`;

const airbnb = `
Airbnb exists because of one simple idea: to belong anywhere starts with belonging
somewhere. We are eager to tell you the story of Airbnb. Our hosts are at the heart of
our model. Hosts share their homes and offer experiences to guests, and we provide them
with the tools to do so. As of September 30, 2020, we had over 4 million hosts worldwide
who have welcomed more than 825 million guest arrivals in approximately 100,000 cities
since our founding.
In 2019, we generated revenue of 4.8 billion dollars and a net loss of 674 million
dollars. In the nine months ended September 30, 2020, revenue was 2.5 billion dollars
and net loss was 697 million dollars. Our hosts have collectively earned more than 110
billion dollars from listings on our platform. In 2019, we processed 327 million nights
and experiences booked.
Our cost of revenue includes payment processing costs, including merchant fees and
chargebacks, costs associated with the operation of our platform. In 2019, our cost of
revenue was 1.2 billion dollars, representing 25% of revenue. Our gross profit was 3.6
billion dollars, representing a gross margin of 75%. Sales and marketing expenses were
1.6 billion dollars, representing 33% of revenue.
We have made significant investments in trust and safety, including a 24/7 customer
support team operating in dozens of languages, a host guarantee program covering up to
1 million dollars in damages per stay. We employ approximately 5,400 employees across
24 offices, of whom approximately 1,100 are engineers.
In Q4 2020, revenue was 859 million dollars, a decline of 22% year-over-year. Total
revenue for 2020 was 3.4 billion dollars. We had cash and cash equivalents of 2.5 billion
dollars as of September 30, 2020. Our business model is asset-light: we do not own the
homes listed on our platform, hosts do.
`;

const stripe = `
In 2023, despite predictions of doom and gloom, the internet economy grew at a healthy
clip, as did businesses building on Stripe. Our users processed a collective 1 trillion
dollars on Stripe, equivalent to 1 percent of global GDP and growing. This represents
25 percent growth from the prior year. More than 100 companies each now handle more
than 1 billion dollars in payments annually with Stripe, including Uber, Microsoft,
Amazon, Hertz, Alaska Airlines, Airbnb, and FOX Sports.
Stripe was robustly cash flow positive in 2023 and plans to enforce that position
further in 2024. We expect revenue from our revenue, finance and automation suites to
surpass 500 million dollars this year. On Black Friday and Cyber Monday, Stripe
maintained 99.999 percent uptime and processed more than 300 million transactions.
Today we are announcing the hardest change we have had to make at Stripe to date. We
are reducing the size of our team by around 14 percent. In our view, we made two
consequential mistakes. We were much too optimistic about the internet economy growth
in 2022 and 2023 and underestimated both the likelihood and impact of a broader
slowdown. We grew operating costs too quickly.
We will pay 14 weeks of severance for all departing employees. We will pay our 2022
annual bonus for all departing employees. We will pay the cash equivalent of 6 months
of existing healthcare premiums or healthcare continuation.
Stablecoin transaction volumes more than doubled between Q4 2023 and Q4 2024, and there
are more than 40 million monthly active wallets. Stripe acquired Bridge stablecoin
services provider in October 2024 for 1.1 billion dollars, the largest crypto buyout
to date.
Stripe mission is to grow the GDP of the internet. The core idea behind the company is
that we are still early in the journey of software-driven innovation, and Stripe is an
applied exercise in thinking through some of the corollaries of that.
`;

const mistral = `
At Mistral AI, we believe the future of artificial intelligence is open, collaborative,
and built for everyone. Our mission is to create a European champion with a global
vocation in generative artificial intelligence, based on an open, responsible, and
decentralized approach to technology.
In September 2023, Mistral launched Mistral 7B, a 7 billion parameter open source AI
model under Apache 2.0 license. Two months after launching, Mistral raised 105 million
euros in what became Europe largest seed round for a tech company. The startup was
barely a few weeks old and was already valued at over 260 million dollars.
Mistral plans to invest over 1 billion dollars in the construction of an AI-focused
data center in Sweden in partnership with EcoDataCenter. The facility will deliver
AI-native infrastructure built for performance, efficiency, and full European control.
Mistral made its first acquisition with the deal to buy Koyeb.
Pixtral 12B is an open multimodal model, offered under an Apache 2.0 license, capable
of both text-in and image-in tasks. Its architecture combines a 12B multimodal decoder
based on Mistral Nemo and a 400M parameter vision encoder. The Ministral 3 model can
run on a single GPU. All variants support vision, handle 128,000 to 256,000 context
windows, and work across languages.
Mistral Compute uses EU-based data centers, certified across multiple international
standards. Other capabilities include networking and isolation controls, encryption at
rest, optional customer-held keys, and support for enterprise-type identity, access,
secrets, and policy tools.
Mistral collaborates with Singapore Home Team Science and Technology Agency on
specialized models for robots, cybersecurity systems, and fire safety, with German
defense tech startup Helsing on vision-language-action models for drones, and with
automaker Stellantis on an in-car AI assistant.
`;

const controle = `
Notre societe edite une plateforme SaaS de gestion de la relation client pour les ETI
europeennes. Nous comptons aujourd hui 142 clients actifs, dont 38 ont signe un contrat
en 2024. Le revenu annuel recurrent atteint 12.4 millions d euros en croissance de 67%
sur 12 mois. La marge brute s etablit a 78% et le churn annuel logo a 4.2%, en baisse
de deux points par rapport a 2023.
L equipe compte 67 salaries dont 31 ingenieurs et 12 commerciaux. Le burn mensuel est
de 380 000 euros, le runway disponible de 18 mois. Notre LTV moyen client est de 87 000
euros pour un CAC de 14 200 euros, soit un payback de 11 mois.
Nous prevoyons d ouvrir 4 nouveaux marches en 2025 (Allemagne, Italie, Pays-Bas,
Espagne) avec un objectif de 35 nouveaux clients par marche en 18 mois. Le pipeline
commercial total atteint 8.7 millions d euros, dont 2.3 millions en POC payants et
1.1 million en contrats signes en attente de demarrage.
Le board comprend deux administrateurs independants et trois representants des
investisseurs. La levee Series B de 18 millions est prevue pour Q3 2025 sur la base
d une valorisation pre-money de 95 millions.
`;

interface CorpusTest {
  name: string;
  pitch: string;
  expectedVerdict: string;
  expectedScoreRange: [number, number];
  expectedArchetypeDirection: 'sain' | 'derive-confirmee';
  ratioCalibrated: number;
}

const corpora: CorpusTest[] = [
  { name: 'WeWork S-1 (2019)', pitch: wework, expectedVerdict: 'drapeau-rouge', expectedScoreRange: [70, 100], expectedArchetypeDirection: 'derive-confirmee', ratioCalibrated: 2.75 },
  { name: 'Theranos (2014-2015)', pitch: theranos, expectedVerdict: 'drapeau-rouge', expectedScoreRange: [80, 100], expectedArchetypeDirection: 'derive-confirmee', ratioCalibrated: 5.20 },
  { name: 'Airbnb S-1 (2020)', pitch: airbnb, expectedVerdict: 'sain', expectedScoreRange: [0, 30], expectedArchetypeDirection: 'sain', ratioCalibrated: 0.03 },
  { name: 'Stripe annual letter', pitch: stripe, expectedVerdict: 'sain', expectedScoreRange: [0, 30], expectedArchetypeDirection: 'sain', ratioCalibrated: 0.14 },
  { name: 'Mistral AI (FR test)', pitch: mistral, expectedVerdict: 'sain', expectedScoreRange: [0, 50], expectedArchetypeDirection: 'sain', ratioCalibrated: 0.32 },
  { name: 'Controle B2B SaaS', pitch: controle, expectedVerdict: 'sain', expectedScoreRange: [0, 30], expectedArchetypeDirection: 'sain', ratioCalibrated: 0.03 },
];

function makeExtraction(name: string, sector: string, stage: string): ExtractionOutput {
  return {
    companyName: name,
    sector,
    subSector: 'unknown',
    geographicHub: 'unknown',
    country: 'unknown',
    yearFounded: null,
    founders: [],
    marketPitch: '',
    productDescription: '',
    businessModel: '',
    traction: { metrics: [] },
    fundraise: { stage, amount: 'unknown' },
  } as any;
}

const sectorMap: Record<string, [string, string]> = {
  'WeWork S-1 (2019)': ['Real Estate', 'Pre-IPO'],
  'Theranos (2014-2015)': ['Healthcare', 'Series E'],
  'Airbnb S-1 (2020)': ['Marketplace', 'Pre-IPO'],
  'Stripe annual letter': ['Fintech', 'Growth'],
  'Mistral AI (FR test)': ['AI', 'Series B'],
  'Controle B2B SaaS': ['SaaS', 'Series B'],
};

(async () => {
  console.log('='.repeat(70));
  console.log('TEST LLM REEL - NARRATIVE DRIFT ENGINE');
  console.log('='.repeat(70));
  console.log(`Lancement de ${corpora.length} appels Anthropic API.\n`);

  const t0 = Date.now();
  let pass = 0;
  let fail = 0;

  for (const c of corpora) {
    const [sector, stage] = sectorMap[c.name];
    const extraction = makeExtraction(c.name.split(' (')[0], sector, stage);

    console.log('-'.repeat(70));
    console.log(`CORPUS : ${c.name}`);
    console.log(`Ratio calibre : ${c.ratioCalibrated} | Verdict attendu : ${c.expectedVerdict} | Score attendu : ${c.expectedScoreRange[0]}-${c.expectedScoreRange[1]}`);
    console.log('-'.repeat(70));

    const start = Date.now();
    try {
      const result = await analyzeNarrativeDrift({
        extraction,
        pitchText: c.pitch,
        additionalCommunications: [],
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      console.log(`Duree appel : ${elapsed}s`);
      console.log(`Applicabilite : ${result.applicabilite}`);
      console.log(`Metriques objectives : ratio ${result.metriquesLexicales.ratioAbstraitConcret.toFixed(2)} | densite ${result.metriquesLexicales.densiteConcrete.toFixed(0)} mots/1000`);
      console.log(`globalDriftScore LLM : ${result.globalDriftScore}`);
      console.log(`Verdict LLM : ${result.verdict}`);
      console.log(`Counter-archetype : ${result.counterArchetype.closest} (direction: ${result.counterArchetype.direction})`);
      console.log(`  Rationale : ${result.counterArchetype.rationale}`);
      console.log(``);
      console.log(`Glissement indicateurs : score ${result.glissementIndicateurs.score} | verdict ${result.glissementIndicateurs.verdict}`);
      console.log(`Opacite progressive    : score ${result.opaciteProgressive.score} | verdict ${result.opaciteProgressive.verdict}`);
      console.log(`Narrative Premium      : score ${result.narrativePremiumCollapse.score} | verdict ${result.narrativePremiumCollapse.verdict}`);
      console.log(``);
      console.log(`Recommandation DD : ${result.recommandationDD}`);

      // Verifications
      const verdictOk = result.verdict === c.expectedVerdict;
      const scoreOk = result.globalDriftScore >= c.expectedScoreRange[0] && result.globalDriftScore <= c.expectedScoreRange[1];
      const archetypeOk = result.counterArchetype.direction === c.expectedArchetypeDirection;
      const allOk = verdictOk && scoreOk && archetypeOk;

      console.log(``);
      console.log(`Verdict OK : ${verdictOk ? 'PASS' : 'FAIL'} (attendu ${c.expectedVerdict}, obtenu ${result.verdict})`);
      console.log(`Score OK : ${scoreOk ? 'PASS' : 'FAIL'} (attendu ${c.expectedScoreRange[0]}-${c.expectedScoreRange[1]}, obtenu ${result.globalDriftScore})`);
      console.log(`Archetype direction OK : ${archetypeOk ? 'PASS' : 'FAIL'} (attendu ${c.expectedArchetypeDirection}, obtenu ${result.counterArchetype.direction})`);

      if (allOk) pass++;
      else fail++;
    } catch (err: any) {
      console.log(`ERREUR : ${err.message || err}`);
      fail++;
    }

    console.log('');
  }

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('='.repeat(70));
  console.log(`BILAN GLOBAL : ${pass}/${pass + fail} corpus passent les attentes`);
  console.log(`Duree totale : ${totalElapsed}s`);
  console.log('='.repeat(70));
})();
