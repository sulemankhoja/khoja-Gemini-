// Approve endpoint now supports partial approvals (itemIds[])
app.post('/updates/approve', (req, res) => {
  const { manifestId, itemIds } = req.body || {}
  if (!manifestId) return res.status(400).json({ error: 'manifestId required' })
  const m = storage._load().manifests.find(x => x.id === manifestId)
  if (!m) return res.status(404).json({ error: 'manifest not found' })

  const actionsAll = (m.manifest && m.manifest.actions) || []
  let toPublish = actionsAll
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    toPublish = actionsAll.filter(a => itemIds.includes(a.id))
  }
  // create a new published manifest that contains only toPublish
  const signed = manifester.createManifest(toPublish)
  const pubRec = storage.addManifest(signed.manifest, signed.signature, 'published', m.category || 'partial')
  // update derived_actions statuses for published ones
  const s = storage._load()
  for (const a of toPublish) {
    const da = (s.derived_actions || []).find(x => x.id === a.id)
    if (da) da.status = 'published'
  }
  storage._save(s)
  // set active actions to include published ones (merge)
  const publishedActions = (s.derived_actions || []).filter(x => x.status === 'published')
  actions = publishedActions
  res.json({ ok: true, manifest: pubRec, activated: toPublish.length })
})
