#!/usr/bin/env node
/**
 * Reformat all vehicle numbers (entry2) in master + today to "KA 03 NX 1174" style.
 * Auth: Firebase CLI refresh token.
 *
 *   node scripts/reformatVehiclePlates.mjs --dry-run
 *   node scripts/reformatVehiclePlates.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Firestore } = require('@google-cloud/firestore')

const PROJECT_ID = 'sns-parking-app-blr-d40c7'
const COLLECTIONS = ['my_new_collection', 'my_new_collection_1']
const CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const BATCH_MAX = 400
const dryRun = process.argv.includes('--dry-run')

/** Keep in sync with web/src/plateFormat.ts */
function formatVehicleNumber(raw) {
  const compact = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!compact) return ''
  const bh = compact.match(/^(\d{2})(BH)(\d{4})([A-Z]{0,2})$/)
  if (bh) return [bh[1], bh[2], bh[3], bh[4]].filter(Boolean).join(' ')
  const classic = compact.match(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/)
  if (classic) return `${classic[1]} ${classic[2]} ${classic[3]} ${classic[4]}`
  return compact.replace(/([A-Z])(\d)/g, '$1 $2').replace(/(\d)([A-Z])/g, '$1 $2')
}

function loadFirebaseRefreshToken() {
  const p = join(homedir(), '.config/configstore/firebase-tools.json')
  if (!existsSync(p)) throw new Error(`Missing ${p}`)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const refresh = j.tokens?.refresh_token
  if (!refresh) throw new Error('No refresh_token — run firebase login')
  return refresh
}

function firestoreClient() {
  return new Firestore({
    projectId: PROJECT_ID,
    credentials: {
      type: 'authorized_user',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: loadFirebaseRefreshToken(),
    },
  })
}

async function main() {
  console.log(dryRun ? 'DRY RUN\n' : 'LIVE REFORMAT\n')

  const samples = [
    ['ka03nx1174', 'KA 03 NX 1174'],
    ['KA03NX1174', 'KA 03 NX 1174'],
    ['25bh5239f', '25 BH 5239 F'],
    ['HR26CL8056', 'HR 26 CL 8056'],
  ]
  for (const [inP, want] of samples) {
    const got = formatVehicleNumber(inP)
    if (got !== want) {
      console.error(`format check failed: ${inP} → ${got} (want ${want})`)
      process.exit(1)
    }
  }
  console.log('format self-check ok\n')

  const db = firestoreClient()
  let updates = 0
  let scanned = 0

  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).get()
    console.log(`${col}: ${snap.size} docs`)
    let batch = db.batch()
    let ops = 0
    for (const d of snap.docs) {
      scanned++
      const data = d.data()
      const before = data.entry2 ?? ''
      const after = formatVehicleNumber(before)
      if (!after || after === before) continue
      updates++
      if (updates <= 50 || dryRun) {
        console.log(`  ${d.id}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
      }
      if (!dryRun) {
        batch.update(d.ref, { entry2: after })
        ops++
        if (ops >= BATCH_MAX) {
          await batch.commit()
          batch = db.batch()
          ops = 0
        }
      }
    }
    if (!dryRun && ops > 0) await batch.commit()
  }

  console.log(
    `\nScanned ${scanned}. ${dryRun ? 'Would update' : 'Updated'} ${updates} document(s).`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
