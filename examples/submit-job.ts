// Example: submit a mode A job and verify the receipt that comes back.
// Bring your own EIP-712 signer (ethers or viem both work).

import { TasqClient, Mode, type Signer } from "@tasqnetwork/sdk";

export async function main(signer: Signer) {
  const tasq = new TasqClient({
    endpoint: process.env.TASQ_ENDPOINT ?? "https://api.tasqnetwork.io",
    signer,
    chainId: 4663, // Robinhood Chain
  });

  // Your input bytes. The SDK commits to these with BLAKE3 and, in mode A,
  // seals them against the machine's attested key before anything leaves here.
  const input = new TextEncoder().encode("the prompt or the input bundle");

  const job = await tasq.submit({
    mode: Mode.Attested,
    model: "llama-3.1-8b-instruct",
    input,
    budget: "5.00",
    deadlineSeconds: 900,
  });
  console.log("submitted", job.id);

  const { output, receipt } = await job.wait();

  const check = await tasq.verifyReceipt(receipt);
  if (!check.valid) throw new Error(`receipt invalid: ${check.reason}`);

  console.log("verified, output bytes:", output.length);
  return { output, receipt };
}
