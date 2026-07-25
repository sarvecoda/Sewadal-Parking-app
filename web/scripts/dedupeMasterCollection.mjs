#!/usr/bin/env node
/**
 * Backup + dedupe my_new_collection by normalized vehicle number (entry2).
 * Auth: Firebase CLI refresh token (same login used for deploy).
 *
 * Usage (from web/):
 *   node scripts/dedupeMasterCollection.mjs --dry-run
 *   node scripts/dedupeMasterCollection.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Firestore } = require('@google-cloud/firestore')

const PROJECT_ID = 'sns-parking-app-blr-d40c7'
const MASTER = 'my_new_collection'
const TODAY = 'my_new_collection_1'
const CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

const dryRun = process.argv.includes('--dry-run')
const BATCH_MAX = 400

function loadFirebaseRefreshToken() {
  const p = join(homedir(), '.config/configstore/firebase-tools.json')
  if (!existsSync(p)) {
    throw new Error(`Missing Firebase CLI login file: ${p}`)
  }
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const refresh = j.tokens?.refresh_token
  if (!refresh) throw new Error('No refresh_token in firebase-tools.json — run firebase login')
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

function fieldStr(v) {
  if (v == null) return ''
  return String(v).trim()
}

/** Plate key: lowercase, strip all whitespace. */
function plateKey(entry2) {
  return fieldStr(entry2).toLowerCase().replace(/\s+/g, '')
}

function completenessScore(data) {
  let score = 0
  for (const k of ['entry1', 'entry2', 'entry3', 'entry4']) {
    if (fieldStr(data[k])) score += 1
  }
  // Prefer richer text when field counts tie
  const len =
    fieldStr(data.entry1).length +
    fieldStr(data.entry2).length +
    fieldStr(data.entry3).length +
    fieldStr(data.entry4).length
  return score * 10_000 + len
}

function serializeDoc(d) {
  const data = d.data()
  return {
    id: d.id,
    data: JSON.parse(
      JSON.stringify(data, (_k, v) => {
        if (v && typeof v === 'object' && typeof v.toDate === 'function') {
          return { __ts: v.toDate().toISOString() }
        }
        return v
      }),
    ),
  }
}

async function dumpCollection(db, name) {
  const snap = await db.collection(name).get()
  return {
    collection: name,
    exportedAt: new Date().toISOString(),
    count: snap.size,
    documents: snap.docs.map(serializeDoc),
  }
}

async function main() {
  console.log(dryRun ? 'DRY RUN\n' : 'LIVE DEDUPE\n')
  const db = firestoreClient()

  const backupDir = resolve('backups')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupDir, `firestore-backup-${stamp}.json`)

  console.log('Reading collections…')
  const masterDump = await dumpCollection(db, MASTER)
  const todayDump = await dumpCollection(db, TODAY)
  const backup = {
    projectId: PROJECT_ID,
    exportedAt: new Date().toISOString(),
    collections: {
      [MASTER]: masterDump,
      [TODAY]: todayDump,
    },
  }
  writeFileSync(backupPath, JSON.stringify(backup, null, 2))
  console.log(
    `Backup written: ${backupPath}\n  ${MASTER}: ${masterDump.count} docs\n  ${TODAY}: ${todayDump.count} docs`,
  )

  const groups = new Map()
  for (const row of masterDump.documents) {
    const key = plateKey(row.data.entry2)
    if (!key) {
      console.warn(`  skip empty plate id=${row.id}`)
      continue
    }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const toDelete = []
  const keepPlan = []
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue
    rows.sort((a, b) => {
      const sa = completenessScore(a.data)
      const sb = completenessScore(b.data)
      if (sb !== sa) return sb - sa
      return a.id.localeCompare(b.id)
    })
    const keep = rows[0]
    const drop = rows.slice(1)
    keepPlan.push({
      plateKey: key,
      keepId: keep.id,
      keepScore: completenessScore(keep.data),
      dropIds: drop.map((d) => d.id),
      sample: {
        entry1: keep.data.entry1,
        entry2: keep.data.entry2,
        entry3: keep.data.entry3,
        entry4: keep.data.entry4,
      },
    })
    for (const d of drop) toDelete.push(d.id)
  }

  console.log(
    `\nDuplicate plate groups: ${keepPlan.length}\nDocuments to delete: ${toDelete.length}`,
  )
  for (const g of keepPlan.slice(0, 40)) {
    console.log(
      `  KEEP ${g.keepId} (${g.sample.entry2}) score=${g.keepScore} | DELETE ${g.dropIds.length}: ${g.dropIds.join(', ')}`,
    )
  }
  if (keepPlan.length > 40) console.log(`  … ${keepPlan.length - 40} more groups`)

  if (dryRun) {
    console.log('\nDry run only — no deletes. Re-run without --dry-run to apply.')
    return
  }

  if (toDelete.length === 0) {
    console.log('\nNothing to delete.')
    return
  }

  let batch = db.batch()
  let ops = 0
  let deleted = 0
  for (const id of toDelete) {
    batch.delete(db.collection(MASTER).doc(id))
    ops++
    deleted++
    if (ops >= BATCH_MAX) {
      await batch.commit()
      batch = db.batch()
      ops = 0
      console.log(`  committed batch… deleted so far ${deleted}`)
    }
  }
  if (ops > 0) await batch.commit()

  const after = await db.collection(MASTER).get()
  console.log(
    `\nDone. Deleted ${deleted} duplicate master docs.\n${MASTER} now has ${after.size} documents (was ${masterDump.count}).`,
  )
  console.log(`Backup remains at: ${backupPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
