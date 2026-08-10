const sqlite3 = require('sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'khoja.db')

function openDb() {
  return new sqlite3.Database(DB_PATH)
}

function init() {
  const db = openDb()
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS manifests(id TEXT PRIMARY KEY, content TEXT, signature TEXT, status TEXT, category TEXT, generatedAt TEXT)`)
    db.run(`CREATE TABLE IF NOT EXISTS pricing(id TEXT PRIMARY KEY, provider TEXT, priceUSD REAL, currency TEXT, scrapedAt TEXT, payload TEXT)`)
    db.run(`CREATE TABLE IF NOT EXISTS raw_crawl(id TEXT PRIMARY KEY, url TEXT, domain TEXT, payload TEXT, scrapedAt TEXT)`)
    db.run(`CREATE TABLE IF NOT EXISTS derived_actions(id TEXT PRIMARY KEY, title TEXT, payload TEXT, status TEXT, manifestId TEXT, createdAt TEXT)`)
    db.run(`CREATE TABLE IF NOT EXISTS credentials(id TEXT PRIMARY KEY, productId TEXT, label TEXT, blob TEXT, createdAt TEXT)`)
    db.run(`CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY, actionId TEXT, provider TEXT, credentialId TEXT, request TEXT, result TEXT, status TEXT, recordedAt TEXT)`)
  })
  db.close()
}

module.exports = { init, openDb }
