# 🔐 Digital Lock — GitHub Pages Site

**Live Demo:** [your-username.github.io/digital-lock-page](https://your-username.github.io/digital-lock-page)

A stunning, interactive cyberpunk-themed digital combination lock built with pure HTML, CSS & JavaScript. No frameworks, no dependencies — just open and run.

---

## ✨ Features

- 🎨 **Cyberpunk / HUD aesthetic** — neon cyan, dark mode, scanlines, particle network
- 🔢 **4-dial combination lock** — click ▲▼, scroll wheel, touch swipe, or keyboard arrows
- 🔊 **Web Audio sound effects** — tactile click, success chime, error buzz
- ⌨️ **Full keyboard support** — Arrow keys to navigate dials, Enter to unlock
- 📱 **Mobile responsive** — touch swipe on dials
- 🔒 **Lockout system** — 5 attempts, then 60-second cooldown
- ⚡ **Animated particle background** — connected node network
- 🏆 **Access Granted screen** with vault stats overlay

## 🗝️ The Code

> **Hint:** The year the World Wide Web was born — **1991**

Spin the dials to `1 - 9 - 9 - 1` and press **UNLOCK**.

---

## 🚀 Deploy to GitHub Pages

### Step 1: Create a GitHub repository

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `digital-lock-page` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

### Step 2: Push the files

```bash
cd digital-lock-page
git init
git add .
git commit -m "🔐 Initial commit: Digital Lock page"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/digital-lock-page.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Source**, select `Deploy from a branch`
3. Branch: `main`, Folder: `/ (root)`
4. Click **Save**

Your site will be live at:
```
https://YOUR_USERNAME.github.io/digital-lock-page/
```
(Takes 1–2 minutes to deploy)

---

## 📁 File Structure

```
digital-lock-page/
├── index.html    # Main HTML structure
├── style.css     # Cyberpunk styling & animations
├── app.js        # Lock logic, particles, audio
└── README.md     # This file
```

---

## 🛠️ Customize

| What | Where | Default |
|------|-------|---------|
| Secret code | `app.js` line 4 | `[1, 9, 9, 1]` |
| Max attempts | `app.js` line 5 | `5` |
| Lockout duration | `app.js` line 6 | `60` seconds |
| Hint text | `index.html` `#hintText` | "year of internet's birth" |
| Colors | `style.css` `:root` variables | Cyan / Gold / Green |
