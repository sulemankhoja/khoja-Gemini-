async function api(path, opts) {
  const r = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts))
  return r.json()
}

function el(tag, text) { const e = document.createElement(tag); if (text) e.textContent = text; return e }

async function loadProducts() {
  const list = document.getElementById('list')
  list.innerHTML = 'Loading...'
  try {
    const prods = await api('/products')
    list.innerHTML = ''
    for (const p of prods) {
      const d = document.createElement('div'); d.className='product'
      const title = document.createElement('h3'); title.textContent = p.name + (p.enabled? ' (enabled)':'')
      d.appendChild(title)
      const desc = el('div', p.desc || p.description || '')
      d.appendChild(desc)
      const links = document.createElement('div')
      links.innerHTML = `<a href='${p.docsUrl || '#'}' target='_blank'>Docs</a> | <a href='${p.signupUrl || '#'}' target='_blank'>Signup</a>`
      d.appendChild(links)

      const actions = document.createElement('div'); actions.className='actions'
      const btnActivate = document.createElement('button'); btnActivate.textContent = p.enabled? 'Deactivate':'Activate'
      btnActivate.onclick = async ()=>{
        const path = `/products/${p.id}/${p.enabled? 'deactivate':'activate'}`
        await api(path, { method:'POST' })
        loadProducts()
      }
      actions.appendChild(btnActivate)

      const credBtn = document.createElement('button'); credBtn.textContent = 'Add Credential (enc)'
      credBtn.onclick = ()=> showAddCred(p.id)
      actions.appendChild(credBtn)

      const listCredsBtn = document.createElement('button'); listCredsBtn.textContent = 'List Credentials'
      listCredsBtn.onclick = ()=> showCreds(p.id)
      actions.appendChild(listCredsBtn)

      d.appendChild(actions)
      list.appendChild(d)
    }
  } catch (e) {
    list.innerHTML = 'Failed to load products: '+e.message
  }
}

function showAddCred(productId) {
  const modal = document.createElement('div')
  modal.style.position='fixed'; modal.style.left='20%'; modal.style.top='10%'; modal.style.right='20%'; modal.style.background='#fff'; modal.style.border='1px solid #ccc'; modal.style.padding='12px'
  modal.innerHTML = `<h3>Add Credential for ${productId}</h3>
    <div>Label: <input id='credLabel' type='text' /></div>
    <div>Encrypted blob (paste):<br/><textarea id='credBlob'></textarea></div>
    <div style='margin-top:8px'><button id='save'>Save</button> <button id='close'>Cancel</button></div>
    <div id='msg'></div>`
  document.body.appendChild(modal)
  modal.querySelector('#close').onclick = ()=>{ document.body.removeChild(modal) }
  modal.querySelector('#save').onclick = async ()=>{
    const label = modal.querySelector('#credLabel').value
    const enc = modal.querySelector('#credBlob').value
    if (!label || !enc) return modal.querySelector('#msg').innerHTML = '<span class="error">label and encBlob required</span>'
    const res = await api(`/products/${productId}/credentials`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label, encBlob: enc }) })
    if (res.ok) modal.querySelector('#msg').innerHTML = '<span class="success">Saved</span>'
    else modal.querySelector('#msg').innerHTML = '<span class="error">'+(res.error||'failed')+'</span>'
  }
}

async function showCreds(productId) {
  const creds = await api(`/products/${productId}/credentials`)
  const modal = document.createElement('div')
  modal.style.position='fixed'; modal.style.left='20%'; modal.style.top='10%'; modal.style.right='20%'; modal.style.background='#fff'; modal.style.border='1px solid #ccc'; modal.style.padding='12px; max-height:70vh; overflow:auto'
  modal.innerHTML = `<h3>Credentials for ${productId}</h3><div id='listcreds'></div><div style='margin-top:8px'><button id='close'>Close</button></div>`
  document.body.appendChild(modal)
  modal.querySelector('#close').onclick = ()=>{ document.body.removeChild(modal) }
  const list = modal.querySelector('#listcreds')
  list.innerHTML = ''
  if (!creds || creds.length===0) list.innerHTML = '<i>No credentials</i>'
  for (const c of creds) {
    const row = document.createElement('div')
    row.innerHTML = `<b>${c.label}</b> (id: ${c.id}) <button data-id='${c.id}'>Test</button> <button data-id='${c.id}' class='del'>Delete</button>`
    list.appendChild(row)
  }
  list.querySelectorAll('button').forEach(btn=>{
    btn.onclick = async (ev)=>{
      const id = btn.getAttribute('data-id')
      if (btn.classList.contains('del')) {
        await api(`/products/${productId}/credentials/${id}`, { method: 'DELETE' })
        showCreds(productId)
        return
      }
      // test
      const enc = prompt('Paste encrypted blob for test (we store it already, but demo adapter expects blob):')
      if (!enc) return alert('enc blob required for demo test')
      const r = await api(`/products/${productId}/credentials/test`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ encBlob: enc }) })
      alert(JSON.stringify(r))
    }
  })
}

loadProducts()
