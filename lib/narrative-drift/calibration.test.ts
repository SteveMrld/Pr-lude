// ============================================================
// CALIBRATION EMPIRIQUE - Narrative Drift
// ------------------------------------------------------------
// Test de calibration de la taxonomie lexicale sur deux corpus
// publics opposes :
//
//   1. WeWork S-1 (2019) : cas pedagogique de derive narrative
//      extreme. Mission "elevate the world's consciousness",
//      auto-description comme "community company", langage
//      saturé en abstrait. Communication s effondre vs realite
//      (47Mds valuation -> 8Mds en 6 semaines, IPO retiree).
//
//   2. Airbnb S-1 (2020) : meme archetype apparent (platform
//      marketplace) mais communication sobre, structuree,
//      financiere. IPO reussie, valorisation tenue post-IPO.
//
// Si la taxonomie discrimine bien, on doit voir :
//   - WeWork : ratio abstrait/concret eleve (> 1.0)
//   - Airbnb : ratio abstrait/concret bas (< 0.5)
//
// Si les deux ratios sont proches, la taxonomie est mal
// calibree et il faut la revoir avant d ecrire le prompt.
//
// Lance : tsx lib/narrative-drift/calibration.test.ts
// ============================================================

import { scoreText } from './score-text';
import { TAXONOMY_STATS } from './taxonomy';

// ------------------------------------------------------------
// CORPUS 1 : Extraits du S-1 WeWork (aout 2019)
// ------------------------------------------------------------
// Sources : SEC.gov d781982ds1.htm + presse contemporaine
// (CNBC, Axios, Fortune, Slate, The Corporate Counsel,
// Sherwood, BusinessInsider, FourWeekMBA).
// ------------------------------------------------------------

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
enterprises across multiple industries, including 38% of the Global Fortune 500. We are
committed to providing our members around the world with a better day at work for less.

Our mission is to elevate the world's consciousness. Philosophically, we believe in
bringing comfort and happiness to the workplace. We believe workers are yearning for a
re-invention of work as they search for more flexible solutions while doing more
independent work and becoming more willing to share spaces with others. Renters at
WeWork offices are not clients or customers, but members. Neighboring workers are not
just colleagues, but part of a community. Employees at the company's workspaces are a
community team made up of strong operators who are also mission-driven individuals
inspired by the opportunity to connect and empower others.

They work each day to support our community holistically, understand our members'
personal and professional goals, program local experiences and events, recommend
services and make introductions among members who can help each other succeed. The
mission-driven culture does not stop at the staff level for WeWork. As part of its public
offering, CEO Adam Neumann and his wife and chief brand and impact officer, Rebekah,
pledged to give one billion dollars to fund charitable causes within the first ten years
of the offering.

We dedicate this to the energy of we, greater than any one of us, but inside each of us.
Our powerful brand, global footprint, scalable business model and cost advantage are
significant competitive advantages that will allow us to further penetrate existing and
new markets and maximize the future impact of the WeWork effect. The We Company is
reinventing the way people work, helping them make a life, not just a living. The
company's mission is to elevate the world's consciousness, and the magic wands it waves
toward that end include idealistic talk about community, transformation, and a new way
of being in the world.

We are committed to maximum global impact. We are reinventing work. We are transforming
the human experience of community. We are building a platform of platforms, a worldwide
ecosystem dedicated to the elevation of human potential through space, technology, and
shared purpose.
`;

// ------------------------------------------------------------
// CORPUS 2 : Extraits du S-1 Airbnb (novembre 2020)
// ------------------------------------------------------------
// Sources : SEC.gov d81668ds1.htm + analyses contemporaines
// (NextView Ventures, CNBC, Airbnb Q4 2020 Shareholder Letter).
// ------------------------------------------------------------

const airbnb = `
Airbnb exists because of one simple idea: to belong anywhere starts with belonging
somewhere. We are eager to tell you the story of Airbnb. Our hosts are at the heart of
our model. Hosts share their homes and offer experiences to guests, and we provide them
with the tools to do so. As of September 30, 2020, we had over 4 million hosts
worldwide who have welcomed more than 825 million guest arrivals in approximately 100,000
cities since our founding.

