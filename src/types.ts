// Core types shared across the SDK. These mirror the protocol, see
// https://github.com/tasqProject/tasq-protocol for the full spec.

/** How much the client needs to trust the machine the job runs on. */
export enum Mode {
  /** Attested. Input is decrypted only inside a hardware enclave. */
  Attested = "A",
  /** Redundant. Several independent machines must agree, with hidden audits. */
  Redundant = "R",
  /** Proven. The machine returns a proof checked against an input commitment. */
  Proven = "P",
}

/** A job request, before it is signed. */
export interface IntentInput {
  mode: Mode;
  /** Model reference the machine must load, for example "llama-3.1-8b-instruct". */
  model: string;
  /** Raw input bytes. The SDK encrypts these for the chosen machine. */
  input: Uint8Array;
  /** Budget in network credits, as a decimal string. */
  budget: string;
  /** Seconds from submission until the job expires. */
  deadlineSeconds: number;
  /** Optional: require these runtime image measurements (mode A). */
  image?: string;
}

/** The EIP-712 payload that gets signed. Amounts are integer strings. */
export interface Intent {
  mode: Mode;
  model: string;
  /** BLAKE3 digest of the input bytes, hex with a 0x prefix. */
  inputCommitment: `0x${string}`;
  budget: string;
  deadline: number;
  nonce: `0x${string}`;
}

/** A receipt returned with a result. The fields present depend on the mode. */
export interface Receipt {
  mode: Mode;
  intentHash: `0x${string}`;
  inputCommitment: `0x${string}`;
  outputCommitment: `0x${string}`;
  /** Operator signature over the receipt body. */
  signature: `0x${string}`;
  /** Mode A: the remote attestation quote, base64. */
  attestation?: string;
  /** Mode R: the set of agreeing operator signatures. */
  quorum?: `0x${string}`[];
  /** Mode P: the proof bytes, base64. */
  proof?: string;
}

/** Anything that can sign an EIP-712 typed message, for example an ethers or viem signer. */
export interface Signer {
  getAddress(): Promise<string>;
  signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, { name: string; type: string }[]>,
    value: Record<string, unknown>,
  ): Promise<string>;
}
