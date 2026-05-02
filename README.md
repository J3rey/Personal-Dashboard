# Personal Dashboard

A personal productivity dashboard built with Vite + React, ported from a single-file HTML prototype.

## Features

- **Calendar** — Month, week, and day views with event management and an upcoming events sidebar
- **Finance** — Expense and income tracking with category/month filters, donut and stacked bar charts, and a currency converter
- **Habits** — Weekly habit tracker supporting both weekly-goal and daily-tracking types, with a progress bar sidebar
- **Content** — Content idea pipeline with pillar management, status workflow (Idea → Scripted → Filmed → Edited → Posted), and archiving

## Tech Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/) — finance charts
- Deployed on [Vercel](https://vercel.com/)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/
├── main.jsx
├── App.jsx              # Tab state and active panel routing
├── constants/
│   └── index.js         # PILLAR_COLORS, CAT_COLORS, CATS, RATES
├── state/
│   └── defaultState.js  # Initial state with sample data
├── tabs/
│   ├── Calendar.jsx
│   ├── Finance.jsx
│   ├── Habits.jsx
│   └── Content.jsx
├── components/
│   └── Nav.jsx
└── index.css
```

## State Management

A single `useState` object lives in `App.jsx` and is passed as `state` + `setState` props to each tab. Local UI state (filters, view mode, form fields) lives within each tab component.

## Build & Deploy

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

Vercel auto-detects Vite on push to the connected GitHub repo.
