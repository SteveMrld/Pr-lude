'use client';

// ============================================================
// /settings/members
// ------------------------------------------------------------
// Gestion de l equipe. Un admin peut inviter par email, retirer un
// membre, changer son role. Les non-admins voient la liste en
// lecture seule.
//
// Pas d envoi d email transactionnel pour le MVP : l invitation est
// consommee par le destinataire a sa premiere connexion. L admin
// previent son collegue via le canal de son choix (Slack, email perso).
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import type { OrgMember, OrgInvitation, OrgRole } from '@/lib/team-store';

interface Props {
  orgName: string;
  orgRole: OrgRole;
  currentUserId: string;
  currentUserEmail: string;
  initialMembers: OrgMember[];
  initialInvitations: OrgInvitation[];
}

export default function MembersClient({
  orgName,
  orgRole,
  currentUserId,
  currentUserEmail,
  initialMembers,
  initialInvitations,
}: Props) {
  const isAdmin = orgRole === 'admin';

  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  const [invitations, setInvitations] = useState<OrgInvitation[]>(initialInvitations);

  // Formulaire d invitation
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Operations en cours sur un membre ou une invitation specifique
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

  async function refreshAll() {
    try {
      const [mRes, iRes] = await Promise.all([
        fetch('/api/organizations/members'),
        isAdmin ? fetch('/api/organizations/invitations') : Promise.resolve(null),
      ]);
      if (mRes.ok) {
        const data = await mRes.json();
        setMembers(data.members || []);
      }
      if (iRes && iRes.ok) {
        const data = await iRes.json();
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.warn('refresh failed', err);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch('/api/organizations/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      setInviteSuccess(`Invitation enregistrée pour ${body.invitation.emailDisplay}.`);
      setInviteEmail('');
      setInviteRole('member');
      await refreshAll();
      setTimeout(() => setInviteSuccess(''), 4000);
    } catch (err: any) {
      setInviteError(err?.message || 'Erreur inattendue');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvitation(id: string) {
    if (!confirm('Révoquer cette invitation ?')) return;
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/organizations/invitations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
      await refreshAll();
    } catch (err: any) {
      setRowError({ id, msg: err?.message || 'Erreur' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangeRole(userId: string, role: OrgRole) {
    setBusyId(userId);
    setRowError(null);
    try {
      const res = await fetch('/api/organizations/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
      await refreshAll();
    } catch (err: any) {
      setRowError({ id: userId, msg: err?.message || 'Erreur' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveMember(userId: string, email: string | null) {
    const label = email || 'ce membre';
    if (!confirm(`Retirer ${label} de l'organisation ? Cette action est immédiate.`)) return;
    setBusyId(userId);
    setRowError(null);
    try {
      const res = await fetch(`/api/organizations/members?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
      await refreshAll();
    } catch (err: any) {
      setRowError({ id: userId, msg: err?.message || 'Erreur' });
    } finally {
      setBusyId(null);
    }
  }

  const adminCount = members.filter((m) => m.role === 'admin').length;
  const sortedMembers = [...members].sort((a, b) => {
    // Soi-meme d abord, puis admins, puis members, puis par date.
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });

  return (
    <main className="members-main">
      <header className="members-header">
        <Link href="/settings" className="members-back">← Retour aux paramètres</Link>
        <div className="members-header-id">
          <div className="members-org-name">{orgName}</div>
          <div className="members-user-email">{currentUserEmail}</div>
        </div>
      </header>

      <section className="members-intro">
        <div className="members-kicker">Équipe</div>
        <h1 className="members-title">Membres de l&apos;organisation</h1>
        <p className="members-lede">
          Les comptes invités partagent l&apos;accès aux dossiers, aux notes
          d&apos;investissement et aux votes du comité. Les administrateurs gèrent
          les accès et la configuration des sources. Les membres consultent et votent.
        </p>
        {!isAdmin && (
          <div className="members-readonly">
            Mode lecture seule. Seul un administrateur peut inviter ou retirer des membres.
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="members-section">
          <h2 className="members-section-title">Inviter un membre</h2>
          <p className="members-section-subtitle">
            L&apos;invitation est consommée à la première connexion de l&apos;email.
            Aucun message automatique n&apos;est envoyé : prévenez votre collègue par
            le canal de votre choix.
          </p>
          <form onSubmit={handleInvite} className="invite-form">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@fonds.com"
              required
              className="invite-input"
              disabled={inviting}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="invite-select"
              disabled={inviting}
            >
              <option value="member">Membre</option>
              <option value="admin">Administrateur</option>
            </select>
            <button type="submit" className="invite-btn" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Envoi…' : 'Envoyer l\u2019invitation'}
            </button>
          </form>
          {inviteError && <div className="invite-error">{inviteError}</div>}
          {inviteSuccess && <div className="invite-success">{inviteSuccess}</div>}
        </section>
      )}

      {isAdmin && invitations.filter((i) => i.status === 'pending').length > 0 && (
        <section className="members-section">
          <h2 className="members-section-title">Invitations en attente</h2>
          <ul className="row-list">
            {invitations
              .filter((i) => i.status === 'pending')
              .map((inv) => (
                <li key={inv.id} className="row">
                  <div className="row-main">
                    <div className="row-primary">{inv.emailDisplay}</div>
                    <div className="row-meta">
                      {inv.role === 'admin' ? 'Administrateur' : 'Membre'}
                      {' · '}
                      Invité {formatDate(inv.createdAt)}
                      {inv.invitedByEmail ? ` par ${inv.invitedByEmail}` : ''}
                    </div>
                    {rowError && rowError.id === inv.id && (
                      <div className="row-error">{rowError.msg}</div>
                    )}
                  </div>
                  <div className="row-actions">
                    <button
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="row-btn-secondary"
                      disabled={busyId === inv.id}
                    >
                      {busyId === inv.id ? '…' : 'Révoquer'}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="members-section">
        <h2 className="members-section-title">
          Membres actifs <span className="members-count">{members.length}</span>
        </h2>
        <ul className="row-list">
          {sortedMembers.map((m) => {
            const isSelf = m.userId === currentUserId;
            const isLastAdmin = m.role === 'admin' && adminCount <= 1;
            return (
              <li key={m.userId} className="row">
                <div className="row-main">
                  <div className="row-primary">
                    {m.email || `Utilisateur ${m.userId.slice(0, 8)}`}
                    {isSelf && <span className="row-self-tag">vous</span>}
                  </div>
                  <div className="row-meta">
                    {m.role === 'admin' ? 'Administrateur' : 'Membre'}
                    {' · '}
                    Membre depuis {formatDate(m.joinedAt)}
                    {isLastAdmin && ' · seul administrateur'}
                  </div>
                  {rowError && rowError.id === m.userId && (
                    <div className="row-error">{rowError.msg}</div>
                  )}
                </div>
                {isAdmin && !isSelf && (
                  <div className="row-actions">
                    {m.role === 'member' ? (
                      <button
                        onClick={() => handleChangeRole(m.userId, 'admin')}
                        className="row-btn-secondary"
                        disabled={busyId === m.userId}
                      >
                        Promouvoir admin
                      </button>
                    ) : (
                      <button
                        onClick={() => handleChangeRole(m.userId, 'member')}
                        className="row-btn-secondary"
                        disabled={busyId === m.userId || isLastAdmin}
                        title={isLastAdmin ? 'Impossible de retirer le dernier administrateur' : undefined}
                      >
                        Rétrograder membre
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveMember(m.userId, m.email)}
                      className="row-btn-danger"
                      disabled={busyId === m.userId || isLastAdmin}
                      title={isLastAdmin ? 'Impossible de retirer le dernier administrateur' : undefined}
                    >
                      Retirer
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <style jsx>{`
        .members-main {
          max-width: 880px;
          margin: 0 auto;
          padding: 32px 28px 80px;
        }
        .members-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 18px;
          margin-bottom: 36px;
          border-bottom: 1px solid var(--hairline);
        }
        .members-back {
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.12s;
        }
        .members-back:hover { color: var(--ink); }
        .members-header-id {
          text-align: right;
          font-family: var(--sans);
        }
        .members-org-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
        }
        .members-user-email {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }
        .members-intro {
          margin-bottom: 44px;
          max-width: 640px;
        }
        .members-kicker {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }
        .members-title {
          font-family: var(--serif);
          font-size: 32px;
          font-weight: 500;
          line-height: 1.2;
          letter-spacing: -0.005em;
          color: var(--ink);
          margin-bottom: 14px;
        }
        .members-lede {
          font-family: var(--serif);
          font-size: 15.5px;
          line-height: 1.6;
          color: var(--ink-soft);
        }
        .members-readonly {
          margin-top: 16px;
          padding: 10px 14px;
          background: var(--signal-soft);
          border-left: 3px solid var(--signal);
          font-family: var(--sans);
          font-size: 13px;
          color: var(--signal);
        }
        .members-section {
          margin-bottom: 48px;
        }
        .members-section-title {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 500;
          color: var(--ink);
          margin-bottom: 8px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--hairline-strong);
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .members-count {
          font-family: var(--sans);
          font-size: 13px;
          color: var(--muted);
          font-weight: 400;
        }
        .members-section-subtitle {
          font-family: var(--serif);
          font-size: 14px;
          line-height: 1.55;
          color: var(--ink-soft);
          margin-bottom: 18px;
          max-width: 600px;
        }
        .invite-form {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: stretch;
        }
        .invite-input {
          flex: 1 1 260px;
          padding: 11px 13px;
          font-size: 14px;
          font-family: var(--sans);
          color: var(--ink);
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 0;
          transition: border-color 0.12s;
        }
        .invite-input:focus { outline: none; border-color: var(--accent); }
        .invite-select {
          padding: 11px 13px;
          font-size: 14px;
          font-family: var(--sans);
          color: var(--ink);
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 0;
          cursor: pointer;
        }
        .invite-select:focus { outline: none; border-color: var(--accent); }
        .invite-btn {
          padding: 11px 18px;
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
          background: var(--accent);
          color: #fefefe;
          border: 1px solid var(--accent);
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .invite-btn:hover:not(:disabled) { opacity: 0.92; }
        .invite-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .invite-error {
          margin-top: 12px;
          padding: 10px 14px;
          background: var(--warn-soft);
          border-left: 3px solid var(--warn);
          font-family: var(--sans);
          font-size: 13px;
          color: var(--warn);
        }
        .invite-success {
          margin-top: 12px;
          padding: 10px 14px;
          background: var(--signal-soft);
          border-left: 3px solid var(--signal);
          font-family: var(--sans);
          font-size: 13px;
          color: var(--signal);
        }
        .row-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          padding: 16px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .row:last-child { border-bottom: none; }
        .row-main {
          flex: 1 1 auto;
          min-width: 0;
        }
        .row-primary {
          font-family: var(--serif);
          font-size: 16px;
          color: var(--ink);
          margin-bottom: 4px;
          word-break: break-word;
        }
        .row-self-tag {
          display: inline-block;
          margin-left: 10px;
          padding: 2px 8px;
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: var(--accent);
          color: #fefefe;
          vertical-align: middle;
        }
        .row-meta {
          font-family: var(--sans);
          font-size: 12px;
          color: var(--muted);
        }
        .row-error {
          margin-top: 6px;
          font-family: var(--sans);
          font-size: 12px;
          color: var(--warn);
        }
        .row-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .row-btn-secondary, .row-btn-danger {
          padding: 7px 12px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
          background: var(--paper);
          border: 1px solid var(--hairline);
          color: var(--ink);
          cursor: pointer;
          transition: border-color 0.12s, color 0.12s;
        }
        .row-btn-secondary:hover:not(:disabled) {
          border-color: var(--ink);
        }
        .row-btn-danger {
          color: var(--warn);
          border-color: var(--warn-soft);
        }
        .row-btn-danger:hover:not(:disabled) {
          border-color: var(--warn);
        }
        .row-btn-secondary:disabled, .row-btn-danger:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .row {
            flex-direction: column;
            align-items: stretch;
          }
          .row-actions {
            margin-top: 4px;
          }
          .invite-form {
            flex-direction: column;
          }
          .invite-input, .invite-select, .invite-btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
