const crypto = require('crypto')

function signData(data) {
  const privateKeyPem = process.env.MANIFEST_PRIVATE_KEY
  if (!privateKeyPem) throw new Error('MANIFEST_PRIVATE_KEY is not set')
  const sign = crypto.createSign('SHA256')
  sign.update(data)
  sign.end()
  const signature = sign.sign(privateKeyPem, 'base64')
  return signature
}

function verifyData(data, signature, publicKeyPem) {
  const verify = crypto.createVerify('SHA256')
  verify.update(data)
  verify.end()
  return verify.verify(publicKeyPem, signature, 'base64')
}

function createManifest(actions) {
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    actions
  }
  const payload = JSON.stringify(manifest)
  const signature = signData(payload)
  return { manifest, signature, publicKey: process.env.MANIFEST_PUBLIC_KEY || null }
}

module.exports = { createManifest, verifyData }
