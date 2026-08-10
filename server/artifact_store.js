const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const ART_DIR = path.join(DATA_DIR, 'artifacts')

if (!fs.existsSync(ART_DIR)) fs.mkdirSync(ART_DIR, { recursive: true })

function saveBase64File(artifactId, filename, base64) {
  const dir = path.join(ART_DIR, artifactId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  const buf = Buffer.from(base64, 'base64')
  fs.writeFileSync(filePath, buf)
  return filePath
}

module.exports = { saveBase64File }
