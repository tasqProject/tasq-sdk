// Builds and signs the EIP-712 intent. The domain matches the TasQ contracts:
// { name: "TasQ", version: "1", chainId }. A verifyingContract is added once the
// settlement contract is deployed.

import type { Intent, IntentInput, Signer } from "./types.js";
import { blake3Hex, randomNonce } from "./crypto.js";

export const EIP712_DOMAIN = { name: "TasQ", version: "1" } as const;

export const INTENT_TYPES = {
  Intent: [
    { name: "mode", type: "string" },
    { name: "model", type: "string" },
    { name: "inputCommitment", type: "bytes32" },
    { name: "budget", type: "uint256" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** Turn a job request into the exact payload that will be signed. */
export function buildIntent(input: IntentInput, now = Date.now()): Intent {
  return {
    mode: input.mode,
    model: input.model,
    inputCommitment: blake3Hex(input.input),
    budget: toCredits(input.budget),
    deadline: Math.floor(now / 1000) + input.deadlineSeconds,
    nonce: randomNonce(),
  };
}

/** Sign an intent. Returns the signature and the domain actually used. */
export async function signIntent(signer: Signer, intent: Intent, chainId: number) {
  const domain = { ...EIP712_DOMAIN, chainId };
  const signature = await signer.signTypedData(
    domain,
    INTENT_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    intent as unknown as Record<string, unknown>,
  );
  return { domain, signature };
}

/** Budget is given as a decimal string of credits. Credits have 18 decimals. */
function toCredits(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return (BigInt(whole || "0") * 10n ** 18n + BigInt(padded || "0")).toString();
}
