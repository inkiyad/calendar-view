import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Admin.css';

// ─── Canvas crop helper ────────────────────────────────────────────────────────
const cropImage = (base64, crop) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cropW = (crop.width  / 100) * img.width;
      const cropH = (crop.height / 100) * img.height;
      const canvas = document.createElement('canvas');
      canvas.width  = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        (crop.x / 100) * img.width,
        (crop.y / 100) * img.height,
        cropW, cropH, 0, 0, cropW, cropH
      );
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = base64;
  });

// ─── File → base64 helper ─────────────────────────────────────────────────────
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── Admin component ─────────────────────────────────────────────────────────
export default function Admin() {
  const today = new Date();
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('app_theme');
    if (stored) return stored === 'dark';
    return false;
  });

  const toggleDark = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('app_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'app_theme' && e.newValue) {
        setDarkMode(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('adm_authed') === '1');
  const [authInput, setAuthInput] = useState('');
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('adm_token') || '');
  const [authError, setAuthError] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/.netlify/functions/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: authInput }),
      });
      const data = await res.json();
      if (data.error || !data.token) throw new Error(data.error || 'Login failed');
      sessionStorage.setItem('adm_authed', '1');
      sessionStorage.setItem('adm_token', data.token);
      setAdminToken(data.token);
      setAuthed(true);
      setAuthError(false);
      setAuthInput('');
    } catch {
      setAuthError(true);
      setAuthInput('');
    }
  };

  // ── Section A state — queue ───────────────────────────────────────────────
  // Each item: { id, file, previewSrc, status, extracted, croppedSrc, error }
  // status: 'pending' | 'extracting' | 'extracted' | 'saving' | 'saved' | 'error'
  const [queue,      setQueue]      = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [batchBusy,  setBatchBusy]  = useState(false);
  const fileInputRef = useRef(null);

  // ── Section B state ───────────────────────────────────────────────────────
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [editingEvent,  setEditingEvent]  = useState(null);
  const [editSaving,    setEditSaving]    = useState(false);
  const [queueEdits,    setQueueEdits]    = useState({});
  const [selectedEvIds, setSelectedEvIds] = useState(new Set()); // bulk delete
  const [monthCursor,   setMonthCursor]   = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  // ── Section C state — manual add ─────────────────────────────────────────
  const emptyForm = { title: '', date: '', time: '', end_time: '', location: '', description: '', registration_link: '' };
  const [addOpen,    setAddOpen]    = useState(false);
  const [manualForm, setManualForm] = useState(emptyForm);
  const [manualImg,  setManualImg]  = useState(null);  // { file, previewSrc }
  const [manualSaving, setManualSaving] = useState(false);
  const manualImgRef = useRef(null);

  // ── Section D state — trusted WhatsApp senders ──────────────────────────
  const [trustedSenders, setTrustedSenders] = useState([]);
  const [trustedInput, setTrustedInput] = useState('');
  const [trustedLoading, setTrustedLoading] = useState(false);
  const [trustedSaving, setTrustedSaving] = useState(false);
  const [trustedError, setTrustedError] = useState('');

  const setManualField = (k, v) => setManualForm(p => ({ ...p, [k]: v }));

  const handleManualSave = async (e) => {
    e.preventDefault();
    if (!manualForm.title || !manualForm.date) return;
    setManualSaving(true);
    try {
      let croppedImageBase64 = null;
      let mimeType = 'image/jpeg';
      if (manualImg?.file) {
        croppedImageBase64 = await fileToBase64(manualImg.file);
        mimeType = manualImg.file.type;
      }
      const res  = await fetch('/.netlify/functions/save-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventData: { ...manualForm, is_event: true }, originalImageBase64: croppedImageBase64, mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setManualForm(emptyForm);
      setManualImg(null);
      setAddOpen(false);
      await loadEvents();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setManualSaving(false);
    }
  };

  // ── Load events ───────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/.netlify/functions/get-events?all=true');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadTrustedSenders = useCallback(async () => {
    if (!adminToken) return;
    setTrustedLoading(true);
    setTrustedError('');
    try {
      const res = await fetch('/.netlify/functions/trusted-senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', adminToken }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrustedSenders(data.senders || []);
    } catch (err) {
      setTrustedError(err.message);
    } finally {
      setTrustedLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { if (authed) loadTrustedSenders(); }, [authed, loadTrustedSenders]);

  const addTrustedSender = async (e) => {
    e.preventDefault();
    if (!trustedInput.trim()) return;
    setTrustedSaving(true);
    setTrustedError('');
    try {
      const res = await fetch('/.netlify/functions/trusted-senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', number: trustedInput, adminToken }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrustedSenders(data.senders || []);
      setTrustedInput('');
    } catch (err) {
      setTrustedError(err.message);
    } finally {
      setTrustedSaving(false);
    }
  };

  const removeTrustedSender = async (number) => {
    if (!window.confirm(`Remove ${number} from trusted WhatsApp senders?`)) return;
    setTrustedSaving(true);
    setTrustedError('');
    try {
      const res = await fetch('/.netlify/functions/trusted-senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', number, adminToken }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrustedSenders(data.senders || []);
    } catch (err) {
      setTrustedError(err.message);
    } finally {
      setTrustedSaving(false);
    }
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const acceptFiles = (files) => {
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    const items = images.map(file => ({
      id:         Math.random().toString(36).slice(2),
      file,
      previewSrc: URL.createObjectURL(file),
      status:     'pending',
      extracted:  null,
      croppedSrc: null,
      error:      null,
    }));
    setQueue(prev => [...prev, ...items]);
  };

  const onFileChange = (e) => { acceptFiles(e.target.files); e.target.value = ''; };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFiles(e.dataTransfer.files);
  };

  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = ()  => setIsDragging(false);

  const removeItem = (id) => setQueue(prev => prev.filter(it => it.id !== id));

  const updateItem = useCallback((id, patch) =>
    setQueue(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it)), []);

  // ── Extract one item (autosaves valid events) ────────────────────────────
  const extractItem = useCallback(async (item) => {
    updateItem(item.id, { status: 'extracting', error: null });
    try {
      const imageBase64 = await fileToBase64(item.file);
      const mimeType    = item.file.type;

      const res  = await fetch('/.netlify/functions/extract-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64, mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const result     = data.extracted;
      const fullBase64 = `data:${mimeType};base64,${imageBase64}`;
      const crop       = result.crop || { x: 0, y: 0, width: 100, height: 65 };
      const croppedSrc = await cropImage(fullBase64, crop);

      if (result.is_event) {
        // Autosave immediately
        updateItem(item.id, { status: 'saving', extracted: result, croppedSrc });
        const { crop: _c, ...eventData } = result; // eslint-disable-line no-unused-vars
        const saveRes  = await fetch('/.netlify/functions/save-event', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            eventData,
            originalImageBase64: imageBase64,
            mimeType,
          }),
        });
        const saveData = await saveRes.json();
        if (saveData.error) throw new Error(saveData.error);
        updateItem(item.id, { status: 'saved', extracted: result, croppedSrc });
      } else {
        updateItem(item.id, { status: 'extracted', extracted: result, croppedSrc });
      }
    } catch (err) {
      updateItem(item.id, { status: 'error', error: err.message });
    }
  }, [updateItem]);

  // ── Extract all pending ───────────────────────────────────────────────────
  const handleExtractAll = async () => {
    setBatchBusy(true);
    const pending = queue.filter(it => it.status === 'pending');
    for (const item of pending) {
      await extractItem(item);
    }
    await loadEvents();
    setBatchBusy(false);
  };

  // ── Save one item ─────────────────────────────────────────────────────────
  const saveItem = useCallback(async (item) => {
    if (!item.extracted?.is_event) return;
    updateItem(item.id, { status: 'saving' });
    try {
      const { crop, ...eventData } = item.extracted;  // eslint-disable-line no-unused-vars
      const originalBase64 = await fileToBase64(item.file);
      const mimeType = item.file?.type || 'image/jpeg';

      const res  = await fetch('/.netlify/functions/save-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventData, originalImageBase64: originalBase64, mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateItem(item.id, { status: 'saved' });
    } catch (err) {
      updateItem(item.id, { status: 'error', error: err.message });
    }
  }, [updateItem]);

  // ── Save all extracted ────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setBatchBusy(true);
    const ready = queue.filter(it => it.status === 'extracted' && it.extracted?.is_event);
    for (const item of ready) {
      await saveItem(item);
    }
    await loadEvents();
    setBatchBusy(false);
  };

  // ── Clear finished items ──────────────────────────────────────────────────
  const clearDone = () =>
    setQueue(prev => prev.filter(it => it.status !== 'saved' && it.status !== 'error'));

  // ── Queue item edit helpers ───────────────────────────────────────────────
  const startQueueEdit = (item) => {
    setQueueEdits(prev => ({
      ...prev,
      [item.id]: {
        title:       item.extracted?.title       || '',
        date:        item.extracted?.date        || '',
        time:        item.extracted?.time        || '',
        location:    item.extracted?.location    || '',
        description: item.extracted?.description || '',
      },
    }));
  };

  const cancelQueueEdit = (id) => {
    setQueueEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const applyQueueEdit = (id) => {
    const edits = queueEdits[id];
    setQueue(prev => prev.map(it =>
      it.id === id ? { ...it, extracted: { ...it.extracted, ...edits } } : it
    ));
    cancelQueueEdit(id);
  };

  const setQueueEditField = (id, field, value) => {
    setQueueEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  // ── Saved event edit ──────────────────────────────────────────────────────
  const handleEditSave = async () => {
    if (!editingEvent) return;
    setEditSaving(true);
    try {
      const res  = await fetch('/.netlify/functions/update-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: editingEvent.id, eventData: editingEvent }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? { ...ev, ...editingEvent } : ev));
      setEditingEvent(null);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = async (ids) => {
    if (!ids.length || !window.confirm(`Delete ${ids.length} event${ids.length > 1 ? 's' : ''}?`)) return;
    try {
      const res  = await fetch('/.netlify/functions/delete-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEvents(prev => prev.filter(ev => !ids.includes(ev.id)));
      setSelectedEvIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    } catch (err) {
      alert('Bulk delete failed: ' + err.message);
    }
  };

  const toggleSelect = (id) => setSelectedEvIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = (visibleIds, allVisibleSelected) => {
    setSelectedEvIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // ── Delete single event ───────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      const res  = await fetch('/.netlify/functions/delete-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert('Delete failed: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className={`adm adm-login${darkMode ? ' adm--dark' : ''}`}>
        <form onSubmit={handleLogin} className="adm-login-card">
          <p className="adm-login-title">Calendar Admin</p>
          <input
            type="password"
            autoFocus
            placeholder="Password"
            value={authInput}
            onChange={(e) => { setAuthInput(e.target.value); setAuthError(false); }}
            className={`adm-login-input${authError ? ' adm-login-input--error' : ''}`}
          />
          {authError && <p className="adm-login-error">Incorrect password.</p>}
          <button type="submit" className="adm-login-btn">Enter</button>
        </form>
      </div>
    );
  }

  const isSameMonth = (dateStr, cursor) => {
    if (!dateStr) return false;
    const [yy, mm] = dateStr.split('-');
    return Number(yy) === cursor.getFullYear() && Number(mm) === cursor.getMonth() + 1;
  };

  const hasEventsInMonth = (cursor) =>
    events.some(ev => isSameMonth(ev.date, cursor));

  const monthLabel = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const visibleEvents = events
    .filter(ev => isSameMonth(ev.date, monthCursor))
    .slice()
    .sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    });

  const visibleIds = visibleEvents.map(ev => ev.id);
  const visibleSelectedIds = visibleEvents.filter(ev => selectedEvIds.has(ev.id)).map(ev => ev.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedIds.length === visibleIds.length;

  const prevMonth = () => {
    const target = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    if (hasEventsInMonth(target)) setMonthCursor(target);
  };
  const nextMonth = () => {
    const target = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    if (hasEventsInMonth(target)) setMonthCursor(target);
  };
  const goThisMonth = () =>
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const prevEnabled = hasEventsInMonth(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1));
  const nextEnabled = hasEventsInMonth(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1));

  return (
    <div className={`adm${darkMode ? ' adm--dark' : ''}`}>

      <header className="adm-header">
        <span className="adm-header-title">Calendar Admin</span>
        <div className="adm-header-actions">
          <button className="adm-theme-toggle" onClick={toggleDark} title="Toggle theme">
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => { window.location.href = '/'; }}>
            ← Back to calendar
          </button>
        </div>
      </header>

      <div className="adm-body">

        {/* ── SECTION A ── */}
        <section className="adm-card">
          <div className="adm-section-header">
            <h2 className="adm-section-title">A. Add Events from Screenshots</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {queue.some(it => it.status === 'pending') && (
                <button
                  className="adm-btn adm-btn--gold adm-btn--sm"
                  onClick={handleExtractAll}
                  disabled={batchBusy}
                >
                  {batchBusy ? <><span className="adm-spinner" /> Extracting & saving…</> : `Extract & save ${queue.filter(it => it.status === 'pending').length} image${queue.filter(it => it.status === 'pending').length > 1 ? 's' : ''}`}
                </button>
              )}
              {queue.some(it => it.status === 'saved' || it.status === 'error') && (
                <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={clearDone}>Clear done</button>
              )}
            </div>
          </div>

          {/* Drop zone — always visible */}
          <div
            className={`adm-drop${isDragging ? ' adm-drop--active' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="adm-drop-icon">↑</div>
            <p className="adm-drop-text">Drag & drop Instagram screenshots</p>
            <p className="adm-drop-sub">Select multiple — JPG, PNG, WEBP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <ul className="adm-queue" style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {queue.map(item => (
                <li key={item.id} className="adm-queue-item">
                  <div className="adm-queue-thumb-wrap">
                    <img src={item.status === 'extracted' || item.status === 'saving' || item.status === 'saved' ? (item.croppedSrc || item.previewSrc) : item.previewSrc} alt="" className="adm-queue-thumb" />
                    <span className={`adm-queue-badge adm-queue-badge--${item.status}`}>
                      {item.status === 'pending'    && 'Pending'}
                      {item.status === 'extracting' && <><span className="adm-spinner" style={{ width: 10, height: 10 }} /> Extracting</>}
                      {item.status === 'extracted'  && (item.extracted?.is_event ? '✓ Ready' : '— Not event')}
                      {item.status === 'saving'     && <><span className="adm-spinner" style={{ width: 10, height: 10 }} /> Saving</>}
                      {item.status === 'saved'      && '✓ Saved'}
                      {item.status === 'error'      && '✕ Error'}
                    </span>
                  </div>

                  <div
                    className="adm-queue-info"
                    onClick={() => {
                      if ((item.status === 'extracted' || item.status === 'saved') && item.extracted?.is_event) {
                        queueEdits[item.id] ? cancelQueueEdit(item.id) : startQueueEdit(item);
                      }
                    }}
                    style={{ cursor: (item.status === 'extracted' || item.status === 'saved') && item.extracted?.is_event ? 'pointer' : 'default' }}
                  >
                    {(item.status === 'pending' || item.status === 'error') && (
                      <span className="adm-queue-filename">{item.file.name}</span>
                    )}
                    {item.status === 'error' && (
                      <span className="adm-queue-error">{item.error}</span>
                    )}
                    {(item.status === 'extracted' || item.status === 'saving' || item.status === 'saved') && item.extracted?.is_event && (
                      queueEdits[item.id] ? (
                        <div className="adm-inline-form">
                          <div className="adm-inline-form-row">
                            <input className="adm-inline-input" placeholder="Title" value={queueEdits[item.id].title} onChange={e => setQueueEditField(item.id, 'title', e.target.value)} />
                          </div>
                          <div className="adm-inline-form-row adm-inline-form-row--3">
                            <input className="adm-inline-input" placeholder="Date (YYYY-MM-DD)" value={queueEdits[item.id].date} onChange={e => setQueueEditField(item.id, 'date', e.target.value)} />
                            <input className="adm-inline-input" placeholder="Time" value={queueEdits[item.id].time} onChange={e => setQueueEditField(item.id, 'time', e.target.value)} />
                            <input className="adm-inline-input" placeholder="Location" value={queueEdits[item.id].location} onChange={e => setQueueEditField(item.id, 'location', e.target.value)} />
                          </div>
                          <div className="adm-inline-form-row">
                            <input className="adm-inline-input" placeholder="Description" value={queueEdits[item.id].description} onChange={e => setQueueEditField(item.id, 'description', e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button className="adm-btn adm-btn--gold adm-btn--sm" style={{ fontSize: 12 }} onClick={() => applyQueueEdit(item.id)}>Apply</button>
                            <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ fontSize: 12 }} onClick={() => cancelQueueEdit(item.id)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="adm-queue-title">{item.extracted.title}</span>
                          <span className="adm-queue-meta">
                            {item.extracted.date}
                            {item.extracted.time ? ` · ${item.extracted.time}` : ''}
                            {item.extracted.location ? ` · ${item.extracted.location}` : ''}
                          </span>
                        </>
                      )
                    )}
                    {item.status === 'extracted' && !item.extracted?.is_event && (
                      <span className="adm-queue-meta">GPT determined this is not an event.</span>
                    )}
                    {item.status === 'saved' && (
                      <span className="adm-queue-meta" style={{ color: 'var(--green)' }}>Event saved to calendar.</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {item.status !== 'saving' && item.status !== 'extracting' && (
                      <button className="adm-delete-btn" title="Remove" onClick={() => removeItem(item.id)}>×</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── SECTION B — Manual add ── */}
        <section className="adm-card">
          <div className="adm-section-header">
            <h2 className="adm-section-title">B. Add Event Manually</h2>
            <button
              className={`adm-btn adm-btn--sm ${addOpen ? 'adm-btn--ghost' : 'adm-btn--gold'}`}
              onClick={() => { setAddOpen(o => !o); setManualForm(emptyForm); setManualImg(null); }}
            >
              {addOpen ? 'Cancel' : '+ New event'}
            </button>
          </div>

          {addOpen && (
            <form onSubmit={handleManualSave} className="adm-manual-form">
              <div className="adm-manual-row">
                <input
                  className="adm-inline-input adm-manual-input--full"
                  placeholder="Event title *"
                  value={manualForm.title}
                  onChange={e => setManualField('title', e.target.value)}
                  required
                />
              </div>

              <div className="adm-manual-row adm-manual-row--3">
                <div className="adm-manual-field">
                  <label className="adm-manual-label">Date *</label>
                  <input className="adm-inline-input" type="date" value={manualForm.date} onChange={e => setManualField('date', e.target.value)} required />
                </div>
                <div className="adm-manual-field">
                  <label className="adm-manual-label">Start time</label>
                  <input className="adm-inline-input" type="time" value={manualForm.time} onChange={e => setManualField('time', e.target.value)} />
                </div>
                <div className="adm-manual-field">
                  <label className="adm-manual-label">End time</label>
                  <input className="adm-inline-input" type="time" value={manualForm.end_time} onChange={e => setManualField('end_time', e.target.value)} />
                </div>
              </div>

              <div className="adm-manual-row">
                <input
                  className="adm-inline-input adm-manual-input--full"
                  placeholder="Location"
                  value={manualForm.location}
                  onChange={e => setManualField('location', e.target.value)}
                />
              </div>

              <div className="adm-manual-row">
                <textarea
                  className="adm-inline-input adm-manual-textarea"
                  placeholder="Description"
                  value={manualForm.description}
                  onChange={e => setManualField('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="adm-manual-row">
                <input
                  className="adm-inline-input adm-manual-input--full"
                  placeholder="Registration / ticket link (optional)"
                  value={manualForm.registration_link}
                  onChange={e => setManualField('registration_link', e.target.value)}
                />
              </div>

              <div className="adm-manual-row adm-manual-row--img">
                <label className="adm-manual-label">Cover image (optional)</label>
                <div
                  className="adm-manual-img-pick"
                  onClick={() => manualImgRef.current?.click()}
                >
                  {manualImg ? (
                    <img src={manualImg.previewSrc} alt="preview" className="adm-manual-img-preview" />
                  ) : (
                    <span className="adm-manual-img-placeholder">Click to upload</span>
                  )}
                </div>
                <input
                  ref={manualImgRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setManualImg({ file, previewSrc: URL.createObjectURL(file) });
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="adm-manual-actions">
                <button type="submit" className="adm-btn adm-btn--gold" disabled={manualSaving}>
                  {manualSaving ? <><span className="adm-spinner" /> Saving…</> : 'Save event'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── SECTION C — WhatsApp trusted senders ── */}
        <section className="adm-card">
          <div className="adm-section-header">
            <h2 className="adm-section-title">C. WhatsApp Trusted Senders</h2>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={loadTrustedSenders} disabled={trustedLoading}>
              {trustedLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <form className="adm-trusted-form" onSubmit={addTrustedSender}>
            <input
              className="adm-inline-input"
              placeholder="Phone number, e.g. +1 718 555 1234"
              value={trustedInput}
              onChange={e => setTrustedInput(e.target.value)}
            />
            <button className="adm-btn adm-btn--gold adm-btn--sm" type="submit" disabled={trustedSaving || !trustedInput.trim()}>
              {trustedSaving ? <><span className="adm-spinner" /> Saving...</> : 'Add trusted'}
            </button>
          </form>

          {trustedError && <div className="adm-alert adm-alert--error adm-trusted-alert">{trustedError}</div>}

          {trustedSenders.length === 0 ? (
            <div className="adm-empty">No trusted WhatsApp senders yet.</div>
          ) : (
            <ul className="adm-trusted-list">
              {trustedSenders.map(sender => (
                <li key={`${sender.source}:${sender.number}`} className="adm-trusted-row">
                  <div className="adm-trusted-info">
                    <span className="adm-trusted-number">+{sender.number}</span>
                    <span className="adm-trusted-source">
                      {sender.source === 'bootstrap' ? 'Bootstrap sender' : 'Dashboard sender'}
                    </span>
                  </div>
                  {sender.removable ? (
                    <button
                      className="adm-delete-btn"
                      title="Remove trusted sender"
                      onClick={() => removeTrustedSender(sender.number)}
                      disabled={trustedSaving}
                    >
                      ×
                    </button>
                  ) : (
                    <span className="adm-trusted-lock">Locked</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── SECTION D ── */}
        <section className="adm-card">
          <div className="adm-section-header adm-section-header--manage">
            <h2 className="adm-section-title">D. Manage Events</h2>
            <div className="adm-month-nav">
              <button className="adm-month-btn" onClick={prevMonth} aria-label="Previous month" disabled={!prevEnabled}>
                &#8249;
              </button>
              <span className="adm-month-label">{monthLabel}</span>
              <button className="adm-month-btn" onClick={nextMonth} aria-label="Next month" disabled={!nextEnabled}>
                &#8250;
              </button>
            </div>
            <div className="adm-manage-actions">
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={goThisMonth}>This month</button>
              {visibleSelectedIds.length > 0 && (
                <button
                  className="adm-btn adm-btn--sm"
                  style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
                  onClick={() => handleBulkDelete(visibleSelectedIds)}
                >
                  Delete {visibleSelectedIds.length} selected
                </button>
              )}
              {visibleEvents.length > 0 && (
                <button
                  className="adm-btn adm-btn--ghost adm-btn--sm"
                  onClick={() => toggleSelectAll(visibleIds, allVisibleSelected)}
                >
                  {allVisibleSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={loadEvents} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          {loading && <div className="adm-empty">Loading events…</div>}

          {!loading && visibleEvents.length === 0 && (
            <div className="adm-empty">No events for {monthLabel}.</div>
          )}

          <ul className="adm-event-list">
            {visibleEvents.map((ev) => (
              <li
                key={ev.id}
                className={`adm-event-row${editingEvent?.id === ev.id ? ' adm-event-row--editing' : ''}${selectedEvIds.has(ev.id) ? ' adm-event-row--selected' : ''}`}
              >
                <label className="adm-row-check" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedEvIds.has(ev.id)}
                    onChange={() => toggleSelect(ev.id)}
                  />
                </label>
                {ev.image_url ? (
                  <img src={ev.image_url} alt={ev.title} className="adm-event-row-thumb" />
                ) : (
                  <div className="adm-event-row-thumb adm-event-row-thumb--empty" />
                )}
                {editingEvent?.id === ev.id ? (
                  <div className="adm-inline-form">
                    <div className="adm-inline-form-row">
                      <input className="adm-inline-input" placeholder="Title" value={editingEvent.title || ''} onChange={e => setEditingEvent(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div className="adm-inline-form-row adm-inline-form-row--3">
                      <input className="adm-inline-input" placeholder="Date (YYYY-MM-DD)" value={editingEvent.date || ''} onChange={e => setEditingEvent(p => ({ ...p, date: e.target.value }))} />
                      <input className="adm-inline-input" placeholder="Time" value={editingEvent.time || ''} onChange={e => setEditingEvent(p => ({ ...p, time: e.target.value }))} />
                      <input className="adm-inline-input" placeholder="Location" value={editingEvent.location || ''} onChange={e => setEditingEvent(p => ({ ...p, location: e.target.value }))} />
                    </div>
                    <div className="adm-inline-form-row">
                      <input className="adm-inline-input" placeholder="Description" value={editingEvent.description || ''} onChange={e => setEditingEvent(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button className="adm-btn adm-btn--gold adm-btn--sm" style={{ fontSize: 12 }} onClick={handleEditSave} disabled={editSaving}>
                        {editSaving ? <><span className="adm-spinner" /> Saving…</> : 'Save'}
                      </button>
                      <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ fontSize: 12 }} onClick={() => setEditingEvent(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="adm-event-row-info"
                    onClick={() => setEditingEvent({ ...ev })}
                    style={{ cursor: 'pointer' }}
                    title="Click to edit"
                  >
                    <span className="adm-event-row-title">{ev.title}</span>
                    <span className="adm-event-row-meta">{ev.date}{ev.time ? ` · ${ev.time}` : ''}{ev.location ? ` · ${ev.location}` : ''}</span>
                  </div>
                )}
                {editingEvent?.id !== ev.id && (
                  <button className="adm-delete-btn" title="Delete event" onClick={() => handleDelete(ev.id)}>×</button>
                )}
              </li>
            ))}
          </ul>
        </section>

      </div>
    </div>
  );
}
