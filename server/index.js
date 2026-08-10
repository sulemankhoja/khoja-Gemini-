const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const crawler = require('./crawler')
const strategy = require('../shared/strategy')

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
  // Simulate fetching a signed manifest and applying it (stub)
  try {
    const newActions = await crawler.fetchActionsOnce()
    actions = newActions
    res.json({ ok:true, added: newActions.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/actions', (req, res) => res.json(actions))

app.post('/apply', async (req, res) => {
  const ids = (req.body && req.body.ids) || []
  const selected = actions.filter(a=>ids.includes(a.id))
  const results = []
  for (const a of selected) {
    try {
      // Simulate execution using current price
      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${a.symbol||'shib'}&vs_currencies=usd`)
      const priceJson = await priceRes.json()
      const curPrice = priceJson[a.symbol||'shib']?.usd || (a.estimatedPrice || 1)
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
  const symbol = req.params.symbol || 'shib'
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`)
    const j = await r.json()
    res.json(j)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log('server running on', port))
