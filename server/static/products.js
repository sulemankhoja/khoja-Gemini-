      const actions = document.createElement('div'); actions.className='actions'
      const btnActivate = document.createElement('button'); btnActivate.textContent = p.enabled? 'Deactivate':'Activate'
      btnActivate.onclick = async ()=>{
        const path = `/products/${p.id}/${p.enabled? 'deactivate':'activate'}`
        await api(path, { method:'POST' })
        loadProducts()
      }
      actions.appendChild(btnActivate)

+      const btnApprove = document.createElement('button'); btnApprove.textContent = p.approvedForActions? 'Approved for Actions':'Approve for Actions'
+      btnApprove.onclick = async ()=>{
+        const path = `/products/${p.id}/approve_actions`
+        await api(path, { method:'POST' })
+        loadProducts()
+      }
+      actions.appendChild(btnApprove)
+
+      const btnGen = document.createElement('button'); btnGen.textContent = 'Generate Actions'
+      btnGen.onclick = async ()=>{
+        const r = await api(`/products/${p.id}/generate-actions`, { method: 'POST' })
+        alert('Generated manifest: ' + (r.manifestId || JSON.stringify(r)))
+      }
+      actions.appendChild(btnGen)
+
