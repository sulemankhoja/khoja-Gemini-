// Simple Coinbase adapter (demo): supports dry-run and mocked live execution

async function execute(action, encryptedCredentialBlob, mode='dry') {
  // encryptedCredentialBlob is stored encrypted client-side; in this demo we don't decrypt.
  // In a real implementation the server would accept a decrypted credential blob over a secure channel
  // after user passphrase unlock. Here we simulate behavior.
  if (mode === 'dry') {
    return { success: true, txId: `dry_${Date.now()}`, note: 'dry-run simulated', actionSnapshot: action }
  }
  // simulate live execution
  // real adapter would: decrypt creds, call Coinbase API /orders, handle idempotency, and return response
  return { success: true, txId: `sim_${Date.now()}`, note: 'simulated live execution (demo)', actionSnapshot: action }
}

module.exports = { execute }
