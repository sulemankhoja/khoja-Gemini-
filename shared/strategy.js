function computeNetGain(buyPrice, sellPrice, quantity, feePercent=0.001, slippagePercent=0.002) {
  // feePercent and slippagePercent are e.g., 0.001 for 0.1%
  const gross = (sellPrice - buyPrice) * quantity
  const fee = (buyPrice * quantity) * feePercent + (sellPrice * quantity) * feePercent
  const slippageCost = (buyPrice + sellPrice) / 2 * quantity * slippagePercent
  const net = gross - fee - slippageCost
  return { gross, fee, slippageCost, net }
}

module.exports = { computeNetGain }
