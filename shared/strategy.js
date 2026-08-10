function computeNetGain(buyPrice, sellPrice, quantity, feePercent=0.001, slippagePercent=0.002) {
  const gross = (sellPrice - buyPrice) * quantity
  const fee = (buyPrice * quantity) * feePercent + (sellPrice * quantity) * feePercent
  const slippageCost = ((buyPrice + sellPrice) / 2) * quantity * slippagePercent
  const net = gross - fee - slippageCost
  return { gross, fee, slippageCost, net }
}

function computeMetrics(trades) {
  if (!trades || trades.length === 0) return { tradesCount: 0, netPnl: 0, winRate: 0, avgWin: 0, avgLoss: 0, maxDrawdown: 0 }
  const pnl = trades.map(t => t.net)
  const netPnl = pnl.reduce((s,v)=>s+v,0)
  const wins = pnl.filter(x=>x>0)
  const losses = pnl.filter(x=>x<=0)
  const winRate = wins.length / pnl.length
  const avgWin = wins.length ? wins.reduce((s,v)=>s+v,0)/wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s,v)=>s+v,0)/losses.length : 0
  // simple max drawdown calc on equity curve
  let peak = 0, trough = 0, equity = 0, maxDd = 0
  for (const p of pnl) {
    equity += p
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDd) maxDd = dd
  }
  return { tradesCount: trades.length, netPnl, winRate, avgWin, avgLoss, maxDrawdown: maxDd }
}

module.exports = { computeNetGain, computeMetrics }
