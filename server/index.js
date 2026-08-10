app.post('/products/:id/activate', (req, res) => {
  const id = req.params.id
  const p = products.activateProduct(id)
  if (!p) return res.status(404).json({ error: 'product not found' })
  res.json({ ok: true, product: p })
})

+// Approve product for action generation (staged)
+app.post('/products/:id/approve_actions', (req, res) => {
+  const id = req.params.id
+  const p = products.approveForActions(id)
+  if (!p) return res.status(404).json({ error: 'product not found' })
+  res.json({ ok: true, product: p })
+})
+
+// Generate derived actions for a product and create a pending manifest
+app.post('/products/:id/generate-actions', async (req, res) => {
+  const id = req.params.id
+  const p = products.getProduct(id)
+  if (!p) return res.status(404).json({ error: 'product not found' })
+  if (!p.approvedForActions) return res.status(409).json({ error: 'product not approved for actions' })
+  try {
+    const derived = products.createDerivedActionsForProduct(id)
+    const signed = manifester.createManifest(derived)
+    const rec = storage.addManifest(signed.manifest, signed.signature, 'pending', `product:${id}`)
+    storage.addDerivedActions(signed.manifest.actions, rec.id)
+    res.json({ ok: true, manifestId: rec.id, actionsCount: signed.manifest.actions.length })
+  } catch (e) {
+    res.status(500).json({ error: e.message })
+  }
+})
+
