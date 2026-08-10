const { encrypt, decrypt } = require('../shared/storage')
const storage = require('./storage')
const artifactStore = require('./artifact_store')

// Seed product catalog
const PRODUCTS = [
  { id: 'prod_coinbase', slug: 'coinbase', name: 'Coinbase', category: 'exchange', description: 'Coinbase exchange for spot trading and wallets', capabilities: ['trade','wallet'], docsUrl: 'https://developers.coinbase.com', signupUrl: 'https://www.coinbase.com', sandboxUrl: 'https://sandbox.coinbase.com', supportedActions: ['buy','sell','transfer'], enabled: false, createdAt: new Date().toISOString() },
  { id: 'prod_binance', slug: 'binance', name: 'Binance', category: 'exchange', description: 'Binance exchange', capabilities: ['trade'], docsUrl: 'https://binance-docs.github.io', signupUrl: 'https://www.binance.com', sandboxUrl: null, supportedActions: ['buy','sell','transfer'], enabled: false, createdAt: new Date().toISOString() },
  { id: 'prod_twilio', slug: 'twilio', name: 'Twilio', category: 'messaging', description: 'Twilio SMS provider (for market messages)', capabilities: ['messaging'], docsUrl: 'https://www.twilio.com/docs', signupUrl: 'https://www.twilio.com/try-twilio', sandboxUrl: null, supportedActions: ['message'], enabled: false, createdAt: new Date().toISOString() }
]

function initProducts() {
  const s = storage._load()
  const hasProducts = (s.pricing || []).some(x=>x.type==='product')
  if (!hasProducts) {
    for (const p of PRODUCTS) {
      storage.addPricing({ type: 'product', id: p.id, slug: p.slug, name: p.name, desc: p.description, docsUrl: p.docsUrl, signupUrl: p.signupUrl, enabled: p.enabled, createdAt: p.createdAt })
    }
  }
}

function listProducts() {
  const all = storage.listPricing()
  return all.filter(x=>x.type==='product')
}

function getProduct(id) {
  const all = listProducts()
  return all.find(p=>p.id===id || p.slug===id)
}

function activateProduct(id) {
  const s = storage._load()
  const idx = s.pricing.findIndex(x => x.type==='product' && (x.id===id || x.slug===id))
  if (idx === -1) return null
  s.pricing[idx].enabled = true
  s.pricing[idx].enabledAt = new Date().toISOString()
  storage._save(s)
  return s.pricing[idx]
}

function deactivateProduct(id) {
  const s = storage._load()
  const idx = s.pricing.findIndex(x => x.type==='product' && (x.id===id || x.slug===id))
  if (idx === -1) return null
  s.pricing[idx].enabled = false
  s.pricing[idx].disabledAt = new Date().toISOString()
  storage._save(s)
  return s.pricing[idx]
}

function storeCredential(productId, label, encBlob) {
  const s = storage._load()
  s.credentials = s.credentials || []
  const id = `cred_${Date.now()}`
  s.credentials.push({ id, productId, label, blob: encBlob, createdAt: new Date().toISOString() })
  storage._save(s)
  return { id, productId, label }
}

function listCredentials(productId) {
  const s = storage._load()
  return (s.credentials || []).filter(c => c.productId === productId)
}

function deleteCredential(credId) {
  const s = storage._load()
  const idx = (s.credentials || []).findIndex(c => c.id === credId)
  if (idx === -1) return false
  s.credentials.splice(idx, 1)
  storage._save(s)
  return true
}

// Mark product as approved for creating actions (distinct from activation)
function approveForActions(id) {
  const s = storage._load()
  const idx = s.pricing.findIndex(x => x.type==='product' && (x.id===id || x.slug===id))
  if (idx === -1) return null
  s.pricing[idx].approvedForActions = true
  s.pricing[idx].approvedForActionsAt = new Date().toISOString()
  storage._save(s)
  return s.pricing[idx]
}

// Create derived action objects (not persisted here)
function createDerivedActionsForProduct(id) {
  const p = getProduct(id)
  if (!p) return []
  const now = Date.now()
  const a = [{
    id: `a_${now}`,
    title: `Prepare integration with ${p.name}`,
    productId: p.id,
    side: 'execute',
    actionType: 'api_call',
    actionSubType: 'product_integration',
    apiHints: { productId: p.id, endpoint: p.docsUrl || p.signupUrl, method: 'GET' },
    displayText: `Integration action for ${p.name}`,
    rawText: `Crawled product ${p.name} (${p.slug}) - use this action to integrate or provision APIs.`,
    predictedGain: 0,
    confidence: 0.5,
    ttlSeconds: 86400,
    createdAt: new Date().toISOString()
  }]
  return a
}

// Generate a simple red/gold SVG with letter K for product thumbnails
function generateKSvg(opts) {
  const size = opts && opts.size ? opts.size : 512
  const kLetter = opts && opts.letter ? opts.letter : 'K'
  const bg = '#7d0a0a' // deep red
  const gold = '#d4af37'
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  <rect width="100%" height="100%" fill="${bg}"/>\n  <g transform="translate(${size/2},${size/2})">\n    <text x="0" y="0" text-anchor="middle" alignment-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="${Math.floor(size*0.5)}" fill="${gold}" font-weight="700">${kLetter}</text>\n  </g>\n</svg>`
  return svg
}

// Create a product from a design spec; if no image provided, generate one (K on red/gold)
function createProductFromDesign(spec) {
  const id = `prod_${Date.now()}`
  const name = spec.name || spec.title || 'Untitled Product'
  const desc = spec.description || spec.raw || ''
  // persist product as pricing-type product for compatibility
  const prod = { type: 'product', id, slug: id, name, desc, docsUrl: spec.docsUrl || null, signupUrl: spec.signupUrl || null, enabled: !!spec.enabled }
  storage.addPricing(prod)

  // if spec contains contentBase64 (image uploaded), save as artifact and attach
  if (spec.contentBase64 && spec.filename) {
    const artifactId = `art_${Date.now()}`
    const dir = path.join(__dirname, '..', 'data', 'artifacts', artifactId)
  }

  // if no explicit image was provided, generate a K SVG and store it
  const svg = generateKSvg({ size: 512, letter: 'K' })
  const svgB64 = Buffer.from(svg, 'utf8').toString('base64')
  const filePath = artifactStore.saveBase64File(`art_${Date.now()}`, `${id}.svg`, svgB64)
  const sha = crypto.createHash('sha256').update(svg).digest('hex')
  const meta = { filename: `${id}.svg`, path: filePath, size: Buffer.byteLength(svg, 'utf8'), mime: 'image/svg+xml', sha256: sha, productId: id, uploadedBy: 'bot', createdAt: new Date().toISOString() }
  const art = storage.addArtifact(meta)
  storage.attachArtifactToProduct(id, art.id)

  return prod
}

module.exports = { initProducts, listProducts, getProduct, activateProduct, deactivateProduct, storeCredential, listCredentials, deleteCredential, approveForActions, createDerivedActionsForProduct, createProductFromDesign }
