# Product Specification: Foodie Fortune (Cuisine Randomizer PWA)

## 1. Overview & Architecture
**Foodie Fortune** is a lightweight, mobile-first Progressive Web Application (PWA) designed to solve dinner decision fatigue for solo diners, couples, or small groups. It runs entirely client-side as a static bundle (`index.html`, `styles.css`, `app.js`, and `manifest.json`) engineered for zero-cost static hosting on **GitHub Pages**.

### Core Architecture Principles
* **Zero Backend / Serverless:** No external database, authentication, or paid API keys required.
* **Zero-Leak Privacy (Public Repo Safe):** Because the repository will be hosted publicly on GitHub Pages, the codebase must contain **zero hardcoded personal names, locations, coordinates, or local restaurants**. All personalization (player names, custom cuisines) is entered via the UI and saved strictly in the user's browser `localStorage`. All geo-discovery relies on dynamic device GPS via native app Universal Links.
* **Single-Device "Couch Mode" UX:** Designed to be operated on one primary smartphone passed between players.
* **Installable PWA:** Configured for "Add to Home Screen" on iOS (Safari) and Android (Chrome), launching in standalone full-screen mode without browser navigation bars.

---

## 2. Technical Stack & Deployment Targets
* **Hosting:** GitHub Pages (`https://<username>.github.io/<repo-name>/`). All asset paths must be relative (`./styles.css`, `./app.js`) so the app functions properly inside a subpath repository.
* **Runtime:** HTML5, CSS3 (CSS Variables, Flexbox/Grid), Vanilla JavaScript (ES6+). Zero build step required (optional: `canvas-confetti` via CDN for celebration effects).
* **Graphic Engine:** HTML5 `<canvas>` API for crisp, high-DPI (`window.devicePixelRatio`) wheel rendering and smooth 60fps deceleration physics.
* **Haptics:** `navigator.vibrate()` API integration for physical tactile ticks on supported Android devices (gracefully ignored on iOS).

---

## 3. Core Feature Specifications

### 3.1. First-Run & Party Setup Modal ("Who's Eating?")
* **Initialization Check:** On page load, check `localStorage.getItem('foodie_fortune_config')`.
  * If `savedPlayers` exists and is non-empty, load directly into the Main Wheel view and display the active party in the header (e.g., *"Dining Tonight: Player 1 & Player 2 [edit]"*).
  * If no config exists (first launch) or the user taps the `[edit Party]` button, open the **Party Setup Modal**.
* **Party Count Selector:** Quick-select segmented buttons for **1 (Solo)**, **2 (Couple)**, or **3+ (Group)** (up to 6 players).
* **Dynamic Name Inputs:** Render text inputs matching the selected player count.
  * Placeholders: `"Player 1 Name"`, `"Player 2 Name"`, etc.
* **Veto Rule Selector:** Toggle between `1 Veto per Player` (default) or `No Vetoes (Sudden Death)`.
* **Save & Start:** Tapping `[ Let's Eat ]` saves the player names and settings to `localStorage`, initializes the session state, and closes the modal.

### 3.2. Mode Toggle ("The Vibe Check")
A prominent segmented toggle at the top of the main view:
* **Takeaway (Default):**
  * Deep links query takeaway food.
  * Result Modal displays both **Google Maps** and **Uber Eats** action buttons.
* **Dine-In:**
  * Deep links query sit-down restaurants.
  * Result Modal displays **Google Maps only** (Uber Eats button is hidden).

### 3.3. Interactive Wheel & Physics Engine
* **High-DPI Canvas:** Scale canvas dimensions by `window.devicePixelRatio`.
* **Dynamic Slices:** Calculate slice arc angle dynamically (theta = 2*pi / N).
* **Color Palette:** Terracotta `#E07A5F`, Sage `#81B29A`, Mustard `#F2CC8F`, Deep Slate `#3D405B`, Coral `#F4A261`, Teal `#2A9D8F`. Adjacent slices never share the same color.
* **Spin Mechanics:** Tap main button or center hub. requestAnimationFrame loop; initial velocity 0.35-0.55 rad/frame; friction 0.985; stop below 0.002. Boundary tick at top pointer triggers haptic + pointer bounce.

### 3.4. Dynamic Multi-Player Veto System
* Status chips per player (Ready / Spent).
* Result Modal shows per-player veto buttons when enabled and unspent.
* Veto marks player spent, eliminates cuisine for the session, re-spins after 400ms.
* Lock-in / exhaustion: solo with no vetoes, all players spent, or 1 cuisine left -> hide vetoes, confetti, final banner.

### 3.5. Cuisine Customizer Modal
* Enable/disable cuisines, add custom, delete custom, restore defaults.

### 3.6. Deep Linking Engine
All cuisine strings sanitized via `encodeURIComponent()`. Links use `target="_blank" rel="noopener noreferrer"`.

| Action | Mode | URL |
| --- | --- | --- |
| Google Maps | takeaway | `https://www.google.com/maps/search/?api=1&query=${enc(cuisine + ' takeaway')}` |
| Google Maps | dine_in | `https://www.google.com/maps/search/?api=1&query=${enc(cuisine + ' restaurants near me')}` |
| Uber Eats | takeaway | `https://www.ubereats.com/search?q=${enc(cuisine)}` |
| Uber Eats | dine_in | Hidden |

---

## 4. Data Models

### 4.1 Default Cuisine Pool
Japanese, Italian, Thai, Korean, Mexican, Vietnamese, Burgers, Indian, Greek, Middle Eastern.

### 4.2 Persistent Storage (`localStorage` key `foodie_fortune_v1`)
partySize, savedPlayers, vetoesEnabled, lastMode, cuisines[].

### 4.3 In-Memory Session State
mode, isSpinning, currentRotation, winner, players[], eliminatedCuisineIds[].

---

## 6. PWA & Mobile Viewport
* Viewport meta with viewport-fit=cover, user-scalable=no.
* apple-mobile-web-app-capable, status-bar-style black-translucent, theme-color #FAF7F2.
* manifest.json: display standalone, orientation portrait, inline SVG/data-URI icons.
* body: overscroll-behavior-y none, touch-action manipulation.

---

## 7. Edge Cases & Acceptance Criteria
1. Fewer than 2 active cuisines -> disable Spin, prompt to enable at least 2.
2. Only 1 active cuisine after vetoes -> skip animation, auto-declare winner.
3. Haptics wrapped in try/catch helper.
4. Reset clears eliminatedCuisineIds and hasVetoed without wiping saved names/cuisines.
