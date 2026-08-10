// Get bot avatar metadata (returns { url: '/bot/avatar.png' } if set)
app.get('/bot/avatar', (req, res) => {
  const store = storage._load()
  const artId = store.botAvatar
  if (!artId) return res.json({})
  const art = storage.getArtifact(artId)
  if (!art) return res.json({})
  // URL to download
  return res.json({ url: `/bot/avatar.png` })
})

// Serve bot avatar image
app.get('/bot/avatar.png', (req, res) => {
  const store = storage._load()
  const artId = store.botAvatar
  if (!artId) return res.status(404).end()
  const art = storage.getArtifact(artId)
  if (!art) return res.status(404).end()
  res.sendFile(path.resolve(art.path))
})
