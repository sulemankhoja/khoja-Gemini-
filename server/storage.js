const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function _load() {
  if (!fs.existsSync(STORE_FILE)) return { manifests: [], pricing: [], raw_crawl: [], derived_actions: [] }
  try {
    const txt = fs.readFileSync(STORE_FILE, 'utf8')
    return JSON.parse(txt)
  } catch (e) {
    console.error('Failed to read store.json', e.message)
    return { manifests: [], pricing: [], raw_crawl: [], derived_actions: [] }
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

module.exports = { listManifests, addManifest, publishManifest, rejectManifest, addPricing, listPricing, addRawCrawl, addDerivedActions, listDerivedActions }
