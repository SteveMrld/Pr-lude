// ============================================================
// PRELUDE - Notifications de trajectoire
// ------------------------------------------------------------
// Module unique pour la transformation des alertes TrajectoryAlert
// en payloads email (sujet + corps) et leur dispatch via le
// provider configure (Resend si RESEND_API_KEY present, sinon
// fallback log console pour preserver la doctrine non-bloquante).
//
// Voix Le Grand Continent : sujet sobre signalant le fait, pas
// l alarme. Corps en prose dense, pas de tableau austere, pas de
// bouton CTA proeminent, un lien discret en bas pour acceder au
// dashboard. Le partner doit recevoir une information editorialisee,
// pas un brief marketing.
//
// Structure :
//   1. formatImmediateAlertEmail : transforme une liste d alertes
//      cran 1 ou 2 sur un dossier en un email immediat.
//   2. formatWeeklyDigestEmail : agrege les alertes cran 3 d une
//      semaine en un digest hebdomadaire envoye le lundi matin.
//   3. dispatchEmail : envoie le payload via le provider configure.
//      Non-bloquant : si pas de provider, log sans throw.
//
// Tests deterministes sur les formatters (sujet, corps, presence des
// elements doctrinaux). Le dispatch reel n est pas testé en suite
// deterministe : il appartient a la couche integration.
// ============================================================

import type { TrajectoryAlert } from './engines/trajectory/alerts';

// ============================================================
// TYPES
// ============================================================

/**
 * Payload email pret a etre envoye. Le sujet est libre, le corps
 * est en HTML simple (paragraphes prose, pas de tableaux). Le
 * destinataire est resolu par le caller (typiquement l email du
 * proprietaire du dossier via auth/store).
 */
