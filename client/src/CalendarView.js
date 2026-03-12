import React, { useEffect, useRef, useState } from 'react';
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
  const [hoveredDay,  setHoveredDay]  = useState(null); // { events, rect }
  const [lightboxImg, setLightboxImg] = useState(null); // url string
  const [useHijri,    setUseHijri]    = useState(false);
  const [hijriMap,    setHijriMap]    = useState({});
  const [hijriMonthLabel, setHijriMonthLabel] = useState('');
  const [hijriLoading, setHijriLoading] = useState(false);
  const hijriCacheRef = useRef({});

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

  useEffect(() => {
    if (!useHijri) return;
    const cacheKey = `${year}-${month + 1}`;
    const cached = hijriCacheRef.current[cacheKey];
    if (cached) {
      setHijriMap(cached.map);
      setHijriMonthLabel(cached.label);
      return;
    }

    const fetchHijri = async () => {
      setHijriLoading(true);
      try {
        const res = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${month + 1}/${year}`);
        const data = await res.json();
        const days = data?.data || [];

        const map = {};
        days.forEach((d) => {
          const gDate = d?.gregorian?.date; // DD-MM-YYYY
          const h = d?.hijri;
          if (!gDate || !h) return;
          const [dd, mm, yyyy] = gDate.split('-');
          const iso = `${yyyy}-${mm}-${dd}`;
          map[iso] = {
            day: h.day,
            month: h.month?.en,
            year: h.year,
          };
        });

        const mid = days[Math.floor(days.length / 2)]?.hijri;
        const label = mid ? `${mid.month?.en} ${mid.year}` : '';
        hijriCacheRef.current[cacheKey] = { map, label };
        setHijriMap(map);
        setHijriMonthLabel(label);
      } catch (err) {
        console.error('[hijri] fetch failed', err);
      } finally {
        setHijriLoading(false);
      }
    };

    fetchHijri();
  }, [month, year, useHijri]);

  const monthLabel = useHijri && hijriMonthLabel
    ? hijriMonthLabel
    : `${MONTHS[month]} ${year}`;
  const monthSubLabel = useHijri && hijriMonthLabel ? `${MONTHS[month]} ${year}` : '';

  return (
    <div className={`cal${darkMode ? ' cal--dark' : ''}`}>

      {/* ── Top bar ─────────────────────────────────────────────*/}
      <div className="cal__topbar">
        <button className="cal__nav-btn" onClick={prevMonth} aria-label="Previous month">&#8249;</button>
        <h2 className="cal__month-label">
          <span className="cal__month-main">{monthLabel}</span>
          {monthSubLabel && <span className="cal__month-sub">{monthSubLabel}</span>}
        </h2>
        <button className="cal__nav-btn" onClick={nextMonth} aria-label="Next month">&#8250;</button>
      </div>
      <div className="cal__topbar-actions">
        <div className="cal__actions-center">
          <button
            className={`cal__toggle-btn${useHijri ? ' cal__toggle-btn--active' : ''}`}
            onClick={() => setUseHijri(v => !v)}
            disabled={hijriLoading}
          >
            {hijriLoading ? 'Loading…' : 'Hijri'}
          </button>
        </div>
        <div className="cal__actions-right">
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
          const featuredImg = cellEvents.find(e => e.image_url)?.image_url || null;
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
              onMouseEnter={(e) => {
                if (!hasEvents) return;
                setHoveredDay({ events: cellEvents, rect: e.currentTarget.getBoundingClientRect() });
              }}
              onMouseLeave={() => setHoveredDay(null)}
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
                {(() => {
                  const iso = makeDateStr(cell.day);
                  const h = useHijri && hijriMap[iso];
                  return (
                    <>
                      <span className="cal-cell__day">{h ? h.day : cell.day}</span>
                      {h && <span className="cal-cell__day-greg">{cell.day}</span>}
                    </>
                  );
                })()}

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

      {/* ── Day hover card ──────────────────────────────────*/}
      {hoveredDay && (() => {
        const { rect, events } = hoveredDay;
        const CARD_H  = 32 + events.length * 52;
        const showAbove = rect.bottom + CARD_H + 8 > window.innerHeight;
        const leftPos   = Math.max(8, Math.min(rect.left, window.innerWidth - 216));
        return (
          <div
            className={`cal-hover-card${darkMode ? ' cal-hover-card--dark' : ''}`}
            style={{
              top:      showAbove ? rect.top - CARD_H - 8 : rect.bottom + 6,
              left:     leftPos,
              minWidth: Math.max(rect.width, 200),
            }}
          >
            {events.map((ev, i) => (
              <div key={i} className="cal-hover-card__event">
                {ev.image_url && (
                  <div className="cal-hover-card__img" style={{ backgroundImage: `url(${ev.image_url})` }} />
                )}
                <div className="cal-hover-card__info">
                  <span className="cal-hover-card__title">{ev.title}</span>
                  {(ev.time || ev.location) && (
                    <span className="cal-hover-card__meta">
                      {ev.time}{ev.time && ev.location ? ' · ' : ''}{ev.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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
                  {ev.image_url && (
                    <div className="cal-modal__event-img-container">
                      <img
                        className="cal-modal__event-img"
                        src={ev.image_url}
                        alt={ev.title}
                        onClick={() => setLightboxImg(ev.image_url)}
                        title="Click to view full image"
                      />
                    </div>
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
      {/* ── Lightbox ──────────────────────────────────────────*/}
      {lightboxImg && (
        <div
          className="cal-lightbox__overlay"
          onClick={() => setLightboxImg(null)}
        >
          <img
            className="cal-lightbox__img"
            src={lightboxImg}
            alt="Event flyer"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="cal-lightbox__close"
            onClick={() => setLightboxImg(null)}
            aria-label="Close"
          >&#x2715;</button>
        </div>
      )}

    </div>
  );
}

export default CalendarView;

