// Chiffrement applicatif des cles API stockees en base.
// AES-256-GCM avec une cle maitresse PRELUDE_KMS_KEY (32 bytes hex).
//
// Format de stockage en base : iv_hex:authtag_hex:ciphertext_hex
// On utilise crypto natif Node, pas de dependance externe.
//
// Si la KMS key est perdue, les cles chiffrees sont irrecuperables.
// C est volontaire : la perte de la KMS key doit etre traitee comme
// une fuite et toutes les cles doivent etre re-saisies.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96 bits, recommande pour GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getMasterKey(): Buffer {
  const raw = process.env.PRELUDE_KMS_KEY;
  if (!raw) {
    throw new Error(
      'PRELUDE_KMS_KEY manquante. Generer avec : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  // Accepte soit du hex 64 chars, soit n importe quelle string qu on
  // hashe en SHA-256 pour obtenir 32 bytes. Le hex est preferable mais
  // le hash permet une migration douce sans regenerer la key.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw).digest();
}

/**
 * Chiffre une cle API. Retourne une string opaque a stocker telle
 * quelle en base. Le format est versionne (prefixe v1:) pour permettre
 * une rotation d algo plus tard sans casser le decryption des anciens
 * enregistrements.
 */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Dechiffre une cle. Throw si la KMS key est invalide ou si l auth tag
 * ne correspond pas (alteration de la base detectee).
 */
export function decryptSecret(blob: string): string {
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Format de cle chiffree invalide');
  }
  const [, ivHex, authTagHex, encryptedHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Aperu non sensible d une cle pour l affichage UI.
 * Retourne les 4 derniers caracteres masques avec des bullets, et la
 * longueur totale pour donner un indice au user (sans exposer le reste).
 *   exemple : "sk-proj-abc...xY9z" (18 chars) -> "••••••••••••••xY9z"
 */
export function maskSecret(plaintext: string): string {
  const len = plaintext.length;
  if (len <= 4) return '••••';
  const tail = plaintext.slice(-4);
  return '•'.repeat(Math.min(len - 4, 14)) + tail;
}

/**
 * Verifie au boot serveur que la KMS key est presente et valide.
 * A appeler depuis les Route Handlers qui touchent aux cles avant
 * de tenter une operation reelle (pour donner une erreur claire).
 */
export function ensureKmsKey(): void {
  getMasterKey();
}
