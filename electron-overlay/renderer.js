const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start')
  const stopBtn = document.getElementById('stop')
  const installBtn = document.getElementById('install')
  const applyBtn = document.getElementById('apply')
  const actionsList = document.getElementById('actions')
  const expectedTotal = document.getElementById('expectedTotal')
  const actualTotal = document.getElementById('actualTotal')

  startBtn.onclick = async () => {
    try {
      await fetch('http://localhost:3000/start', { method: 'POST' })
      appendLog('Started paper-trading')
    } catch (e) { appendLog('Start error: ' + e.message) }
  }
  stopBtn.onclick = async () => {
    try {
      await fetch('http://localhost:3000/stop', { method: 'POST' })
      appendLog('Stopped')
    } catch (e) { appendLog('Stop error: ' + e.message) }
  }

  installBtn.onclick = async () => {
    try {
      const r = await fetch('http://localhost:3000/install-updates', { method: 'POST' })
      const j = await r.json()
      appendLog('Install updates: ' + JSON.stringify(j))
      loadActions()
    } catch (e) { appendLog('Install updates error: ' + e.message) }
  }

  applyBtn.onclick = async () => {
    try {
      const checked = Array.from(document.querySelectorAll('#actions input[type=checkbox]:checked')).map(i=>i.dataset.id)
      const r = await fetch('http://localhost:3000/apply', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ids: checked }) })
      const j = await r.json()
      appendLog('Applied actions: ' + JSON.stringify(j))
      updateStats()
      loadActions()
    } catch (e) { appendLog('Apply error: ' + e.message) }
  }

  function appendLog(msg) {
    const logs = document.getElementById('logs')
    logs.innerText = `${new Date().toISOString()} - ${msg}\n` + logs.innerText
  }

  async function loadActions() {
    try {
      const r = await fetch('http://localhost:3000/actions')
      const actions = await r.json()
      actionsList.innerHTML = ''
      let total = 0
      actions.forEach(a => {
        const li = document.createElement('li')
        li.className = 'action-row'
        li.innerHTML = `<label><input type=checkbox data-id="${a.id}"> ${a.label}</label><div>pred: ${a.predictedGain?.toFixed(6)||'-'} | conf: ${a.confidence?.toFixed(2)||'-'} | act: ${a.actualGain?.toFixed(6)||'-'}</div>`
        actionsList.appendChild(li)
        total += (a.predictedGain||0)
      })
      expectedTotal.innerText = total.toFixed(6)
      updateStats()
    } catch (e) { appendLog('Failed to load actions: ' + e.message) }
  }

  async function updateStats() {
    try {
      const r = await fetch('http://localhost:3000/stats')
      const s = await r.json()
      document.getElementById('tradesCount').innerText = s.tradesCount
      document.getElementById('netPL').innerText = s.netPnl?.toFixed(6)||'-'
      document.getElementById('winRate').innerText = (s.winRate*100).toFixed(1)+'%'
      document.getElementById('avgGain').innerText = s.avgWin?.toFixed(6)||'-'
      document.getElementById('maxDd').innerText = s.maxDrawdown?.toFixed(6)||'-'
      actualTotal.innerText = s.netPnl?.toFixed(6)||'-'
    } catch (e) { appendLog('Stats error: ' + e.message) }
  }

  loadActions()
  setInterval(loadActions, 30*1000) // refresh every 30s
})
