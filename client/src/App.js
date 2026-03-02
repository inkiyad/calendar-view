import React, { useEffect, useState } from 'react';
import CalendarView from './CalendarView';
import EmbedCode from './EmbedCode';
import Admin from './Admin';
import './App.css';

function App() {
  const [events, setEvents] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [page, setPage] = useState('calendar'); // 'calendar' | 'admin'

  const toggleDark = () => setDarkMode(prev => !prev);

  useEffect(() => {
    fetch('/.netlify/functions/get-events')
      .then(r => r.json())
      .then(data => setEvents(data.events || []))
      .catch(() => {
        // Fallback sample events when server is not running
        setEvents([
          { date: '2026-03-01', title: 'Spring Kickoff', time: '10:00 AM', location: 'Main Hall', description: 'Annual spring kickoff meeting for all staff.', category: 'Meeting', color: '#2d6a4f' },
          { date: '2026-03-05', title: 'Workshop: Design Systems', time: '2:00 PM', location: 'Room 204', description: 'Hands-on design systems workshop.', category: 'Workshop', color: '#1d3557' },
          { date: '2026-03-05', title: 'Team Lunch', time: '12:00 PM', location: 'Cafeteria', description: 'Monthly team lunch.', category: 'Social', color: '#e07a5f' },
          { date: '2026-03-12', title: 'Board Meeting', time: '9:00 AM', location: 'Conference Room A', description: 'Quarterly board meeting.', category: 'Meeting', color: '#2d6a4f' },
          { date: '2026-03-18', title: 'Fundraiser Gala', time: '6:00 PM', location: 'Grand Ballroom', description: 'Annual fundraiser gala dinner.', category: 'Event', color: '#c77dff' },
          { date: '2026-03-22', title: 'Volunteer Day', time: '8:00 AM', location: 'City Park', description: 'Community volunteer day.', category: 'Community', color: '#f4a261' },
          { date: '2026-03-28', title: 'Closing Ceremony', time: '5:00 PM', location: 'Auditorium', description: 'End of quarter closing ceremony.', category: 'Event', color: '#1d3557' }
        ]);
      });
  }, []);

  return (
    <div className={`app${darkMode ? ' app--dark' : ''}`}>
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-org-name">My Organization</span>
          <nav className="app-nav">
            <button
              className={`app-nav-btn${page === 'calendar' ? ' app-nav-btn--active' : ''}`}
              onClick={() => setPage('calendar')}
            >Calendar</button>
            <button
              className={`app-nav-btn${page === 'admin' ? ' app-nav-btn--active' : ''}`}
              onClick={() => setPage('admin')}
            >Admin</button>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <button className="app-dark-toggle" onClick={toggleDark} title="Toggle dark mode">
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      {page === 'calendar' && (
        <>
          <div className="app-section-title">
            <h1>Events Calendar</h1>
          </div>
          <main className="app-main" id="calendar">
            <CalendarView events={events} darkMode={darkMode} />
          </main>
          <section className="app-embed-section">
            <EmbedCode />
          </section>
        </>
      )}

      {page === 'admin' && (
        <main className="app-main app-main--full">
          <Admin darkMode={darkMode} />
        </main>
      )}
    </div>
  );
}

export default App;
