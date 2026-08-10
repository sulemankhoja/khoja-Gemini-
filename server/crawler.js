const Bottleneck = require('bottleneck')
const fetch = require('node-fetch')
const Parser = require('rss-parser')
const cheerio = require('cheerio')

const limiter = new Bottleneck({ minTime: 1000 })
const rss = new Parser()

let timer = null
let currentActions = []

const seedFeeds = [
  'https://cryptonews.com/news/feed',
  'https://cointelegraph.com/rss',
  'https://coindesk.com/arc/outboundfeeds/rss/'
]

async function fetchRss() {
  const collected = []
  for (const url of seedFeeds) {
    try {
      const feed = await rss.parseURL(url)
      for (const item of feed.items.slice(0,5)) {
        collected.push({ title: item.title, link: item.link, pubDate: item.pubDate })
      }
    } catch (e) {
      console.log('RSS fetch error', url, e.message)
    }
  }
  return collected
}

async function fetchActionsOnce() {
  // Very simple rule-based action generation from RSS headlines (demo)
  const items = await fetchRss()
  const actions = []
  let idCounter = Date.now()
  for (const it of items) {
    const text = (it.title || '').toLowerCase()
    if (text.includes('shib') || text.includes('shiba')) {
      const predictedGain = text.includes('soars') || text.includes('surge') ? 0.05 : (text.includes('pump') ? 0.04 : 0.015)
      const action = {
        id: `a_${idCounter++}`,
        label: `News-driven buy for SHIB: ${it.title}`,
        symbol: 'shib',
        buyPrice: null,
        sellPrice: null,
        predictedGain,
        confidence: 0.5 + Math.min(0.5, predictedGain*5),
        source: it.link,
        published: it.pubDate,
        actualGain: null
      }
      actions.push(action)
    }
  }
  currentActions = actions
  return actions
}

function start(callback) {
  if (timer) return
  timer = setInterval(async () => {
    console.log('Crawler tick: fetching actions')
    const acts = await fetchActionsOnce()
    if (callback) callback(acts)
  }, (process.env.CRAWL_INTERVAL_MINUTES || 5) * 60 * 1000)
  // do one immediate fetch
  fetchActionsOnce().then(acts => { if (callback) callback(acts) })
}

function stop() { if (timer) clearInterval(timer); timer = null }

function getActions() { return currentActions }

module.exports = { start, stop, fetchActionsOnce, getActions }
