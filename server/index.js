const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const crawler = require('./crawler')
const strategy = require('../shared/strategy')
const manifester = require('./manifest')
const storage = require('./storage')

const app = express()
app.use(bodyParser.json())

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
    // For now, reuse fetchActionsOnce which scrapes news; in future we'll scope by category
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

app.get('/actions', (req, res) => res.json(actions))

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
