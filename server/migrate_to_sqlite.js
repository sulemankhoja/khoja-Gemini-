// Migration script: import JSON store into SQLite (run manually)
const fs = require('fs')
const path = require('path')
const dbModule = require('./db')

const STORE_FILE = path.join(__dirname, 'data', 'store.json')

function migrate() {
  if (!fs.existsSync(STORE_FILE)) { console.error('store.json not found'); process.exit(1) }
  const txt = fs.readFileSync(STORE_FILE,'utf8')
  const s = JSON.parse(txt)
  dbModule.init()
  const db = dbModule.openDb()
  db.serialize(() => {
    const insManifest = db.prepare('INSERT OR REPLACE INTO manifests(id,content,signature,status,category,generatedAt) VALUES(?,?,?,?,?,?)')
    for (const m of s.manifests || []) insManifest.run(m.id, JSON.stringify(m.manifest), m.signature, m.status, m.category, m.generatedAt)
    insManifest.finalize()

    const insPricing = db.prepare('INSERT OR REPLACE INTO pricing(id,provider,priceUSD,currency,scrapedAt,payload) VALUES(?,?,?,?,?,?)')
    for (const p of s.pricing || []) insPricing.run(p.id || null, p.provider || p.name || null, p.priceUSD || null, p.currency || null, p.scrapedAt || null, JSON.stringify(p))
    insPricing.finalize()

    const insRaw = db.prepare('INSERT OR REPLACE INTO raw_crawl(id,url,domain,payload,scrapedAt) VALUES(?,?,?,?,?)')
    for (const r of s.raw_crawl || []) insRaw.run(r.id, r.url, r.domain, JSON.stringify(r.payload||r), r.scrapedAt)
    insRaw.finalize()

    const insAct = db.prepare('INSERT OR REPLACE INTO derived_actions(id,title,payload,status,manifestId,createdAt) VALUES(?,?,?,?,?,?)')
    for (const a of s.derived_actions || []) insAct.run(a.id, a.title || '', JSON.stringify(a), a.status || null, a.manifestId || null, a.createdAt)
    insAct.finalize()

    const insCred = db.prepare('INSERT OR REPLACE INTO credentials(id,productId,label,blob,createdAt) VALUES(?,?,?,?,?)')
    for (const c of s.credentials || []) insCred.run(c.id, c.productId, c.label, c.blob, c.createdAt)
    insCred.finalize()

    const insTx = db.prepare('INSERT OR REPLACE INTO transactions(id,actionId,provider,credentialId,request,result,status,recordedAt) VALUES(?,?,?,?,?,?,?,?)')
    for (const t of s.transactions || []) insTx.run(t.id, t.actionId, t.provider, t.credentialId, JSON.stringify(t.request||{}), JSON.stringify(t.result||{}), t.status, t.recordedAt)
    insTx.finalize()
  })
  db.close()
  console.log('migration complete')
}

if (require.main === module) migrate()
