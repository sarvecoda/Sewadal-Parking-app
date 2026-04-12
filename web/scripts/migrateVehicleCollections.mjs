#!/usr/bin/env node
/**
 * One-time copy: legacy Android collections → web-only collections.
 * Uses the Firebase Admin SDK (bypasses Firestore rules).
 *
 * Keep FROM_* / TO_* in sync with:
 * - Android: app/.../VehicleRepository.kt (FROM_* only)
 * - Web defaults: web/src/vehicleRepository.ts + web/firestore.rules (TO_* only)
 *
 * Usage:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key.
 *   2. Save the JSON outside the repo (or use a path listed in .gitignore).
 *   3. From web/:
 *        export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccount.json"
 *        optional: export FIREBASE_PROJECT_ID="your-project-id"  (else taken from JSON)
 *        npm run migrate:vehicles -- --dry-run
 *        npm run migrate:vehicles
 *   4. Deploy web + rules: npm run deploy
 *   5. When satisfied, delete old collections in the Firebase Console (Data tab).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import admin from 'firebase-admin'

const FROM_MASTER = 'your_collection'
const FROM_TODAY = 'your_collection1'
const TO_MASTER = 'my_new_collection'
const TO_TODAY = 'my_new_collection_1'

const BATCH_MAX = 400

const dryRun = process.argv.includes('--dry-run')

function initAdmin() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    console.error(
      'Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to the absolute path of your service account JSON.',
    )
    process.exit(1)
  }
  const resolved = resolve(credPath)
  if (!existsSync(resolved)) {
    console.error(`Credentials file not found: ${resolved}`)
    process.exit(1)
  }
  const json = JSON.parse(readFileSync(resolved, 'utf8'))
  const projectId = process.env.FIREBASE_PROJECT_ID || json.project_id
  if (!projectId) {
    console.error('Could not determine project id. Set FIREBASE_PROJECT_ID.')
    process.exit(1)
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(json),
      projectId,
    })
  }
  return admin.firestore()
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} fromName
 * @param {string} toName
 */
async function copyCollection(db, fromName, toName) {
  const snap = await db.collection(fromName).get()
  console.log(`\n${fromName} → ${toName}: ${snap.size} document(s)`)
  if (dryRun) return

  let batch = db.batch()
  let ops = 0
  for (const d of snap.docs) {
    const dest = db.collection(toName).doc(d.id)
    batch.set(dest, d.data())
    ops++
    if (ops >= BATCH_MAX) {
      await batch.commit()
      batch = db.batch()
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()
  console.log(`  committed ${snap.size} write(s) to ${toName}`)
}

async function main() {
  console.log(dryRun ? 'DRY RUN (no writes)\n' : 'LIVE COPY\n')
  const db = initAdmin()
  await copyCollection(db, FROM_MASTER, TO_MASTER)
  await copyCollection(db, FROM_TODAY, TO_TODAY)
  console.log(
    dryRun
      ? '\nDry run finished. Run without --dry-run to copy, then npm run deploy.'
      : '\nDone. Deploy web + rules (npm run deploy), verify the site, then delete old collections in the console when ready.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
