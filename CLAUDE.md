# Personal Dashboard

A personal productivity dashboard ported from a single-file HTML prototype into a Vite + React app.

## Tech Stack
- **Vite + React** — `npm create vite@latest dashboard -- --template react`
- **chart.js + react-chartjs-2** — finance charts (donut + stacked bar)
- **Deploy** — Vercel (connect GitHub repo, auto-detects Vite)

## Project Structure
```
src/
├── main.jsx
├── App.jsx                  # tab state, active panel routing
├── constants/
│   └── index.js             # PILLAR_COLORS, CAT_COLORS, CATS, RATES
├── state/
│   └── defaultState.js      # initial state object (sample data)
├── tabs/
│   ├── Calendar.jsx
│   ├── Finance.jsx
│   ├── Habits.jsx
│   └── Content.jsx
├── components/
│   └── Nav.jsx
└── index.css                # all CSS from the original HTML prototype
```

## State
Single `useState` object in `App.jsx`, passed down as `state` + `setState` props to each tab. Local UI state (filters, view mode, form fields) lives in each tab component.

## ID Generation
Module-level counter (`let _nextId = 200; const uid = () => _nextId++`) in each tab that needs it. Resets on page reload — acceptable for in-memory state.

## Development
```bash
npm install
npm run dev
```

## Features
- **Calendar** — month/week/day views, add/delete events, upcoming events sidebar
- **Finance** — expense tracking, income, category + month filters, donut + stacked bar charts, currency converter, event headers/grouping
- **Habits** — weekly habit tracker, weekly-goal vs daily-tracking types, progress bar sidebar
- **Content** — content idea pipeline, pillar management with colours, status workflow (Idea → Scripted → Filmed → Edited → Posted), collapse archived posts

## Notes
- Date strings use `toISOString().split('T')[0]` — same as original prototype. Timezone offset edge cases are acceptable for a personal app.
- Expense/income cell editing uses `prompt()` — faithful to the original prototype.
- Chart.js components are registered once at module level in `Finance.jsx`.
