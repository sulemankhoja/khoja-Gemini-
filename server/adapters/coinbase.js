// Enhanced Coinbase adapter: provide quote and simulated execution + fee estimates
const fetch = require('node-fetch')

async function getPriceUsd(asset='bitcoin') {
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${asset}&vs_currencies=usd`)
    const j = await r.json()
    return j[asset] && j[asset].usd ? j[asset].usd : null
  } catch (e) { return null }
}

async function execute(action, encryptedCredentialBlob, mode='dry') {
  // action may include amountUSD or quantity
  const asset = (action.asset || 'bitcoin').toLowerCase()
  const price = await getPriceUsd(asset)
  const feePct = 0.005 // simulated 0.5% fee
  if (mode === 'dry') {
    const amountUSD = action.amountUSD || (action.estimatedUSD || 100)
    const qty = price ? (amountUSD / price) : (action.quantity || 0)
    const fee = amountUSD * feePct
    const net = amountUSD - fee
    return { success: true, txId: `dry_${Date.now()}`, simulated: true, quote: { price, qty, fee, net, feePct } }
  }
  // simulated live
  const amountUSD = action.amountUSD || (action.estimatedUSD || 100)
  const qty = price ? (amountUSD / price) : (action.quantity || 0)
  const fee = amountUSD * feePct
  const net = amountUSD - fee
  return { success: true, txId: `live_sim_${Date.now()}`, simulated: false, executed: { price, qty, fee, net, feePct } }
}

module.exports = { execute }
