const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start')
  const stopBtn = document.getElementById('stop')
  const actionsList = document.getElementById('actions')
  const expectedTotal = document.getElementById('expectedTotal')
  const actualTotal = document.getElementById('actualTotal')

  startBtn.onclick = async () => {
    console.log('Start pressed (paper-trading)')
    try {
      await fetch('http://localhost:3000/start', { method: 'POST' })
      appendLog('Started paper-trading')
    } catch (e) {
      appendLog('Start error: ' + e.message)
    }
  }
  stopBtn.onclick = async () => {
    console.log('Stop pressed')
    try {
      await fetch('http://localhost:3000/stop', { method: 'POST' })
      appendLog('Stopped')
    } catch (e) {
      appendLog('Stop error: ' + e.message)
    }
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
        li.innerHTML = `<label><input type=checkbox data-id="${a.id}"> ${a.label} — expected: ${a.expectedGain}</label>`
        actionsList.appendChild(li)
        total += a.expectedGain
      })
      expectedTotal.innerText = total.toFixed(6)
    } catch (e) {
      appendLog('Failed to load actions: ' + e.message)
    }
  }

  loadActions()
})
