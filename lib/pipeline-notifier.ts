// ============================================================
// PIPELINE NOTIFIER
// ------------------------------------------------------------
// Helper pour notifier le partner que son pipeline d analyse
// est termine, meme s il a quitte l onglet pendant les 10
// minutes que dure le pipeline. Pas d email, pas de service
// externe : on s appuie sur l API Notification native du
// navigateur et sur le titre dynamique de l onglet.
//
// Le partner peut donc lancer son analyse, partir faire autre
// chose (deal flow, autre analyse, calls), et savoir tout de
// suite quand revenir : son OS lui envoie une notif quand le
// pipeline finit, et l onglet du navigateur clignote dans la
// barre d onglets.
// ============================================================

/**
 * Demande la permission de notification au navigateur si on
 * ne l a pas deja. Idempotent et silencieux : si le navigateur
 * ne supporte pas l API ou si l utilisateur a deja refuse, on
 * ne fait rien et on ne re-demande pas.
 *
 * A appeler au lancement d un pipeline. La promesse permet
 * d enchainer mais l attente n est pas obligatoire : meme sans
 * permission, le pipeline tourne, juste sans notification.
 */
export async function requestNotificationPermissionSilent(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface NotifyOptions {
  companyName: string;
  verdict?: string | null;
  isPrescanKnockout?: boolean;
}

/**
 * Envoie une notification systeme au partner pour signaler la
 * fin du pipeline. Ne fait rien si la permission n est pas
 * accordee ou si le navigateur n a pas l API. Ne fait rien
 * non plus si l onglet est actif au premier plan : dans ce
 * cas, le partner regarde deja la page, inutile de le
 * deranger avec une notif systeme.
 *
 * Le titre de la notification utilise le verdict si dispo,
 * sinon un message generique.
 */
export function notifyPipelineComplete({ companyName, verdict, isPrescanKnockout }: NotifyOptions): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && !document.hidden) return;

  const verdictLabel: Record<string, string> = {
    'investir': 'Investir',
    'investir-conditions': 'Investir avec conditions',
    'approfondir': 'Approfondir',
    'refuser': 'Refuser',
  };

  let title: string;
  let body: string;

  if (isPrescanKnockout) {
    title = `Pre-scan termine - ${companyName}`;
    body = 'Le dossier n a pas passe le triage Bloc 0. Ouvre Prelude pour voir le detail.';
  } else {
    const v = verdict ? verdictLabel[verdict] || verdict : null;
    title = v
      ? `${companyName} - ${v}`
      : `Analyse terminee - ${companyName}`;
    body = 'Pipeline d instruction VC complete. Ouvre Prelude pour lire la note.';
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `prelude-pipeline-${companyName}`,
      requireInteraction: false,
    });
    // Cliquer la notif ramene Prelude au premier plan.
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    // Auto close apres 12 secondes pour ne pas encombrer le
    // centre de notifs si le partner est absent longtemps.
    setTimeout(() => notif.close(), 12000);
  } catch {
    // Silencieux : navigateur trop ancien ou API en panne.
  }
}

/**
 * Met un titre d onglet "attention" quand le pipeline finit
 * et que l onglet est en background. Le titre revient a sa
 * valeur d origine des que l onglet redevient actif.
 *
 * Mecanique : on change le document.title pour ajouter un
 * marqueur visuel (✓ ou ●) en debut. Le navigateur affiche
 * ce titre dans la barre d onglets, ce qui rend le retour
 * d attention immediat dans une vue multi-onglets.
 */
export function setTabTitleAttention(state: 'running' | 'done' | 'knockout' | 'idle', companyName?: string): void {
  if (typeof document === 'undefined') return;
  // On stocke le titre d origine pour pouvoir le restaurer.
  const w = window as any;
  if (!w.__preludeOriginalTitle) {
    w.__preludeOriginalTitle = document.title;
  }
  const original = w.__preludeOriginalTitle;
  const co = companyName ? ` ${companyName}` : '';
  switch (state) {
    case 'running':
      document.title = `● Analyse en cours${co} - Prelude`;
      break;
    case 'done':
      document.title = `✓ Termine${co} - Prelude`;
      break;
    case 'knockout':
      document.title = `⚠ Pre-scan${co} - Prelude`;
      break;
    case 'idle':
      document.title = original;
      break;
  }
}

/**
 * Branche un listener visibilitychange qui restaure le titre
 * d origine des que l onglet redevient actif. A appeler une
 * seule fois au montage du composant. Renvoie une fonction de
 * cleanup pour useEffect.
 */
export function bindTabTitleRestore(): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => {
    if (!document.hidden) {
      setTabTitleAttention('idle');
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
