  document.getElementById('k_apply_btn').onclick = async ()=>{
    const cmd = document.getElementById('k_cmd').value
    const f = document.getElementById('k_file').files[0]
    let fileBase64 = null
    let filename = null
    let mime = null
    if (f) {
      fileBase64 = await encodeFileAsBase64(f)
      filename = f.name
      mime = f.type
    }
    let spec
    if (fileBase64) {
-      spec = { type: 'upload_file', filename, contentBase64: fileBase64, mime, sourceUrl: null }
+      const setAvatar = document.getElementById('k_use_avatar') && document.getElementById('k_use_avatar').checked
+      spec = { type: 'upload_file', filename, contentBase64: fileBase64, mime, sourceUrl: null, setAsAvatar: setAvatar }
    } else {
@@
    const j = await r.json()
    if (j.ok) {
      alert('Applied: ' + (j.product? j.product.id : (j.artifact? j.artifact.id : JSON.stringify(j))))
      panel.style.display='none'
      // refresh UI if products list present
      if (window.loadProducts) loadProducts()
+      // if avatar was set, update bubble background
+      if (j.artifact && j.artifact.id && j.artifact.id.startsWith('art_')) {
+        try {
+          const aresp = await fetch('/bot/avatar')
+          const aj = await aresp.json()
+          if (aj && aj.url) {
+            bubble.style.backgroundImage = `url(${aj.url})`
+            bubble.style.backgroundSize = 'cover'
+            bubble.innerText = ''
+          }
+        } catch (e) {}
+      }
    } else {
      alert('Apply failed: ' + (j.error||''))
    }
  }
})();