In 2019, we generated revenue of 4.8 billion dollars and a net loss of 674 million
dollars. In the nine months ended September 30, 2020, revenue was 2.5 billion dollars
and net loss was 697 million dollars. Our hosts have collectively earned more than 110
billion dollars from listings on our platform. In 2019, we processed 327 million nights
and experiences booked.

Our guests are engaged, contributing members of our community. Demand encourages new
hosts to join, which in turn attracts even more guests. Guests attract hosts and hosts
attract guests. We earn substantially all of our revenue from service fees, net of
incentives and refunds, charged to both hosts and guests for bookings completed on our
platform. We typically collect the booking value from guests at the time of booking,
and we generally pay hosts after guest check-in.

Our cost of revenue includes payment processing costs, including merchant fees and
chargebacks, costs associated with the operation of our platform, and amortization of
internally developed software and acquired intangible assets. In 2019, our cost of
revenue was 1.2 billion dollars, representing 25% of revenue. Our gross profit was 3.6
billion dollars, representing a gross margin of 75%. Sales and marketing expenses were
1.6 billion dollars, representing 33% of revenue. Operations and support expenses were
815 million dollars, representing 17% of revenue.

We have made significant investments in trust and safety, including a 24/7 customer
support team operating in dozens of languages, a host guarantee program covering up to
1 million dollars in damages per stay, and a community standards framework that has
removed over 1.3 million listings since launch. We employ approximately 5,400 employees
across 24 offices, of whom approximately 1,100 are engineers.

In Q4 2020, revenue was 859 million dollars, a decline of 22% year-over-year. Total
revenue for 2020 was 3.4 billion dollars, a decline of 30% compared with 4.8 billion in
2019. We had cash and cash equivalents of 2.5 billion dollars, marketable securities of
1.5 billion dollars, and total stockholders' equity of 2.9 billion dollars as of
September 30, 2020. Our business model is asset-light: we do not own the homes listed
on our platform, hosts do.
`;

// ------------------------------------------------------------
// CORPUS 3 : Texte de controle - synthese sectorielle generique
// ------------------------------------------------------------
// Communication B2B SaaS standard, ni dramatiquement saine
// ni dramatiquement problematique. Sert de baseline.
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// CORPUS 4 : Theranos / Elizabeth Holmes (2014-2015)
// ------------------------------------------------------------
// Communications publiques et interviews d Elizabeth Holmes
// avant l effondrement (2015). Cas pedagogique extreme de
// derive narrative : abstraction sur la "revolution healthcare",
// "democratize healthcare", "elevate consciousness around the
// fingerstick", refus structure de communiquer des chiffres.
// Sources : Wikipedia Elizabeth Holmes / Theranos, Darden case
// study, Ethics Unwrapped UT Austin, Juris Magazine Duquesne,
// IntegrityLine, citations directes Holmes 2014-2015.
// ------------------------------------------------------------

const theranos = `
Our mission is to revolutionize healthcare. We are democratizing access to actionable
health information by enabling consumers and physicians to take charge of their wellness.
We believe that every person deserves access to their own health information, and we
believe that the right to access this information is a fundamental human right.

Theranos is a transformative force in laboratory medicine. We are reinventing the way
that blood tests are performed, transforming the patient experience through a focus on
what truly matters: empowerment, dignity, accessibility. Our vision is to create a world
in which no one has to say goodbye too soon.

I started Theranos because I believed that there was a fundamental need for a different
approach to healthcare. The current laboratory model is broken. People are suffering.
Children are scared of needles. Patients delay critical tests. We believe in a world where
diagnostic information empowers individuals to take ownership of their wellness journey.

This is not just a technology company, it is a movement. A movement to reinvent the
relationship between people and their own health. A movement to elevate consciousness
around what is possible when access becomes universal. A movement to bring meaning back
to medicine.

Our work transcends the traditional boundaries of an industry. We are building a platform
that fundamentally redefines how diagnostic information flows. Through our infrastructure,
we are not just delivering tests, we are delivering the promise of a new era of healthcare.
The era of empowerment. The era of consciousness. The era of access.

