# Calendar View

An embeddable calendar view for organizations, styled to match Squarespace's native calendar feature. Generates HTML embed code that can be placed on any website. Designed to support multiple calendar designs in the future.

## Features
- Month grid view with today highlighted
- List view toggle
- Prev/Next month navigation + "Today" button
- Color-coded event pills with title and time
- Click any event to open a detail modal (title, date, time, location, description, category)
- Responsive — works on desktop and mobile
- Embed code panel with one-click copy

## Tech Stack
- **Frontend:** React (create-react-app)
- **Backend:** Node.js / Express

## Getting Started

From the root folder, install all dependencies once:
```
npm run install:all
```

Then start both servers together:
```
npm start
```

Or run them separately:
```
# Terminal 1
npm start --prefix server   # http://localhost:5050

# Terminal 2
npm start --prefix client   # http://localhost:3000
```

## API
`GET /api/calendar` — returns the organization's events as JSON.

## Embed
Copy the embed code from the bottom of the calendar page and paste it into any website.

## Roadmap
- [ ] Multiple calendar themes / designs
- [ ] User and organizer theme selection
- [ ] Event creation and management UI
- [ ] Authentication for organizers
- [ ] iCal / Google Calendar sync

# calendar-view
