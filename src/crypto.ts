// Cryptographic helpers. Hashing is BLAKE3. The session key is a hybrid of
// X25519 and ML-KEM 768, so a session stays private even if one scheme is later
// broken. ML-KEM is a post-quantum key encapsulation mechanism. This is a choice
// of primitive only and does not imply any quantum hardware.

import { blake3 } from "@noble/hashes/blake3";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { x25519 } from "@noble/curves/ed25519";
import { ml_kem768 } from "@noble/post-quantum/ml-kem";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";

const enc = new TextEncoder();

/** BLAKE3 digest of bytes, as 0x hex. Used for input and output commitments. */
export function blake3Hex(data: Uint8Array): `0x${string}` {
  return toHex(blake3(data));
}

/** 32 random bytes as 0x hex. */
export function randomNonce(): `0x${string}` {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return toHex(b);
}

/** A machine's public key material, taken from its attestation (mode A) or its offer. */
export interface MachineKey {
  x25519: Uint8Array;   // 32 bytes
  mlkem: Uint8Array;    // ML-KEM 768 encapsulation key
}

/** Encrypt a payload for a machine. Returns everything the machine needs to open it. */
export function seal(payload: Uint8Array, key: MachineKey) {
  const eph = x25519.utils.randomPrivateKey();
  const ephPub = x25519.getPublicKey(eph);
  const dh = x25519.getSharedSecret(eph, key.x25519);

  const { cipherText: kemCt, sharedSecret: kemSs } = ml_kem768.encapsulate(key.mlkem);

  const secret = hkdf(sha256, concat(dh, kemSs), undefined, enc.encode("tasq/session/v1"), 32);
  const nonce = new Uint8Array(24);
  crypto.getRandomValues(nonce);
  const ct = xchacha20poly1305(secret, nonce).encrypt(payload);

  return { ephPub, kemCt, nonce, ciphertext: ct };
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function toHex(b: Uint8Array): `0x${string}` {
  let s = "0x";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s as `0x${string}`;
}