This is what happens when you work to change things, and first they think you are crazy,
then they fight you, and then, all of a sudden, you change the world. We are dedicated
to the patients we serve. We are dedicated to the families. We are dedicated to the
fundamental human right of every person to know their own body. To know their own
biology. To know their own future.

Our technology is the manifestation of years of dedication to a single transformative
idea. The idea that healthcare should be a fundamental right, not a privilege. The idea
that knowledge of one's body is power, and that power belongs to the people, not to
institutions. We code-named our product the Edison because we assumed we would have to
fail ten thousand times to get it to work the ten thousand and first. And we did.
`;

// ------------------------------------------------------------
// CORPUS 5 : Stripe annual letter (2022, 2023) + comm interne
// ------------------------------------------------------------
// Test du faux positif. Stripe parle de "growing the GDP of
// the internet" et de "infrastructure for AI", ce qui pourrait
// faire trigger un detecteur naif. Mais leurs communications
// sont systematiquement accompagnees de chiffres concrets et
// de structures argumentatives precises. Si la taxonomie
// flagge Stripe en alerte, elle est trop sensible.
// Sources : Stripe newsroom 2022 et 2023 annual letters,
// CEO email layoff novembre 2022, Dwarkesh Patel interview
// 2024, The Block 2025.
// ------------------------------------------------------------

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
maintained 99.999 percent uptime and processed more than 300 million transactions,
leading to 31,000 businesses having their best ever day on Stripe.

Today we are announcing the hardest change we have had to make at Stripe to date. We
are reducing the size of our team by around 14 percent and saying goodbye to many
talented colleagues in the process. In our view, we made two consequential mistakes.
We were much too optimistic about the internet economy growth in 2022 and 2023 and
underestimated both the likelihood and impact of a broader slowdown. We grew operating
costs too quickly. Buoyed by the success in some of our new product areas, we allowed
coordination costs to grow and operational inefficiencies to seep in.

We will pay 14 weeks of severance for all departing employees, and more for those with
longer tenure. That is, those departing will be paid until at least February 21st 2023.
We will pay our 2022 annual bonus for all departing employees, regardless of their
departure date. We will pay for all unused PTO time, including in regions where that
is not legally required. We will pay the cash equivalent of 6 months of existing
healthcare premiums or healthcare continuation. We will accelerate everyone who has
already reached their one-year vesting cliff to the February 2023 vesting date.

Stablecoin transaction volumes more than doubled between Q4 2023 and Q4 2024, and there
are more than 40 million monthly active wallets. The top stablecoin use cases today
involve tangible, real-world activity. CFOs use stablecoins to manage corporate
treasury, immigrants use them for remittance, citizens of countries with unstable
currencies use them for dependable savings, and payments teams use them for payouts.
Stripe acquired Bridge stablecoin services provider in October 2024 for 1.1 billion
dollars, the largest crypto buyout to date.

Charlie Munger described a two-part rule that works wonders in business, science, and
elsewhere. First, take a simple idea. Second, take it very seriously. Stripe mission
is to grow the GDP of the internet. The core idea behind the company is that we are
still early in the journey of software-driven innovation, and Stripe is an applied
exercise in thinking through some of the corollaries of that. In particular, thanks
to the new possibilities afforded by the internet, we believe that putting better,
more global, easier to use, more flexible, faster, cheaper economic infrastructure on
the internet has compounding effects.
`;

// ------------------------------------------------------------
// CORPUS 6 : Mistral AI (2024-2026)
// ------------------------------------------------------------
// Test sur boite francaise deeptech AI. Communications
// officielles Mistral mixent du concret (parametres modeles,
// licences, performances chiffrees) et de l abstrait
// (souverainete, mission, democratisation). Si la taxonomie
// fonctionne en francais, Mistral doit sortir en sain ou
// attention modere, pas en alerte.
// Sources : mistral.ai newsroom, Contrary Research profile,
// AI Business 2026, TechCrunch decembre 2025, Techi 2025,
// IBM Think 2025.
// ------------------------------------------------------------