export interface EmailPayload {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Resume d un dossier dont la trajectoire a declenche des alertes.
 * Le sujet de l email cite ce nom, le corps editorialise les
 * transitions detectees.
 */
export interface AlertedAnalysis {
  analysisId: string;
  companyName: string;
  alerts: TrajectoryAlert[];
  /** URL canonique vers la fiche dossier dans le dashboard. */
  dossierUrl: string;
}

// ============================================================
// FORMATEUR IMMEDIAT - CRANS 1 ET 2
// ------------------------------------------------------------
// Une alerte de cran 1 ou 2 declenche un email immediat au partner
// proprietaire. Le sujet cite le nom du dossier et qualifie la
// nature de la transition sans superlatif. Le corps editorialise
// chaque alerte, cite les deltas, et propose la recommandation en
// dernier paragraphe.
//
// Si plusieurs alertes critiques convergent sur un meme dossier
// (combinaison drapeau-rouge plus chute de score plus pattern
// nouveau), un seul email les agrege. Le partner lit l ensemble
// du tableau, pas trois mails sur le meme dossier.
// ============================================================

export function formatImmediateAlertEmail(
  to: string,
  analysis: AlertedAnalysis,
): EmailPayload {
  const cran1 = analysis.alerts.filter((a) => a.cran === 1);
  const cran2 = analysis.alerts.filter((a) => a.cran === 2);
  const hasCran1 = cran1.length > 0;

  // Sujet : neutre mais explicite. La transition de verdict est
  // l axe doctrinal qui doit emerger en objet, pas le cran ni le
  // pattern technique.
  const subject = hasCran1
    ? `Trajectoire ${analysis.companyName} : transition de verdict significative`
    : `Trajectoire ${analysis.companyName} : signal de degradation`;

  // Corps texte : prose, pas de listes a puces, pas de bullet
  // points. Voix Le Grand Continent.
  const paragraphs: string[] = [];

  paragraphs.push(
    `La derniere analyse du dossier ${analysis.companyName} fait apparaitre une transition que le moteur de Trajectoire considere comme suffisamment signifiante pour appeler une lecture directe du partner referent.`,
  );

  for (const alert of [...cran1, ...cran2]) {
    paragraphs.push(formatAlertParagraph(alert));
  }

  paragraphs.push(
    `Le tableau de bord conserve l ensemble des deltas, axe par axe et pattern par pattern, pour audit. Acceder au dossier : ${analysis.dossierUrl}`,
  );

  const bodyText = paragraphs.join('\n\n');
  const bodyHtml = buildSobreHtml(subject, paragraphs, analysis.dossierUrl);

  return { to, subject, bodyHtml, bodyText };
}

/**
 * Formate une alerte individuelle en paragraphe editorial.
 * Construit autour de la raison (formulation Le Grand Continent
 * portee par evaluateTrajectoryAlerts) et de la recommandation,
 * avec les citations intercalees comme appui factuel.
 */
function formatAlertParagraph(alert: TrajectoryAlert): string {
  const citations = alert.citations.length > 0
    ? ` Lecture factuelle : ${alert.citations.join(' ; ')}.`
    : '';
  return `${alert.raison}${citations} ${alert.recommandation}`;
}

// ============================================================
// FORMATEUR DIGEST HEBDOMADAIRE - CRAN 3
// ------------------------------------------------------------
// Le digest agrege toutes les alertes cran 3 de la semaine dans un
// unique email envoye le lundi matin. La forme est editoriale, pas
// un tableau : chaque dossier touche un paragraphe, ordonne par
// gravite presumee (nombre d alertes, puis ordre alphabetique).
//
// Si la semaine n a produit aucune alerte cran 3, le digest n est
// pas envoye (le caller verifie en amont). Pas de mail vide qui
// degraderait la valeur signal de l envoi du lundi.
// ============================================================

export function formatWeeklyDigestEmail(
  to: string,
  analyses: AlertedAnalysis[],
  weekStart: Date,
): EmailPayload {
  if (analyses.length === 0) {
    throw new Error(
      'formatWeeklyDigestEmail appele avec une liste vide. Le caller doit court-circuiter en amont.',
    );
  }

  const weekLabel = formatWeekLabel(weekStart);
  const subject = `Digest Trajectoire portefeuille - semaine du ${weekLabel}`;

  const ordered = [...analyses].sort((a, b) => {
    if (b.alerts.length !== a.alerts.length) return b.alerts.length - a.alerts.length;
    return a.companyName.localeCompare(b.companyName, 'fr');
  });

  const paragraphs: string[] = [];

  paragraphs.push(
    `Sur la semaine du ${weekLabel}, le moteur de Trajectoire a identifie ${ordered.length} dossier${ordered.length > 1 ? 's' : ''} du portefeuille dont l evolution merite d apparaitre en digest sans pour autant justifier une alerte immediate. Le format est volontairement integral : la transition se lit en contexte, pas a travers une grille resumee.`,
  );

  for (const a of ordered) {
    paragraphs.push(formatDigestEntry(a));
  }

  paragraphs.push(
    `Pour ouvrir un dossier en particulier, suivre le lien correspondant. Le tableau de bord conserve l audit complet des deltas et combinaisons par dossier.`,
  );

  const bodyText = paragraphs.join('\n\n');
  const bodyHtml = buildSobreHtml(subject, paragraphs, null);

  return { to, subject, bodyHtml, bodyText };
}

function formatDigestEntry(a: AlertedAnalysis): string {
  const transitions = a.alerts.map((al) => al.raison).join(' ');
  return `${a.companyName} : ${transitions} Acceder au dossier : ${a.dossierUrl}`;
}

/**
 * Formate une date en libelle francais court : "11 mai 2026".
 */
function formatWeekLabel(d: Date): string {
  const months = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ============================================================
// HTML SOBRE - voix Le Grand Continent
// ------------------------------------------------------------
// Encre noire sur papier creme, serif, sans bouton CTA. Le lien
// dashboard est integre en fin de paragraphe, pas mis en avant
// avec un fond colore.
// ============================================================
function buildSobreHtml(
  subject: string,
  paragraphs: string[],
  primaryLink: string | null,
): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Transforme les URL en lien hypertexte discret. On detecte
  // "Acceder au dossier : <url>" et on remplace l url par un <a>.
  const linkify = (p: string): string => {
    const urlRe = /https?:\/\/\S+/g;
    return p.replace(urlRe, (url) =>
      `<a href="${escape(url)}" style="color: #5a4a3a; text-decoration: underline;">${escape(url)}</a>`,
    );
  };

  const body = paragraphs
    .map((p) => `<p style="margin: 0 0 1.1em 0; line-height: 1.65;">${linkify(escape(p))}</p>`)
    .join('\n');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escape(subject)}</title>
</head>
<body style="margin: 0; padding: 40px 24px; background: #f6f1e7; font-family: Georgia, 'Times New Roman', serif; color: #1a1714; font-size: 15px;">
  <div style="max-width: 620px; margin: 0 auto;">
    <div style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b5e4d; margin-bottom: 28px;">
      Prelude &middot; Score de Trajectoire
    </div>
    ${body}
  </div>
</body>
</html>`;
}

// ============================================================
// DISPATCH EMAIL
// ------------------------------------------------------------
// Non-bloquant : si pas de provider configure, log et continue.
// L erreur de dispatch ne doit jamais casser le pipeline parent
// (write trajectory snapshot, cron run). Le caller capture le
// resultat dans un boolean retourne pour audit.
// ============================================================

export interface DispatchResult {
  sent: boolean;
  provider: 'resend' | 'log';
  reason?: string;
}

export async function dispatchEmail(payload: EmailPayload): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PRELUDE_EMAIL_FROM || 'noreply@prelude.app';

  if (!apiKey) {
    // Mode degraded : log et continue. Permet de developper et
    // tester sans configurer un compte Resend.
    console.log(
      `[trajectory-notifications] EMAIL (log) to=${payload.to} subject="${payload.subject}"`,
    );
    return { sent: false, provider: 'log', reason: 'no-api-key' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.bodyHtml,
        text: payload.bodyText,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(
        `[trajectory-notifications] Resend echec: ${res.status} ${text.slice(0, 200)}`,
      );
      return { sent: false, provider: 'resend', reason: `http-${res.status}` };
    }

    return { sent: true, provider: 'resend' };
  } catch (err: any) {
    console.error('[trajectory-notifications] Resend exception:', err);
    return { sent: false, provider: 'resend', reason: 'exception' };
  }
}
