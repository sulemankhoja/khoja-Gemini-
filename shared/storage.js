const crypto = require('crypto')

function encrypt(data, password) {
  const iv = crypto.randomBytes(12)
  const key = crypto.createHash('sha256').update(password).digest()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

function decrypt(enc, password) {
  const buf = Buffer.from(enc, 'base64')
  const iv = buf.slice(0,12)
  const tag = buf.slice(12,28)
  const ciphertext = buf.slice(28)
  const key = crypto.createHash('sha256').update(password).digest()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plain.toString('utf8'))
}

module.exports = { encrypt, decrypt }
