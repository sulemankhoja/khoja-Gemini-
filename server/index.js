const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const path = require('path')
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
  const m = storage.publishManifest(manifestId)
  if (!m) return res.status(404).json({ error: 'manifest not found' })
  // mark derived actions as published and add to active actions
  const publishedActions = m.manifest.actions || []
  actions = publishedActions
  res.json({ ok: true, manifest: m, activated: publishedActions.length })
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
  res.json(p)
})

app.post('/products/:id/activate', (req, res) => {
  const id = req.params.id
  const p = products.activateProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  res.json({ ok: true, product: p })
})

app.post('/products/:id/deactivate', (req, res) => {
  const id = req.params.id
  const p = products.deactivateProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  res.json({ ok: true, product: p })
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
    // demo: adapter test could decrypt and call provider; here we simulate a result
    // If adapter has a test method, call it. For now coinbase adapter is demo and returns success for any blob.
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
    // decrypt of cred.blob is done client-side (we store encrypted blobs only). For demo, pass the blob to adapter.
    let adapter = null
    if (prod.slug === 'coinbase') adapter = coinbaseAdapter
    else adapter = coinbaseAdapter // fallback
    const result = await adapter.execute(act, cred.blob, mode || 'dry')
    // persist transaction
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

app.get('/stats', (req, res) => {
  const metrics = strategy.computeMetrics(trades)
  res.json(metrics)
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