const mistral = `
At Mistral AI, we believe the future of artificial intelligence is open, collaborative,
and built for everyone. Our mission is to create a European champion with a global
vocation in generative artificial intelligence, based on an open, responsible, and
decentralized approach to technology. We want to be the most capital-efficient company
in the world of AI. That is the reason we exist.

In September 2023, Mistral launched Mistral 7B, a 7 billion parameter open source AI
model under Apache 2.0 license. Two months after launching, Mistral raised 105 million
euros, equivalent to 113 million dollars, in what became Europe largest seed round for
a tech company. The startup was barely a few weeks old and was already valued at over
260 million dollars.

Open frontier models are how AI becomes a true platform. The coalition first initiative
is a base model, trained on NVIDIA DGX Cloud, which will underpin the upcoming NVIDIA
Nemotron 4 family. These models will be open-sourced, providing a shared foundation for
post-training and specialization.

Mistral plans to invest over 1 billion dollars in the construction of an AI-focused
data center in Sweden in partnership with EcoDataCenter. The facility, to open in 2027,
will deliver AI-native infrastructure built for performance, efficiency, and full
European control. Mistral made its first acquisition with the deal to buy Koyeb. The
compute infrastructure startup technology will support Mistral Compute, which companies
can use to build frontier models and AI tools.

Pixtral 12B is an open multimodal model, offered under an Apache 2.0 license, capable
of both text-in and image-in tasks. Its architecture combines a 12B multimodal decoder
based on Mistral Nemo and a 400M parameter vision encoder trained from scratch on image
data. The Ministral 3 model can run on a single GPU, making it deployable on affordable
hardware, from on-premise servers to laptops, robots, and other edge devices that may
have limited connectivity. All variants support vision, handle 128,000 to 256,000
context windows, and work across languages.

Mistral Compute uses EU-based data centers, which are certified across multiple
international standards. Other capabilities include networking and isolation controls,
encryption at rest, optional customer-held keys, and support for enterprise-type
identity, access, secrets, and policy tools, including SSO, RBAC, SLURM integration,
and SCIM provisioning. The platform supports integrations for data loss prevention,
auditability, and webhooks for CI/CD.

Mistral collaborates with Singapore Home Team Science and Technology Agency on
specialized models for robots, cybersecurity systems, and fire safety, with German
defense tech startup Helsing on vision-language-action models for drones, and with
automaker Stellantis on an in-car AI assistant.
`;

// ------------------------------------------------------------
// EXECUTION ETENDUE DES TESTS
// ------------------------------------------------------------


console.log('='.repeat(60));
console.log('CALIBRATION TAXONOMIE NARRATIVE DRIFT - V1');
console.log('='.repeat(60));
console.log(`\nTaxonomie : ${TAXONOMY_STATS.concreteCount} concrets, ${TAXONOMY_STATS.semiAbstractCount} semi-abstraits, ${TAXONOMY_STATS.abstractCount} abstraits, ${TAXONOMY_STATS.polysemicCount} polysemiques.`);

function reportMetrics(name: string, expected: string, text: string): void {
  const m = scoreText(text);
  console.log('\n' + '-'.repeat(60));
  console.log(`CORPUS : ${name}`);
  console.log(`Attendu : ${expected}`);
  console.log('-'.repeat(60));
  console.log(`Total mots         : ${m.totalWords}`);
  console.log(`Concrets           : ${m.concreteCount} (${((m.concreteCount / m.totalWords) * 100).toFixed(1)}%)`);
  console.log(`Semi-abstraits     : ${m.semiAbstractCount} (${((m.semiAbstractCount / m.totalWords) * 100).toFixed(1)}%)`);
  console.log(`  dont contextual. : ${m.semiAbstractContextualized}`);
  console.log(`Abstraits          : ${m.abstractCount} (${((m.abstractCount / m.totalWords) * 100).toFixed(1)}%)`);
  console.log(``);
  console.log(`Densite concrete   : ${m.densiteConcrete.toFixed(1)} mots/1000`);
  console.log(`Ratio abstrait/conc: ${m.ratioAbstraitConcret.toFixed(2)}`);
  console.log(`Score opacite      : ${m.opaciteScore.toFixed(1)}%`);
  console.log(``);
  console.log(`VERDICT : ${m.verdict.toUpperCase()}`);
  console.log(`Rationale : ${m.rationale}`);
  console.log(``);
  console.log(`Top 5 abstraits : ${m.topAbstractWords.slice(0, 5).map(w => `${w.word}(${w.count})`).join(', ')}`);
  console.log(`Top 5 concrets  : ${m.topConcreteWords.slice(0, 5).map(w => `${w.word}(${w.count})`).join(', ')}`);
}

