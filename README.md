# Khoja Bot

Prototype scaffold for "khoja bot" — Electron overlay (Windows/Linux), React Native Android skeleton, and Node.js server with crawler and paper-trade engine. Paper-trading only by default.  

Security & safety
- Paper-trading is the default. Live trading adapters are disabled and require explicit opt-in.  
- API keys are stored locally in encrypted storage (not committed).  
- Crawling respects robots.txt and sites' TOS by default.  

Quickstart (development)
1. Server
   - cd server && npm install
   - cp .env.example .env and edit as needed
   - npm run dev

2. Electron overlay
   - cd electron-overlay && npm install
   - npm run dev

3. Android (React Native)
   - cd mobile-android && npm install
   - follow React Native docs to run on device/emulator

What I pushed
- electron-overlay/: Electron overlay UI (Start/Stop, actions list)  
- mobile-android/: React Native Android skeleton  
- server/: Node.js server with crawler & paper-trade stubs  
- shared/: strategy and math utilities  

Next steps
- Configure crawler seed list in server/config or via UI.  
- Add exchange API keys locally and enable live adapters when ready.  

