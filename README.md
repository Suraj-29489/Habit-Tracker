# 🔥 Habit & Daily Streak Tracker

A clean, dark-mode, mobile-optimized web application for daily streak counting, habit tracking, and calendar scheduling with local storage persistence and PWA support.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

---

## ✨ Features

- 📅 **Interactive Calendar**: Full month view with smooth navigation, today highlights, and active streak badges (`Day 1`, `Day 2`, etc.).
- 🎯 **Custom Tracker Creation**: Set custom topic names, start dates, and durations (10 Days, 20 Days, 30 Days, 90 Days, Custom Days, or Ongoing Streaks).
- ☑️ **Customizable Daily Checklists**: Add or remove custom daily tasks per tracker (e.g. *Stayed Clean*, *Cold Shower*, *10 min Meditation*, *Read 20 pages*).
- 📱 **Mobile & Desktop Optimized**: Responsive layout with touch-friendly controls, mobile bottom sheets, and PWA "Add to Home Screen" support.
- 💾 **Local Storage & Offline-Ready**: Everything is stored in browser / internal device memory with JSON Backup Export / Import tools.
- 🔔 **Daily Reminders**: Web Notification API support to prompt daily check-ins at your preferred time.
- 🌙 **Modern Dark Theme**: Sleek slate and midnight UI with smooth animations and zero messy dependencies.

---

## 🚀 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone git@github.com:Suraj-29489/Habit-Tracker.git
   cd Habit-Tracker
   ```

2. **Run local server**:
   Using Python:
   ```bash
   python3 -m http.server 8080
   ```
   Or using Node / npx:
   ```bash
   npx serve .
   ```

3. **Open in browser**:
   Navigate to `http://localhost:8080` (or double-click `index.html` to open directly).

---

## 📱 Mobile App (PWA) Setup

1. Open the website on your mobile browser (Safari on iOS or Chrome on Android).
2. Tap **Share** (iOS) or the **Menu dots** (Android).
3. Tap **"Add to Home Screen"**.
4. Enjoy a fast, full-screen standalone app experience!

---

## 📁 Project Structure

```
Habit-Tracker/
├── index.html              # Main responsive layout & modals
├── manifest.json           # PWA web app manifest
├── sw.js                   # Service worker for caching & notifications
├── .gitignore              # Ignored files
├── README.md               # Documentation
├── assets/
│   └── icon.svg            # SVG App Icon & Favicon
├── css/
│   └── style.css           # Responsive dark-theme stylesheet
└── js/
    ├── app.js              # Application coordinator & modal handlers
    ├── calendar.js         # Calendar math, streak calculation & month rendering
    ├── storage.js          # LocalStorage CRUD & backup management
    └── notifications.js    # Web Notification API scheduler
```

---

## 📄 License
MIT License

