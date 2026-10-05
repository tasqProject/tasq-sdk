# @tasqnetwork/sdk

The TypeScript client for TasQ, a marketplace for private AI compute. Use it to
build and sign a job intent, encrypt your input so only the chosen machine can
open it, submit the job, and verify the receipt that comes back.

This is the client side only. It talks to a coordinator over HTTP and to the
ledger for settlement. It does not contain any coordinator or node logic.

## Install

```
npm install @tasqnetwork/sdk
```

## Quick start

```ts
import { TasqClient, Mode } from "@tasqnetwork/sdk";

const tasq = new TasqClient({ endpoint: "https://api.tasqnetwork.io", signer });

// Describe the work. Mode A keeps the input private to a hardware enclave.
const job = await tasq.submit({
  mode: Mode.Attested,
  model: "llama-3.1-8b-instruct",
  input: bytes,            // encrypted for the chosen machine by the SDK
  budget: "5.00",          // in network credits
  deadlineSeconds: 900,
});

const result = await job.wait();        // resolves when a receipt is in
const ok = await tasq.verifyReceipt(result.receipt);
if (!ok.valid) throw new Error(ok.reason);

console.log(result.output);             // decrypted locally with your key
```

## What the SDK does for you

- **Intents.** Builds the EIP-712 typed intent and signs it with your signer.
  See `src/intent.ts` for the domain and types.
- **Encryption.** Wraps the input with a hybrid scheme, X25519 combined with
  ML-KEM, against the machine's attested key. In mode A the SDK checks the
  machine's attestation before it releases the key.
- **Receipts.** Verifies the receipt for the mode you asked for: attestation for
  mode A, agreement plus audit for mode R, a proof for mode P. The heavy
  checking is delegated to `@tasqnetwork/verify`.

## Status

Pre-launch. The endpoint and the on-chain addresses are not final, and the
interfaces here may change before the contracts are deployed.

## License

Apache License 2.0. See `LICENSE`. Copyright The TasQ Project.
