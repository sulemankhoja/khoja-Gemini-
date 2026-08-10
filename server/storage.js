const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function _load() {
  if (!fs.existsSync(STORE_FILE)) return { manifests: [], pricing: [], raw_crawl: [], derived_actions: [], credentials: [], transactions: [], artifacts: [] }
  try {
    const txt = fs.readFileSync(STORE_FILE, 'utf8')
    return JSON.parse(txt)
  } catch (e) {
    console.error('Failed to read store.json', e.message)
    return { manifests: [], pricing: [], raw_crawl: [], derived_actions: [], credentials: [], transactions: [], artifacts: [] }
  }
}

function _save(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8')
}

function listManifests(filter) {
  const s = _load()
  if (!filter) return s.manifests
  return s.manifests.filter(m => {
    for (const k of Object.keys(filter)) {
      if (m[k] !== filter[k]) return false
    }
    return true
  })
}

function addManifest(manifest, signature, status='pending', category='general') {
  const s = _load()
  const id = `m_${Date.now()}`
  const rec = { id, manifest, signature, status, category, generatedAt: new Date().toISOString() }
  s.manifests.push(rec)
  _save(s)
  return rec
}

function publishManifest(id) {
  const s = _load()
  const m = s.manifests.find(x=>x.id===id)
  if (!m) return null
  m.status = 'published'
  m.publishedAt = new Date().toISOString()
  _save(s)
  return m
}

function rejectManifest(id) {
  const s = _load()
  const m = s.manifests.find(x=>x.id===id)
  if (!m) return null
  m.status = 'rejected'
  m.rejectedAt = new Date().toISOString()
  _save(s)
  return m
}

function addPricing(obj) {
  const s = _load()
  obj.scrapedAt = new Date().toISOString()
  s.pricing.push(obj)
  _save(s)
  return obj
}

function listPricing() { return _load().pricing }

function addRawCrawl(rec) {
  const s = _load()
  rec.scrapedAt = new Date().toISOString()
  rec.id = `r_${Date.now()}`
  s.raw_crawl.push(rec)
  _save(s)
  return rec
}

function addDerivedActions(actions, manifestId) {
  const s = _load()
  for (const a of actions) {
    a.createdAt = new Date().toISOString()
    a.manifestId = manifestId
    a.status = 'pending'
    s.derived_actions.push(a)
  }
  _save(s)
  return actions
}

function listDerivedActions(filter) {
  const s = _load()
  if (!filter) return s.derived_actions
  return s.derived_actions.filter(a => {
    for (const k of Object.keys(filter)) {
      if (a[k] !== filter[k]) return false
    }
    return true
  })
}

// Credentials handling
function addCredential(productId, label, encBlob) {
  const s = _load()
  const id = `cred_${Date.now()}`
  s.credentials = s.credentials || []
  const rec = { id, productId, label, blob: encBlob, createdAt: new Date().toISOString() }
  s.credentials.push(rec)
  _save(s)
  return rec
}

function listCredentials(productId) {
  const s = _load()
  return (s.credentials || []).filter(c => c.productId === productId)
}

function deleteCredential(credId) {
  const s = _load()
  s.credentials = s.credentials || []
  const idx = s.credentials.findIndex(c => c.id === credId)
  if (idx === -1) return false
  s.credentials.splice(idx, 1)
  _save(s)
  return true
}

// Transactions
function addTransaction(tx) {
  const s = _load()
  tx.recordedAt = new Date().toISOString()
  tx.id = tx.id || `tx_${Date.now()}`
  s.transactions = s.transactions || []
  s.transactions.push(tx)
  _save(s)
  return tx
}

function listTransactions(filter) {
  const s = _load()
  if (!filter) return s.transactions || []
  return (s.transactions || []).filter(t => {
    for (const k of Object.keys(filter)) {
      if (t[k] !== filter[k]) return false
    }
    return true
  })
}

// Artifacts (uploaded/imported files)
function addArtifact(meta) {
  const s = _load()
  const id = `art_${Date.now()}`
  meta.id = id
  meta.createdAt = new Date().toISOString()
  s.artifacts = s.artifacts || []
  s.artifacts.push(meta)
  _save(s)
  return meta
}

function listArtifacts(filter) {
  const s = _load()
  let a = s.artifacts || []
  if (!filter) return a
  return a.filter(art => {
    for (const k of Object.keys(filter)) {
      if (art[k] !== filter[k]) return false
    }
    return true
  })
}

function getArtifact(id) {
  const s = _load()
  return (s.artifacts || []).find(x => x.id === id)
}

function attachArtifactToProduct(productId, artifactId) {
  const s = _load()
  s.pricing = s.pricing || []
  const p = s.pricing.find(x => x.id === productId || x.slug === productId)
  if (!p) return false
  p.artifacts = p.artifacts || []
  if (!p.artifacts.includes(artifactId)) p.artifacts.push(artifactId)
  _save(s)
  return true
}

module.exports = { _load, _save, listManifests, addManifest, publishManifest, rejectManifest, addPricing, listPricing, addRawCrawl, addDerivedActions, listDerivedActions, addCredential, listCredentials, deleteCredential, addTransaction, listTransactions, addArtifact, listArtifacts, getArtifact, attachArtifactToProduct }
