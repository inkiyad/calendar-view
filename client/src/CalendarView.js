import React, { useState } from 'react';
import './CalendarView.css';

// ────────────────────────────────────────────────────────────────
// MAS-Queens-inspired editorial calendar
//  All screen sizes — always 7-column grid (no stacked list)
//  Desktop (≥900px)  – full cells, images + event text
//  Tablet  (600-899) – same grid, compact
//  Mobile  (<600px)  – narrow cells, day number only + dot indicator
//  Dark mode         – driven by `darkMode` prop
// ────────────────────────────────────────────────────────────────

const DAY_HEADERS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function CalendarView({ events = [], darkMode = false }) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(null); // { date, events[] }

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build grid cells
  const cells = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (firstDayOfMonth + daysInMonth) + 1, current: false });
  }

  function makeDateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function getEvents(cell) {
    if (!cell.current) return [];
    return events.filter(e => e.date === makeDateStr(cell.day));
  }

  function isToday(cell) {
    return (
      cell.current &&
      cell.day  === today.getDate() &&
      month     === today.getMonth() &&
      year      === today.getFullYear()
    );
  }

  function fmtModalDate(ds) {
    return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday   = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className={`cal${darkMode ? ' cal--dark' : ''}`}>

      {/* ── Top bar ─────────────────────────────────────────────*/}
      <div className="cal__topbar">
        <div className="cal__topbar-left">
          <button className="cal__nav-btn" onClick={prevMonth} aria-label="Previous month">&#8249;</button>
        </div>
        <h2 className="cal__month-label">{MONTHS[month]} {year}</h2>
        <div className="cal__topbar-right">
          <button className="cal__nav-btn" onClick={nextMonth} aria-label="Next month">&#8250;</button>
          <button className="cal__today-btn" onClick={goToday}>Today</button>
        </div>
      </div>

      {/* ── Column headers ──────────────────────────────────────*/}
      <div className="cal-col-headers">
        {DAY_HEADERS.map(d => <div key={d} className="cal-col-header">{d}</div>)}
      </div>

      {/* ── Grid ────────────────────────────────────────────────*/}
      <div className="cal-grid">
        {cells.map((cell, idx) => {
          const cellEvents = getEvents(cell);
          const featuredImg = cellEvents.find(e => e.image)?.image || null;
          const hasEvents   = cell.current && cellEvents.length > 0;

          return (
            <div
              key={idx}
              className={[
                'cal-cell',
                !cell.current ? 'cal-cell--other'     : '',
                isToday(cell) ? 'cal-cell--today'     : '',
                featuredImg   ? 'cal-cell--has-img'   : '',
                hasEvents     ? 'cal-cell--has-events': '',
              ].filter(Boolean).join(' ')}
              onClick={() => hasEvents && setSelectedDay({ date: makeDateStr(cell.day), events: cellEvents })}
              role={hasEvents ? 'button' : undefined}
              tabIndex={hasEvents ? 0 : undefined}
              onKeyDown={hasEvents ? (e) => e.key === 'Enter' && setSelectedDay({ date: makeDateStr(cell.day), events: cellEvents }) : undefined}
            >
              {/* Image fills cell as absolute layer */}
              {featuredImg && cell.current && (
                <div
                  className="cal-cell__img"
                  style={{ backgroundImage: `url(${featuredImg})` }}
                  aria-hidden="true"
                />
              )}

              {/* Content layer — above image via z-index */}
              <div className="cal-cell__content">
                <span className="cal-cell__day">{cell.day}</span>

                {/* Event titles — hidden on mobile, dot shown instead */}
                {cell.current && cellEvents.length > 0 && (
                  <div className="cal-cell__events">
                    {cellEvents.slice(0, 2).map((ev, i) => (
                      <span key={i} className="cal-event__title">{ev.title}</span>
                    ))}
                    {cellEvents.length > 2 && (
                      <span className="cal-cell__more">+{cellEvents.length - 2} more</span>
                    )}
                  </div>
                )}

                {/* Mobile dot */}
                {cell.current && cellEvents.length > 0 && (
                  <span
                    className="cal-cell__dot"
                    title={cellEvents.map(e => e.title).join(', ')}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Day detail modal ──────────────────────────────────*/}
      {selectedDay && (
        <div
          className="cal-modal__overlay"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className={`cal-modal${darkMode ? ' cal-modal--dark' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="cal-modal__close"
              onClick={() => setSelectedDay(null)}
              aria-label="Close"
            >&#x2715;</button>

            <div className="cal-modal__header">
              <p className="cal-modal__date">{fmtModalDate(selectedDay.date)}</p>
              <h3 className="cal-modal__title">
                {selectedDay.events.length === 1
                  ? selectedDay.events[0].title
                  : `${selectedDay.events.length} Events`}
              </h3>
            </div>

            <div className="cal-modal__events">
              {selectedDay.events.map((ev, i) => (
                <div key={i} className="cal-modal__event">
                  {ev.image && (
                    <div
                      className="cal-modal__event-img"
                      style={{ backgroundImage: `url(${ev.image})` }}
                    />
                  )}
                  <div className="cal-modal__event-body">
                    {selectedDay.events.length > 1 && (
                      <h4 className="cal-modal__event-title">{ev.title}</h4>
                    )}
                    <div className="cal-modal__rows">
                      {ev.time && (
                        <div className="cal-modal__row">
                          <span className="cal-modal__label">Time</span>
                          <span className="cal-modal__value">{ev.time}</span>
                        </div>
                      )}
                      {ev.location && (
                        <div className="cal-modal__row">
                          <span className="cal-modal__label">Location</span>
                          <span className="cal-modal__value">{ev.location}</span>
                        </div>
                      )}
                      {ev.category && (
                        <div className="cal-modal__row">
                          <span className="cal-modal__label">Category</span>
                          <span className="cal-modal__value">{ev.category}</span>
                        </div>
                      )}
                    </div>
                    {ev.description && (
                      <p className="cal-modal__desc">{ev.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarView;

