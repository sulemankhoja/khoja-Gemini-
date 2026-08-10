function _load() {
  if (!fs.existsSync(STORE_FILE)) return { manifests: [], pricing: [], raw_crawl: [], derived_actions: [], credentials: [], transactions: [], artifacts: [], botAvatar: null }
  try {
    const txt = fs.readFileSync(STORE_FILE, 'utf8')
    return JSON.parse(txt)
  } catch (e) {
    console.error('Failed to read store.json', e.message)
    return { manifests: [], pricing: [], raw_crawl: [], derived_actions: [], credentials: [], transactions: [], artifacts: [], botAvatar: null }
  }
}
