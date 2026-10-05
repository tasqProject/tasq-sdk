// The client. It talks to a coordinator over HTTP. The coordinator never holds
// a decryption key, it only matches jobs to machines and relays encrypted
// payloads. Settlement happens on chain.

import type { IntentInput, Receipt, Signer } from "./types.js";
import { Mode } from "./types.js";
import { buildIntent, signIntent } from "./intent.js";
import { seal, type MachineKey } from "./crypto.js";
import { verifyReceipt, type VerifyResult } from "./verify.js";

export interface TasqOptions {
  /** Coordinator base URL. */
  endpoint: string;
  /** Signs intents. */
  signer: Signer;
  /** Chain id of the ledger. Defaults to Robinhood Chain once that is published. */
  chainId?: number;
  fetch?: typeof fetch;
}

/** A submitted job. Call wait() to block until a receipt arrives. */
export interface Job {
  id: string;
  wait(): Promise<{ output: Uint8Array; receipt: Receipt }>;
}

export class TasqClient {
  private readonly endpoint: string;
  private readonly signer: Signer;
  private readonly chainId: number;
  private readonly http: typeof fetch;

  constructor(opts: TasqOptions) {
    this.endpoint = opts.endpoint.replace(/\/$/, "");
    this.signer = opts.signer;
    this.chainId = opts.chainId ?? 0;
    this.http = opts.fetch ?? fetch;
  }

  /** Build, sign, encrypt and submit a job. */
  async submit(input: IntentInput): Promise<Job> {
    const intent = buildIntent(input);
    const { domain, signature } = await signIntent(this.signer, intent, this.chainId);

    // Ask the coordinator for a machine that qualifies for this mode.
    const offer = await this.post<{ id: string; key: MachineKey; attestation?: string }>(
      "/v1/match",
      { intent, mode: input.mode },
    );

    // In mode A, the input must only be sealed against an attested key.
    if (input.mode === Mode.Attested && !offer.attestation) {
      throw new Error("mode A requires an attestation from the machine");
    }

    const sealed = seal(input.input, offer.key);
    const res = await this.post<{ id: string }>("/v1/jobs", {
      intent, domain, signature, machine: offer.id, sealed: encodeSealed(sealed),
    });

    return { id: res.id, wait: () => this.wait(res.id) };
  }

  /** Verify a receipt for the mode it claims. See verify.ts. */
  verifyReceipt(receipt: Receipt): Promise<VerifyResult> {
    return verifyReceipt(receipt);
  }

  private async wait(id: string): Promise<{ output: Uint8Array; receipt: Receipt }> {
    // Long polling. A production client would use a websocket or server events.
    for (;;) {
      const r = await this.get<{ done: boolean; output?: string; receipt?: Receipt }>(`/v1/jobs/${id}`);
      if (r.done && r.output && r.receipt) {
        return { output: fromBase64(r.output), receipt: r.receipt };
      }
      await sleep(1500);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const r = await this.http(`${this.endpoint}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    const r = await this.http(`${this.endpoint}${path}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json() as Promise<T>;
  }
}

function encodeSealed(s: ReturnType<typeof seal>) {
  return {
    ephPub: toBase64(s.ephPub),
    kemCt: toBase64(s.kemCt),
    nonce: toBase64(s.nonce),
    ciphertext: toBase64(s.ciphertext),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
