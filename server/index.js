const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const crawler = require('./crawler')
const strategy = require('../shared/strategy')
const manifester = require('./manifest')
const storage = require('./storage')
const products = require('./products')
const coinbaseAdapter = require('./adapters/coinbase')

const app = express()
app.use(bodyParser.json())

// Serve the product UI static files
app.use('/products-ui', express.static(path.join(__dirname, 'static')))

let running = false
let actions = []
let trades = [] // executed simulated trades

app.get('/status', (req, res) => res.json({ running }))

// Bot preview endpoint: returns HTML preview and an estimate object
app.post('/bot/preview-change', async (req, res) => {
  const spec = req.body || {}
  try {
    // Basic preview rendering
    let previewHtml = ''
    let estimate = { estTimeMinutes: 1, estCostUSD: 0 }
    if (spec.type === 'create_product') {
      previewHtml = `<div style='padding:12px;font-family:Arial'><h3>Preview: New Product</h3><b>${spec.name}</b><div>${spec.description||''}</div></div>`
      estimate = { estTimeMinutes: 2, estCostUSD: 0 }
    } else if (spec.type === 'upload_file') {
      previewHtml = `<div style='padding:12px;font-family:Arial'><h3>Preview: Uploaded File</h3><div>${spec.filename}</div></div>`
      estimate = { estTimeMinutes: 1, estCostUSD: 0 }
    } else if (spec.type === 'add_strategy') {
      previewHtml = `<div style='padding:12px;font-family:Arial'><h3>Preview: New Strategy</h3><div>${spec.name}</div></div>`
      estimate = { estTimeMinutes: 10, estCostUSD: 0 }
    } else {
      previewHtml = `<div style='padding:12px;font-family:Arial'>Unknown change type</div>`
    }
    res.json({ ok: true, previewHtml, estimate })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Bot apply endpoint: applies a change after preview/approval
app.post('/bot/apply-change', async (req, res) => {
  const spec = req.body || {}
  try {
    if (spec.type === 'create_product') {
      const prod = products.createProductFromDesign(spec)
      return res.json({ ok: true, product: prod })
    }
    if (spec.type === 'upload_file') {
      // expect base64 data
      const { productId, filename, contentBase64, mime } = spec
      const buf = Buffer.from(contentBase64, 'base64')
      const sha = crypto.createHash('sha256').update(buf).digest('hex')
      const artId = `art_${Date.now()}`
      const dir = path.join(__dirname, '..', 'data', 'artifacts', artId)
      fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, filename)
      fs.writeFileSync(filePath, buf)
      const meta = { id: artId, productId: productId || null, filename, path: filePath, size: buf.length, mime: mime || 'application/octet-stream', sha256: sha, sourceUrl: spec.sourceUrl || null, uploadedBy: 'bot', createdAt: new Date().toISOString() }
      storage.addArtifact(meta)
      if (productId) storage.attachArtifactToProduct(productId, artId)
      return res.json({ ok: true, artifact: meta })
    }
    if (spec.type === 'add_strategy') {
      // Create a derived action representing the strategy (pending manifest)
      const action = {
        id: `a_${Date.now()}`,
        title: `Strategy: ${spec.name}`,
        actionType: 'strategy',
        displayText: spec.description || '',
        rawText: spec.raw || '',
        predictedGain: 0,
        confidence: 0.5,
        createdAt: new Date().toISOString()
      }
      const signed = manifester.createManifest([action])
      const rec = storage.addManifest(signed.manifest, signed.signature, 'pending', 'strategy')
      storage.addDerivedActions(signed.manifest.actions, rec.id)
      return res.json({ ok: true, manifestId: rec.id, actionsCount: signed.manifest.actions.length })
    }
    return res.status(400).json({ error: 'unknown spec type' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/start', (req, res) => {
  if (running) return res.status(400).json({error: 'already running'})
  running = true
  crawler.start((newActions)=>{ actions = newActions })
  res.json({ ok: true })
})

app.post('/stop', (req, res) => {
  running = false
  crawler.stop()
  res.json({ ok: true })
})

app.post('/install-updates', async (req, res) => {
  try {
    const current = actions.length ? actions : await crawler.fetchActionsOnce()
    const signed = manifester.createManifest(current)
    actions = signed.manifest.actions
    // persist manifest as published for dev convenience
    const rec = storage.addManifest(signed.manifest, signed.signature, 'published', req.query.category || 'general')
    res.json({ ok:true, added: actions.length, manifest: rec })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// new: trigger an on-demand category crawl and produce a pending manifest
app.post('/updates/fetch', async (req, res) => {
  const category = (req.query.category) || 'general'
  try {
    const derived = await crawler.fetchActionsOnce()
    const signed = manifester.createManifest(derived)
    const rec = storage.addManifest(signed.manifest, signed.signature, 'pending', category)
    // store derived actions as pending
    storage.addDerivedActions(signed.manifest.actions, rec.id)
    res.json({ ok: true, manifestId: rec.id, actionsCount: signed.manifest.actions.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/updates/pending', (req, res) => {
  const pending = storage.listManifests({ status: 'pending' })
  res.json(pending)
})

app.post('/updates/approve', (req, res) => {
  const { manifestId, itemIds } = req.body || {}
  if (!manifestId) return res.status(400).json({ error: 'manifestId required' })
  const m = storage._load().manifests.find(x => x.id === manifestId)
  if (!m) return res.status(404).json({ error: 'manifest not found' })

  const actionsAll = (m.manifest && m.manifest.actions) || []
  let toPublish = actionsAll
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    toPublish = actionsAll.filter(a => itemIds.includes(a.id))
  }
  // create a new published manifest that contains only toPublish
  const signed = manifester.createManifest(toPublish)
  const pubRec = storage.addManifest(signed.manifest, signed.signature, 'published', m.category || 'partial')
  // update derived_actions statuses for published ones
  const s = storage._load()
  for (const a of toPublish) {
    const da = (s.derived_actions || []).find(x => x.id === a.id)
    if (da) da.status = 'published'
  }
  storage._save(s)
  // set active actions to include published ones (merge)
  const publishedActions = (s.derived_actions || []).filter(x => x.status === 'published')
  actions = publishedActions
  res.json({ ok: true, manifest: pubRec, activated: toPublish.length })
})

app.post('/updates/reject', (req, res) => {
  const { manifestId } = req.body || {}
  if (!manifestId) return res.status(400).json({ error: 'manifestId required' })
  const m = storage.rejectManifest(manifestId)
  if (!m) return res.status(404).json({ error: 'manifest not found' })
  res.json({ ok: true, manifest: m })
})

app.get('/pricing', (req, res) => {
  const p = storage.listPricing()
  res.json(p)
})

app.get('/products', (req, res) => {
  const p = products.listProducts()
  res.json(p)
})

app.get('/products/:id/info', (req, res) => {
  const id = req.params.id
  const p = products.getProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  // include attached artifacts
  const artifacts = storage.listArtifacts().filter(a => a.productId === p.id || (p.artifacts && p.artifacts.includes(a.id)))
  res.json(Object.assign({}, p, { artifacts }))
})

app.post('/products/:id/activate', (req, res) => {
  const id = req.params.id
  const p = products.activateProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  res.json({ ok: true, product: p })
})

// Approve for actions
app.post('/products/:id/approve_actions', (req, res) => {
  const id = req.params.id
  const p = products.approveForActions(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  res.json({ ok: true, product: p })
})

// Generate derived actions for a product and create a pending manifest
app.post('/products/:id/generate-actions', async (req, res) => {
  const id = req.params.id
  const p = products.getProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  if (!p.approvedForActions) return res.status(409).json({ error: 'product not approved for actions' })
  try {
    const derived = products.createDerivedActionsForProduct(id)
    const signed = manifester.createManifest(derived)
    const rec = storage.addManifest(signed.manifest, signed.signature, 'pending', `product:${id}`)
    storage.addDerivedActions(signed.manifest.actions, rec.id)
    res.json({ ok: true, manifestId: rec.id, actionsCount: signed.manifest.actions.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/products/:id/credentials', (req, res) => {
  const id = req.params.id
  const { label, encBlob } = req.body || {}
  if (!label || !encBlob) return res.status(400).json({ error: 'label and encBlob required' })
  const cred = products.storeCredential(id, label, encBlob)
  res.json({ ok: true, credential: cred })
})

// test credential endpoint: accepts encrypted blob and runs adapter test if available
app.post('/products/:id/credentials/test', async (req, res) => {
  const id = req.params.id
  const { encBlob } = req.body || {}
  if (!encBlob) return res.status(400).json({ error: 'encBlob required' })
  const p = products.getProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  try {
    let adapter = null
    if (p.slug === 'coinbase') adapter = coinbaseAdapter
    else adapter = coinbaseAdapter
    const r = await adapter.execute({ test:true }, encBlob, 'dry')
    res.json({ ok: true, result: r })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/products/:id/credentials', (req, res) => {
  const id = req.params.id
  const creds = products.listCredentials(id)
  res.json(creds)
})

app.delete('/products/:id/credentials/:credId', (req, res) => {
  const credId = req.params.credId
  const ok = products.deleteCredential(credId)
  if (!ok) return res.status(404).json({ error: 'credential not found' })
  res.json({ ok: true })
})

app.post('/products/:id/upload', (req, res) => {
  res.status(400).json({ error: 'use /bot/apply-change with type=upload_file and contentBase64, or implement multipart upload in UI' })
})

app.get('/actions', (req, res) => res.json(actions))

// apply remains paper-mode simulation
app.post('/apply', async (req, res) => {
  const ids = (req.body && req.body.ids) || []
  const selected = actions.filter(a=>ids.includes(a.id))
  const results = []
  for (const a of selected) {
    try {
      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${a.symbol||a.asset||'bitcoin'}&vs_currencies=usd`)
      const priceJson = await priceRes.json()
      const curPrice = priceJson[a.symbol||a.asset||'bitcoin']?.usd || (a.estimatedPrice || 1)
      const quantity = (process.env.POSITION_SIZE_USD || 100) / (a.buyPrice || curPrice)
      const execution = strategy.computeNetGain(a.buyPrice || curPrice, a.sellPrice || (curPrice*(1+(a.predictedGain||0))), quantity, parseFloat(process.env.FEE_PERCENT||0.001), parseFloat(process.env.SLIPPAGE_PERCENT||0.002))
      const trade = { id: `t_${Date.now()}`, actionId: a.id, gross: execution.gross, fee: execution.fee, slippage: execution.slippageCost, net: execution.net, timestamp: new Date().toISOString() }
      trades.push(trade)
      results.push(trade)
    } catch (e) {
      results.push({ error: e.message, actionId: a.id })
    }
  }
  res.json(results)
})

// live execution endpoint (requires product enabled & credential)
app.post('/execute', async (req, res) => {
  const { actionId, credentialId, mode } = req.body || {}
  if (!actionId) return res.status(400).json({ error: 'actionId required' })
  const act = actions.find(a => a.id === actionId)
  if (!act) return res.status(404).json({ error: 'action not found' })
  const prodId = act.apiHints && act.apiHints.productId
  if (!prodId) return res.status(400).json({ error: 'action has no product hint' })
  const prod = products.getProduct(prodId)
  if (!prod || !prod.enabled) return res.status(409).json({ error: 'product not enabled', productId: prodId })
  const creds = products.listCredentials(prodId)
  if (!creds || creds.length === 0) return res.status(409).json({ error: 'no credentials for product', productId: prodId })
  const cred = creds.find(c => c.id === credentialId) || creds[0]
  if (!cred) return res.status(404).json({ error: 'credential not found' })
  try {
    let adapter = null
    if (prod.slug === 'coinbase') adapter = coinbaseAdapter
    else adapter = coinbaseAdapter // fallback
    const result = await adapter.execute(act, cred.blob, mode || 'dry')
    const tx = storage.addTransaction({ actionId: act.id, provider: prod.slug, credentialId: cred.id, request: act, result, mode: mode||'dry', status: result.success ? 'ok' : 'failed' })
    res.json({ ok: true, tx })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/transactions', (req, res) => {
  const all = storage.listTransactions()
  res.json(all)
})

app.get('/price/:symbol', async (req, res) => {
  const symbol = req.params.symbol || 'bitcoin'
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`)
    const j = await r.json()
    res.json(j)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log('server running on', port))
