// Receipt verification. Each mode is checked differently. The heavy lifting
// (attestation quote parsing, proof checking) lives in @tasqnetwork/verify so it
// can be audited on its own. This file dispatches by mode and checks the parts
// that are cheap and always required.

import type { Receipt } from "./types.js";
import { Mode } from "./types.js";

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

/** Verify a receipt for the mode it claims. */
export async function verifyReceipt(receipt: Receipt): Promise<VerifyResult> {
  if (receipt.inputCommitment === receipt.outputCommitment) {
    return fail("input and output commitments are identical");
  }
  switch (receipt.mode) {
    case Mode.Attested:
      if (!receipt.attestation) return fail("mode A receipt has no attestation");
      // TODO: delegate to @tasqnetwork/verify to check the quote against the
      // hardware roots of trust and that the attested key matches the session.
      return ok();
    case Mode.Redundant:
      if (!receipt.quorum || receipt.quorum.length < 2) {
        return fail("mode R receipt needs at least two agreeing signatures");
      }
      return ok();
    case Mode.Proven:
      if (!receipt.proof) return fail("mode P receipt has no proof");
      // TODO: delegate to @tasqnetwork/verify to check the proof against the
      // input commitment.
      return ok();
    default:
      return fail(`unknown mode ${receipt.mode as string}`);
  }
}

const ok = (): VerifyResult => ({ valid: true });
const fail = (reason: string): VerifyResult => ({ valid: false, reason });
