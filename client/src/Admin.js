import React, { useState, useEffect, useCallback } from 'react';
import './Admin.css';

const SESSION_KEY = 'admin_authed';
const API = '/.netlify/functions/admin-events';

const EMPTY_FORM = {
  title: '',
  date: '',
  time: '',
  end_time: '',
  description: '',
  location: '',
  image_url: '',
  registration_link: '',
  tags: '',
};

function eventToForm(ev) {
  return {
    title: ev.title || '',
    date: ev.date || '',
    time: ev.time || '',
    end_time: ev.end_time || '',
    description: ev.description || '',
    location: ev.location || '',
    image_url: ev.image_url || '',
    registration_link: ev.registration_link || '',
    tags: Array.isArray(ev.tags) ? ev.tags.join(', ') : (ev.tags || ''),
  };
}

function formToPayload(form) {
  return {
    title: form.title.trim() || null,
    date: form.date || null,
    time: form.time.trim() || null,
    end_time: form.end_time.trim() || null,
    description: form.description.trim() || null,
    location: form.location.trim() || null,
    image_url: form.image_url.trim() || null,
    registration_link: form.registration_link.trim() || null,
    tags: form.tags
      ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [],
  };
}

function Admin({ darkMode }) {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [loginError, setLoginError] = useState('');

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // null = new event
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const storedPassword = sessionStorage.getItem('admin_password') || '';

  const fetchEvents = useCallback(async (pw) => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch(API, {
        headers: { 'x-admin-password': pw },
      });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('admin_password');
        setFetchError('Session expired. Please log in again.');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load events');
      setEvents(data.events || []);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && storedPassword) {
      fetchEvents(storedPassword);
    }
  }, [authed, storedPassword, fetchEvents]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(API, {
        headers: { 'x-admin-password': password },
      });
      if (res.status === 401) {
        setLoginError('Incorrect password.');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      sessionStorage.setItem(SESSION_KEY, '1');
      sessionStorage.setItem('admin_password', password);
      setAuthed(true);
      setEvents(data.events || []);
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function openAddModal() {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(ev) {
    setEditingEvent(ev);
    setForm(eventToForm(ev));
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEvent(null);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.date) { setFormError('Date is required.'); return; }
    setSaving(true);
    setFormError('');
    const pw = sessionStorage.getItem('admin_password') || '';
    try {
      const payload = formToPayload(form);
      let res;
      if (editingEvent) {
        res = await fetch(API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
          body: JSON.stringify({ id: editingEvent.id, ...payload }),
        });
      } else {
        res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      closeModal();
      fetchEvents(pw);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev) {
    if (!window.confirm(`Delete event "${ev.title}"?`)) return;
    setDeleteError('');
    const pw = sessionStorage.getItem('admin_password') || '';
    try {
      const res = await fetch(API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
        body: JSON.stringify({ id: ev.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      fetchEvents(pw);
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  const cls = `admin${darkMode ? ' admin--dark' : ''}`;
  const modalCls = `admin-modal${darkMode ? ' admin-modal--dark' : ''}`;

  if (!authed) {
    return (
      <div className={cls}>
        <div className="admin-login">
          <h2>Admin Login</h2>
          <form className="admin-login__form" onSubmit={handleLogin}>
            <input
              className="admin-login__input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <p className="admin-login__error">{loginError}</p>}
            <button className="admin-login__btn" type="submit">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={cls}>
      <div className="admin-inner">
        <div className="admin-top">
          <h2 className="admin-title">Manage Events</h2>
          <button className="admin-add-btn" onClick={openAddModal}>+ Add Event</button>
        </div>

        {fetchError && <p className="admin-error">{fetchError}</p>}
        {deleteError && <p className="admin-error">{deleteError}</p>}

        {loading ? (
          <p className="admin-empty">Loading events…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr><td colSpan={5} className="admin-empty">No events found.</td></tr>
                ) : (
                  events.map(ev => (
                    <tr key={ev.id}>
                      <td className="admin-table__date">{ev.date}</td>
                      <td>{ev.title}</td>
                      <td className="admin-table__time">{ev.time || '—'}</td>
                      <td>{ev.location || '—'}</td>
                      <td>
                        <div className="admin-table__actions">
                          <button className="admin-btn-edit" onClick={() => openEditModal(ev)}>Edit</button>
                          <button className="admin-btn-delete" onClick={() => handleDelete(ev)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="admin-modal__overlay" onClick={closeModal}>
          <div className={modalCls} onClick={e => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 className="admin-modal__title">{editingEvent ? 'Edit Event' : 'Add Event'}</h3>
              <button className="admin-modal__close" onClick={closeModal} aria-label="Close">&#x2715;</button>
            </div>
            <form className="admin-form" onSubmit={handleSave}>
              <div className="admin-form__field">
                <label className="admin-form__label">Title *</label>
                <input className="admin-form__input" name="title" value={form.title} onChange={handleFormChange} />
              </div>
              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label className="admin-form__label">Date *</label>
                  <input className="admin-form__input" type="date" name="date" value={form.date} onChange={handleFormChange} />
                </div>
                <div className="admin-form__field">
                  <label className="admin-form__label">Time</label>
                  <input className="admin-form__input" name="time" placeholder="e.g. 7:00 PM" value={form.time} onChange={handleFormChange} />
                </div>
                <div className="admin-form__field">
                  <label className="admin-form__label">End Time</label>
                  <input className="admin-form__input" name="end_time" placeholder="e.g. 9:00 PM" value={form.end_time} onChange={handleFormChange} />
                </div>
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Location</label>
                <input className="admin-form__input" name="location" value={form.location} onChange={handleFormChange} />
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Description</label>
                <textarea className="admin-form__textarea" name="description" value={form.description} onChange={handleFormChange} />
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Image URL</label>
                <input className="admin-form__input" name="image_url" placeholder="https://…" value={form.image_url} onChange={handleFormChange} />
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Registration Link</label>
                <input className="admin-form__input" name="registration_link" placeholder="https://…" value={form.registration_link} onChange={handleFormChange} />
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Tags (comma-separated)</label>
                <input className="admin-form__input" name="tags" placeholder="lecture, fundraiser, youth" value={form.tags} onChange={handleFormChange} />
              </div>
              {formError && <p className="admin-form__error">{formError}</p>}
              <div className="admin-form__actions">
                <button type="button" className="admin-form__cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-form__submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
