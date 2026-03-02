# Calendar View — Copilot Instructions

## Project Overview
Embeddable organization calendar (Squarespace-style) — React frontend, Node.js/Express backend.

## Completed Steps
- [x] copilot-instructions.md created in .github
- [x] Project requirements clarified
- [x] Project scaffolded: client/ (React) and server/ (Express)
- [x] README.md and .gitignore added
- [x] Squarespace-style CalendarView built (month grid, list view, event modal, embed code)
- [x] Server updated with rich sample event data
- [x] Project compiled and launched (client: 3000, server: 5050)
- [x] Documentation finalized

## Key Files
- `client/src/CalendarView.js` — main calendar component
- `client/src/CalendarView.css` — calendar styles
- `client/src/App.js` — app shell with data fetching and fallback events
- `client/src/App.css` — global layout styles
- `client/src/EmbedCode.js` — embed code panel with copy button
- `server/index.js` — Express API serving calendar events

## How to Run
```
npm run install:all   # install all dependencies once
npm start             # start both server (5050) and client (3000)
```

## Development Guidelines
- Keep communication concise and focused.
- Follow development best practices.
- Future: support multiple calendar themes by adding a `theme` prop to CalendarView and separate theme CSS files.