reportMetrics('WeWork S-1 (2019)', 'derive forte, ratio > 1.0', wework);
reportMetrics('Theranos / Holmes (2014-2015)', 'derive extreme, ratio > 1.0', theranos);
reportMetrics('Airbnb S-1 (2020)', 'sain, ratio < 0.5', airbnb);
reportMetrics('Stripe annual letter (2023)', 'sain malgre ton mission, ratio < 0.5', stripe);
reportMetrics('Mistral AI (2024-2026)', 'sain ou attention modere, ratio < 0.6', mistral);
reportMetrics('Controle B2B SaaS', 'sain, ratio < 0.3', controle);

console.log('\n' + '='.repeat(60));
console.log('VERDICT DE CALIBRATION ETENDUE');
console.log('='.repeat(60));

const wm = scoreText(wework);
const tm = scoreText(theranos);
const am = scoreText(airbnb);
const sm = scoreText(stripe);
const mm = scoreText(mistral);
const cm = scoreText(controle);

console.log('\nRatios abstrait/concret par corpus :');
console.log(`  WeWork S-1     : ${wm.ratioAbstraitConcret.toFixed(2)}  [verdict: ${wm.verdict}]`);
console.log(`  Theranos       : ${tm.ratioAbstraitConcret.toFixed(2)}  [verdict: ${tm.verdict}]`);
console.log(`  Airbnb S-1     : ${am.ratioAbstraitConcret.toFixed(2)}  [verdict: ${am.verdict}]`);
console.log(`  Stripe letter  : ${sm.ratioAbstraitConcret.toFixed(2)}  [verdict: ${sm.verdict}]`);
console.log(`  Mistral AI     : ${mm.ratioAbstraitConcret.toFixed(2)}  [verdict: ${mm.verdict}]`);
console.log(`  Controle SaaS  : ${cm.ratioAbstraitConcret.toFixed(2)}  [verdict: ${cm.verdict}]`);

console.log('\nDensite concrete par corpus (mots/1000) :');
console.log(`  WeWork S-1     : ${wm.densiteConcrete.toFixed(0)}`);
console.log(`  Theranos       : ${tm.densiteConcrete.toFixed(0)}`);
console.log(`  Airbnb S-1     : ${am.densiteConcrete.toFixed(0)}`);
console.log(`  Stripe letter  : ${sm.densiteConcrete.toFixed(0)}`);
console.log(`  Mistral AI     : ${mm.densiteConcrete.toFixed(0)}`);
console.log(`  Controle SaaS  : ${cm.densiteConcrete.toFixed(0)}`);

const patternsConfirmed = [wm, tm].every(m => m.verdict === 'alerte' || m.verdict === 'drapeau-rouge');
const counterArchetypesSain = [am, sm, cm].every(m => m.verdict === 'sain');
const mistralOk = mm.verdict !== 'drapeau-rouge';

console.log('\n' + '-'.repeat(60));
if (patternsConfirmed && counterArchetypesSain && mistralOk) {
  console.log('[PASS COMPLET]');
  console.log('Patterns confirmes (WeWork, Theranos) : alerte ou drapeau rouge.');
  console.log('Counter-archetypes (Airbnb, Stripe, Controle) : sain.');
  console.log(`Mistral AI (test francais) : ${mm.verdict}.`);
  console.log('La taxonomie est defendable devant un partner Eurazeo.');
} else {
  console.log('[REVISION NECESSAIRE]');
  if (!patternsConfirmed) console.log('Probleme : patterns confirmes ne sont pas detectes.');
  if (!counterArchetypesSain) console.log('Probleme : counter-archetypes flaggés à tort.');
  if (!mistralOk) console.log('Probleme : Mistral en drapeau rouge alors qu il devrait etre sain ou attention.');
}
