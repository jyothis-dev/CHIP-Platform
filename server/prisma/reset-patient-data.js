import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Clears patient-level data in the CHIP schema so a demo can start clean.
 *
 * Removes: patients and everything that points at them (ABHA identities, care contexts, health records,
 * encounters, consent requests and artefacts, data transfers, link tokens), plus sessions and idempotency keys.
 * Keeps: facilities (with their HFR id), users, practitioners, and the evidence trail
 * (abdm_transactions, abdm_traces, callback_events, audit_logs).
 *
 * Every model here maps to the `chip` schema, so nothing in `public` is touched.
 * Dry run by default. Pass --yes to delete.
 */
const prisma = new PrismaClient();
const apply = process.argv.includes('--yes');

const steps = [
  ['received_health_records', (t) => t.receivedHealthRecord],
  ['data_transfers', (t) => t.dataTransfer],
  ['health_information_requests', (t) => t.healthInformationRequest],
  ['consent_artefacts', (t) => t.consentArtefact],
  ['consent_requests', (t) => t.consentRequest],
  ['care_contexts', (t) => t.careContext],
  ['health_records', (t) => t.healthRecord],
  ['encounters', (t) => t.encounter],
  ['link_tokens', (t) => t.linkToken],
  ['abha_identities', (t) => t.aBHAIdentity],
  ['mother_child_relationships', (t) => t.motherChildRelationship],
  ['pregnancies', (t) => t.pregnancy],
  ['patients', (t) => t.patient],
  ['refresh_tokens', (t) => t.refreshToken],
  ['idempotency_keys', (t) => t.idempotencyKey],
];

async function main() {
  const host = (() => {
    try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; }
  })();
  console.log(`Target: ${host}, schema chip. ${apply ? 'DELETING' : 'Dry run (pass --yes to delete)'}.`);

  if (!apply) {
    for (const [label, model] of steps) {
      console.log(label.padEnd(30), await model(prisma).count());
    }
    return;
  }
  await prisma.$transaction(async (tx) => {
    for (const [label, model] of steps) {
      const { count } = await model(tx).deleteMany({});
      console.log(label.padEnd(30), 'deleted', count);
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
