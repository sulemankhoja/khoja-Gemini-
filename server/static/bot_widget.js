// Overlay bot widget: bottom-right avatar with input and preview/approve flow
(function(){
  const css = document.createElement('style')
  css.innerHTML = `
  .khoja-bot { position: fixed; right: 20px; bottom: 20px; z-index: 9999; }
  .khoja-bot .bubble { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg,#8b0000,#b22222); box-shadow:0 4px 12px rgba(0,0,0,0.3); cursor:pointer; display:flex; align-items:center; justify-content:center; color:gold; font-weight:bold }
  .khoja-bot .panel { position:fixed; right:100px; bottom:30px; width:420px; max-width:90vw; background:#fff; border:1px solid #ddd; box-shadow:0 8px 24px rgba(0,0,0,0.2); padding:12px; border-radius:8px; display:none }
  .khoja-bot textarea { width:100%; height:80px }
  .khoja-bot .preview { border:1px solid #eee; padding:8px; margin-top:8px; max-height:240px; overflow:auto }
  .khoja-bot .actions { margin-top:8px; text-align:right }
  `
  document.head.appendChild(css)

  const root = document.createElement('div'); root.className='khoja-bot'
  const bubble = document.createElement('div'); bubble.className='bubble'; bubble.innerText='K'
  const panel = document.createElement('div'); panel.className='panel'
  panel.innerHTML = `<div style="font-weight:bold">Khoja Bot</div><div style="font-size:12px;color:#666">Make changes, preview and approve</div><div style='margin-top:8px'><textarea id='k_cmd' placeholder='Describe change: e.g. create product "Meta Trader" with design red-gold and connect to Coinbase/Binance'></textarea></div><div style='display:flex;gap:8px;align-items:center;margin-top:8px'><input id='k_file' type='file' /><label style='font-size:12px;color:#666'>Attach design image (optional)</label></div><div class='preview' id='k_preview'>No preview yet</div><div class='actions'><button id='k_preview_btn'>Preview</button><button id='k_apply_btn'>Apply</button><button id='k_close'>Close</button></div>`
  root.appendChild(bubble)
  root.appendChild(panel)
  document.body.appendChild(root)

  bubble.onclick = ()=>{ panel.style.display = panel.style.display==='none' ? 'block' : 'none' }
  document.getElementById('k_close').onclick = ()=> panel.style.display='none'

  async function encodeFileAsBase64(file) {
    return new Promise((resolve, reject)=>{
      const fr = new FileReader()
      fr.onload = ()=> resolve(fr.result.split(',')[1])
      fr.onerror = reject
      fr.readAsDataURL(file)
    })
  }

  document.getElementById('k_preview_btn').onclick = async ()=>{
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
    const spec = { type: 'create_product', raw: cmd }
    if (fileBase64) {
      spec.type = 'upload_file'
      spec.filename = filename
      spec.contentBase64 = fileBase64
      spec.mime = mime
    }
    const r = await fetch('/bot/preview-change', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec) })
    const j = await r.json()
    const preview = document.getElementById('k_preview')
    if (j.ok) {
      preview.innerHTML = `<div style='font-size:13px'>Estimate: ${j.estimate.estTimeMinutes}m, cost $${j.estimate.estCostUSD}</div><div style='margin-top:8px'>${j.previewHtml}</div>`
    } else preview.innerText = 'Preview failed: '+(j.error||'')
  }

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
      spec = { type: 'upload_file', filename, contentBase64: fileBase64, mime, sourceUrl: null }
    } else {
      // try to parse a create product command
      // naive parsing: look for "create product \"NAME\"" pattern
      const m = cmd.match(/create product \"([^\"]+)\"/i)
      const name = m ? m[1] : (cmd.split('\n')[0] || 'Untitled Product')
      spec = { type: 'create_product', name, description: cmd }
    }
    const r = await fetch('/bot/apply-change', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec) })
    const j = await r.json()
    if (j.ok) {
      alert('Applied: ' + (j.product? j.product.id : (j.artifact? j.artifact.id : JSON.stringify(j))))
      panel.style.display='none'
      // refresh UI if products list present
      if (window.loadProducts) loadProducts()
    } else {
      alert('Apply failed: ' + (j.error||''))
    }
  }
})();
