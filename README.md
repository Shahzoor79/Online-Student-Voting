# 🗳️ VoteHub — Student Election Portal (PWA)

A full-featured **Progressive Web App** for student elections.  
Works **online AND offline**, installable as a native-like app on any device.

---

## 📁 File Structure

```
student-voting/
├── index.html      ← App shell & all pages
├── style.css       ← External stylesheet (dark civic aesthetic)
├── app.js          ← All JavaScript logic
├── sw.js           ← Service Worker (offline caching)
├── manifest.json   ← PWA manifest (install support)
└── README.md       ← This file
```

---

## 🚀 How to Run

### Option 1 — VS Code Live Server (Recommended)
1. Open the folder in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Visit `http://localhost:5500`

### Option 2 — Python local server
```bash
cd student-voting
python3 -m http.server 8080
# Open: http://localhost:8080
```

> ⚠️ **Must run via a local server** (not just double-click), as Service Workers require HTTPS or localhost.

---

## 🔑 Login

| Role        | Roll Number  | Notes                        |
|-------------|-------------|------------------------------|
| Student     | Any (e.g. `CS2024001`) | Regular voting access |
| Admin       | `ADMIN001`  | Access Admin panel           |

---

## ✨ Features

### Voting
- 3 pre-loaded elections (2 active, 1 closed)
- One vote per student per election (enforced)
- Vote confirmation modal with candidate cards
- Confetti animation on successful vote

### Results
- Live bar charts with vote counts & percentages
- Winner crown 👑 displayed for closed elections

### Offline Support
- Full app cached via Service Worker
- Votes queued while offline → auto-synced on reconnect
- Offline/Online toast notifications
- Network status dot in mobile header

### PWA / Installable App
- `manifest.json` enables **Add to Home Screen**
- Install banner shown automatically by browser
- Works on Android, iOS (Safari), Windows, macOS, Linux
- Standalone display mode (no browser chrome)

### Admin Panel (roll: ADMIN001)
- Create new elections with deadlines
- Add candidates to any election
- View participation statistics
- Reset all data

---

## 🛠 Tech Stack

| Layer       | Technology              |
|-------------|------------------------|
| Structure   | HTML5 (Semantic)        |
| Styling     | External CSS3 + Variables |
| Logic       | Vanilla ES6+ JavaScript |
| Persistence | localStorage            |
| Offline     | Service Worker API      |
| App Install | Web App Manifest        |
| Fonts       | Google Fonts (Syne + DM Sans) |

---

## 📱 Install as App

**Android (Chrome):** Tap ⋮ menu → "Add to Home Screen"  
**iOS (Safari):** Tap Share → "Add to Home Screen"  
**Desktop (Chrome/Edge):** Click install icon in address bar, or use banner

---

## 🔐 Data Storage

All data is stored in **localStorage** under the key `votehub_db`.  
Open DevTools → Application → Local Storage to inspect.

---

*Built with ♥ using pure HTML, CSS & JavaScript — no frameworks required.*
