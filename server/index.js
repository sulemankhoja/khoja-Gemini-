const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const crawler = require('./crawler')
const strategy = require('../shared/strategy')

const app = express()
app.use(bodyParser.json())

let running = false

app.get('/status', (req, res) => {
  res.json({ running })
})

app.post('/start', (req, res) => {
  if (running) return res.status(400).json({error: 'already running'})
  running = true
  crawler.start()
  // start strategy loop (paper trading)
  res.json({ ok: true })
})

app.post('/stop', (req, res) => {
  running = false
  crawler.stop()
  res.json({ ok: true })
})

app.get('/price/:symbol', async (req, res) => {
  const symbol = req.params.symbol || 'shib'
  try {
    // Demo using CoinGecko public API
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`)
    const j = await r.json()
    res.json(j)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/actions', (req, res) => {
  // placeholder: crawler would produce actions
  res.json([
    { id: 'a1', label: 'Buy SHIB on news spike', expectedGain: 0.03 },
    { id: 'a2', label: 'Sell SHIB on momentum', expectedGain: 0.02 }
  ])
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log('server running on', port))
