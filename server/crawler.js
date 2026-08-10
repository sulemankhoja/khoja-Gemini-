const Bottleneck = require('bottleneck')
const fetch = require('node-fetch')
const Parser = require('rss-parser')
const cheerio = require('cheerio')

const limiter = new Bottleneck({ minTime: 1000 }) // 1 req/sec per domain (global for demo)
const rss = new Parser()

let timer = null

const seedFeeds = [
  'https://cryptonews.com/news/feed',
  'https://cointelegraph.com/rss',
  'https://coindesk.com/arc/outboundfeeds/rss/'
]

async function fetchRss() {
  for (const url of seedFeeds) {
    try {
      const feed = await rss.parseURL(url)
      console.log('RSS', url, 'items', feed.items.length)
      // Process items -> extract entities & sentiment (stub)
    } catch (e) {
      console.log('RSS fetch error', url, e.message)
    }
  }
}

async function crawlUrl(url) {
  try {
    const r = await limiter.schedule(() => fetch(url, { timeout: 10000 }))
    const body = await r.text()
    const $ = cheerio.load(body)
    const text = $('body').text().slice(0, 5000)
    // Extract mentions of SHIB and simple keyword sentiment
    return { url, text }
  } catch (e) {
    console.log('Crawl error', url, e.message)
    return null
  }
}

function start() {
  console.log('Crawler started')
  if (timer) return
  timer = setInterval(async () => {
    console.log('Crawler tick: fetching RSS feeds')
    await fetchRss()
    // In a real pipeline: fetch news APIs, social APIs, expand links within allowed domains, extract actions
  }, (process.env.CRAWL_INTERVAL_MINUTES || 5) * 60 * 1000)
}

function stop() {
  console.log('Crawler stopped')
  if (timer) clearInterval(timer)
  timer = null
}

module.exports = { start, stop, crawlUrl }
