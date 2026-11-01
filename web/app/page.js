'use client';
import { useEffect, useRef, useState } from 'react';
import Logo from './logo.js';
import { TEXT, IDEAS } from '../lib/i18n.js';

/* ---------- almacenamiento local seguro ---------- */
const mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem('sb_' + k); return v === null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem('sb_' + k, JSON.stringify(v)); } catch { } },
};
const today = () => new Date().toISOString().slice(0, 10);
const freshUsage = () => ({ day: today(), seconds: 0, games: 0, log: [] });
const DEFAULTS = { age: 9, minutes: 30, maxGames: 10, blocked: '', noViolence: true, noScary: true, allowShare: true };

function extractHTML(t) {
  t = t.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();
  const s = t.search(/<!DOCTYPE html>/i);
  if (s > 0) t = t.slice(s);
  const e = t.toLowerCase().lastIndexOf('</html>');
  if (e > 0) t = t.slice(0, e + 7);
  return t;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState('es');
  const [settings, setSettings] = useState(DEFAULTS);
  const [usage, setUsage] = useState(freshUsage());
  const [games, setGames] = useState([]);

  const [view, setView] = useState('create'); // create | stage
  const [prompt, setPrompt] = useState('');
  const [change, setChange] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiSays, setAiSays] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [remixOf, setRemixOf] = useState(null);
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(null); // 'prompt' | 'change' | null
  const [micMsg, setMicMsg] = useState('');

  const [modal, setModal] = useState(null); // null | 'pin' | 'settings'
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [draft, setDraft] = useState(DEFAULTS);
  const [newPin, setNewPin] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const recRef = useRef(null);
  const frameRef = useRef(null);
  const promptRef = useRef(null);
  const changeRef = useRef(null);

  const t = TEXT[lang];

  /* ---------- carga inicial ---------- */
  useEffect(() => {
    const l = store.get('lang', null) || ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'es');
    setLang(l);
    setSettings({ ...DEFAULTS, ...store.get('settings', {}) });
    const u = store.get('usage', null);
    setUsage(u && u.day === today() ? u : freshUsage());
    setGames(store.get('games', []));
    setReady(true);

    const remix = new URLSearchParams(location.search).get('remix');
    if (remix) loadRemix(remix, l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready) { document.documentElement.lang = lang; store.set('lang', lang); } }, [lang, ready]);
  useEffect(() => { if (ready) store.set('usage', usage); }, [usage, ready]);

  /* ---------- tiempo de uso ---------- */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || modal) return;
      setUsage(u => (u.day !== today() ? freshUsage() : { ...u, seconds: u.seconds + 5 }));
    }, 5000);
    return () => clearInterval(id);
  }, [modal]);

  const left = Math.max(0, settings.minutes * 60 - usage.seconds);
  const locked = ready && left <= 0;

  function log(text, result) {
    setUsage(u => ({ ...u, log: [...u.log, { t: new Date().toTimeString().slice(0, 5), text, result }] }));
  }

  /* ---------- micrófono ---------- */
  function toggleMic(target) {
    if (listening) { recRef.current?.stop(); return; }
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setMicMsg(t.noMic);
      (target === 'prompt' ? promptRef : changeRef).current?.focus();
      return;
    }
    const rec = new SR();
    rec.lang = lang === 'de' ? 'de-DE' : 'es-ES';
    rec.interimResults = true;
    rec.continuous = false;
    const setter = target === 'prompt' ? setPrompt : setChange;
    const base = (target === 'prompt' ? prompt : change).trim();
    rec.onresult = e => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setter((base ? base + ' ' : '') + txt);
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicMsg(t.noMic);
    };
    rec.onend = () => setListening(null);
    recRef.current = rec;
    setMicMsg('');
    setListening(target);
    try { rec.start(); } catch { setListening(null); setMicMsg(t.noMic); }
  }

  /* ---------- crear / cambiar ---------- */
  async function generate(kind) {
    if (busy) return;
    const text = (kind === 'new' ? prompt : change).trim();
    if (!text) { setStatus(t.sayFirst); return; }
    const words = settings.blocked.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (words.some(w => text.toLowerCase().includes(w))) { setStatus(t.blocked); log(text, 'blockedw'); return; }
    if (usage.games >= settings.maxGames) { setStatus(t.tooMany); return; }

    setBusy(true); setProgress(2); setLink(''); setCopied(false);
    let i = 0;
    setStatus(t.working[0]);
    const spin = setInterval(() => { i = (i + 1) % t.working.length; setStatus(t.working[i]); }, 2200);

    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text, lang, age: settings.age, noViolence: settings.noViolence, noScary: settings.noScary,
          currentCode: kind === 'change' ? code : '',
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let out = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out += dec.decode(value, { stream: true });
        setProgress(Math.min(96, 3 + Math.round(out.length / 100)));
      }
      out = out.trim();

      const no = out.match(/<!--\s*NO:\s*([\s\S]*?)-->/);
      if (no && !/<html/i.test(out)) {
        log(text, 'refused');
        setAiSays('🤖 ' + no[1].trim());
        if (kind === 'new') { setCode(''); setView('stage'); }
        return;
      }
      const html = extractHTML(out);
      if (!/<html/i.test(html)) throw new Error('sin html');
      const ttl = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || t.myCreation;

      setUsage(u => ({ ...u, games: u.games + 1 }));
      log(text, kind === 'new' ? 'created' : 'changed');
      setCode(html); setTitle(ttl); setView('stage');
      setAiSays('🤖 ' + (kind === 'new' ? t.tada(ttl) : t.done));
      if (kind === 'new') setPrompt(''); else setChange('');
      setProgress(100);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Guardar en internet y preparar el enlace automáticamente
      setStatus(t.saving);
      const saved = await fetch('/api/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html, title: ttl, lang, remixOf }),
      }).then(r => r.json()).catch(() => null);
      if (saved?.url) {
        setLink(saved.url);
        const g = [{ id: saved.id, title: ttl, url: saved.url, date: new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : 'es-ES') }, ...store.get('games', [])].slice(0, 40);
        store.set('games', g); setGames(g);
      }
      setStatus('');
    } catch (e) {
      console.error(e);
      setStatus(t.oops);
    } finally {
      clearInterval(spin); setBusy(false); setTimeout(() => setProgress(0), 600);
    }
  }

  async function loadRemix(id, l) {
    const tt = TEXT[l || lang];
    const g = await fetch('/api/game/' + encodeURIComponent(id)).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!g) return;
    setCode(g.html); setTitle(g.title); setRemixOf(g.id); setView('stage'); setLink('');
    setAiSays('🪄 ' + tt.remixing(g.title));
    history.replaceState(null, '', '/');
  }

  async function openGame(g) {
    const data = await fetch('/api/game/' + g.id).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!data) return;
    setCode(data.html); setTitle(data.title); setLink(g.url); setRemixOf(g.id); setView('stage');
    setAiSays('🤖 ' + data.title);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function share() {
    if (!link) return;
    const text = t.shareText(title);
    log(title, 'shared');
    if (navigator.share) {
      try { await navigator.share({ title, text, url: link }); return; } catch { return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank');
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { }
  }

  function fullScreen() {
    const f = frameRef.current;
    if (!f) return;
    const req = f.requestFullscreen || f.webkitRequestFullscreen;
    if (req) { try { const p = req.call(f); if (p && p.catch) p.catch(() => { }); } catch { } }
  }

  /* ---------- padres ---------- */
  function openParents() { setPinInput(''); setPinErr(''); setModal('pin'); }
  function checkPin() {
    const v = pinInput.trim(); const pin = store.get('pin', null);
    if (!/^\d{4}$/.test(v)) { setPinErr(t.pin4); return; }
    if (!pin) store.set('pin', v); else if (pin !== v) { setPinErr(t.pinBad); return; }
    setDraft(settings); setNewPin(''); setResetDone(false); setModal('settings');
  }
  function saveSettings() {
    const s = { ...draft, minutes: Math.max(5, +draft.minutes || 30), maxGames: Math.max(1, +draft.maxGames || 10), age: +draft.age };
    setSettings(s); store.set('settings', s);
    if (/^\d{4}$/.test(newPin.trim())) store.set('pin', newPin.trim());
    setModal(null);
  }

  const micBtn = target => (
    <button type="button" className={'mic' + (listening === target ? ' on' : '')} onClick={() => toggleMic(target)}>
      <span className="dot" aria-hidden="true">🎤</span>
      <span>{listening === target ? t.listening : t.talk}</span>
    </button>
  );

  return (
    <div className="app">
      <header>
        <Logo size={40} />
        <div className="hbtns">
          {ready && <span className="timer">⏱️ {Math.ceil(left / 60)} min</span>}
          <button className="iconbtn" onClick={() => setLang(lang === 'de' ? 'es' : 'de')} aria-label="Idioma / Sprache">{t.otherLang}</button>
          <button className="iconbtn" onClick={openParents}>{t.parents}</button>
        </div>
      </header>

      {locked ? (
        <div className="card lock">
          <div style={{ fontSize: 64 }}>🌙</div>
          <h2>{t.timeUp}</h2>
          <p>{t.timeUpSub}</p>
        </div>
      ) : view === 'create' ? (
        <div className="card">
          <div className="tag">{t.tag}</div>
          <h2>{t.q}</h2>
          <p>{t.sub}</p>
          {micBtn('prompt')}
          {micMsg && <p style={{ marginBottom: 8, color: '#B53A12' }}>{micMsg}</p>}
          <textarea ref={promptRef} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t.ph} />
          <div className="ideas">
            {IDEAS[lang].map(idea => (
              <button key={idea} className="chip" onClick={() => setPrompt(idea.replace(/^\S+\s/, ''))}>{idea}</button>
            ))}
          </div>
          <button className="big" onClick={() => generate('new')} disabled={busy}>{t.create}</button>
          {progress > 0 && <div className="bar"><div style={{ width: progress + '%' }} /></div>}
          <div className="status">{status}</div>
        </div>
      ) : (
        <>
          {aiSays && <div className="bubble">{aiSays}</div>}
          {code && <iframe ref={frameRef} className="frame" title={title} srcDoc={code} sandbox="allow-scripts" />}

          {settings.allowShare && link && (
            <>
              <button className="big green" onClick={share}>{t.share}</button>
              <div className="linkbox">
                <span style={{ flex: 1 }}><small>{t.linkReady}</small><br />{link}</span>
                <button className="btn2" style={{ flex: '0 0 auto' }} onClick={copyLink}>{copied ? t.copied : t.copy}</button>
              </div>
            </>
          )}
          {status && !busy && <div className="status">{status}</div>}

          {code && (
            <div className="card">
              <h2 style={{ fontSize: 19 }}>{t.changeQ}</h2>
              {micBtn('change')}
              {micMsg && <p style={{ marginBottom: 8, color: '#B53A12' }}>{micMsg}</p>}
              <textarea ref={changeRef} value={change} onChange={e => setChange(e.target.value)} placeholder={t.phChange} style={{ minHeight: 70 }} />
              <div style={{ height: 10 }} />
              <button className="big" onClick={() => generate('change')} disabled={busy}>{t.change}</button>
              {progress > 0 && <div className="bar"><div style={{ width: progress + '%' }} /></div>}
              {busy && <div className="status">{status}</div>}
            </div>
          )}
          <div className="row">
            {code && <button className="btn2" onClick={fullScreen}>{t.full}</button>}
            <button className="btn2" onClick={() => { setView('create'); setCode(''); setLink(''); setRemixOf(null); setAiSays(''); setStatus(''); }}>{t.newOne}</button>
          </div>
        </>
      )}

      {games.length > 0 && !locked && (
        <div className="card">
          <h2 style={{ fontSize: 19 }}>{t.mine}</h2>
          <div className="gallery">
            {games.map(g => (
              <button key={g.id} className="gitem" onClick={() => openGame(g)}>
                <b>{g.title}</b><small>{g.date}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div className="overlay">
          <div className="modal">
            {modal === 'pin' ? (
              <>
                <h3>{t.zone}</h3>
                <p>{store.get('pin', null) ? t.pinAsk : t.pinNew}</p>
                <label htmlFor="pin">PIN</label>
                <input id="pin" type="password" inputMode="numeric" maxLength={4} value={pinInput} onChange={e => setPinInput(e.target.value)} />
                <div className="err">{pinErr}</div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn2" onClick={() => setModal(null)}>{t.cancel}</button>
                  <button className="big" style={{ fontSize: 17, padding: 10 }} onClick={checkPin}>{t.enter}</button>
                </div>
                <small>{t.pinFirst}</small>
              </>
            ) : (
              <>
                <h3>{t.control}</h3>
                <label htmlFor="age">{t.age}</label>
                <select id="age" value={draft.age} onChange={e => setDraft({ ...draft, age: +e.target.value })}>
                  <option value={6}>{t.age6}</option>
                  <option value={9}>{t.age9}</option>
                  <option value={12}>{t.age12}</option>
                </select>
                <label htmlFor="min">{t.minutes}</label>
                <input id="min" type="number" min={5} max={240} value={draft.minutes} onChange={e => setDraft({ ...draft, minutes: e.target.value })} />
                <label htmlFor="max">{t.perDay}</label>
                <input id="max" type="number" min={1} max={50} value={draft.maxGames} onChange={e => setDraft({ ...draft, maxGames: e.target.value })} />
                <label htmlFor="words">{t.words}</label>
                <input id="words" type="text" placeholder={t.wordsPh} value={draft.blocked} onChange={e => setDraft({ ...draft, blocked: e.target.value })} />
                <label className="switch"><input type="checkbox" checked={draft.noViolence} onChange={e => setDraft({ ...draft, noViolence: e.target.checked })} /> {t.noViolence}</label>
                <label className="switch"><input type="checkbox" checked={draft.noScary} onChange={e => setDraft({ ...draft, noScary: e.target.checked })} /> {t.noScary}</label>
                <label className="switch"><input type="checkbox" checked={draft.allowShare} onChange={e => setDraft({ ...draft, allowShare: e.target.checked })} /> {t.allowShare}</label>
                <label htmlFor="npin">{t.changePin}</label>
                <input id="npin" type="password" inputMode="numeric" maxLength={4} placeholder={t.changePinPh} value={newPin} onChange={e => setNewPin(e.target.value)} />
                <div style={{ height: 12 }} />
                <button className="btn2" style={{ width: '100%' }} onClick={() => { setUsage(u => ({ ...u, seconds: 0, games: 0 })); setResetDone(true); }}>{resetDone ? t.timeReset : t.resetTime}</button>
                <h3 style={{ marginTop: 16, fontSize: 18 }}>{t.todayLog}</h3>
                {usage.log.length === 0 && <div className="log">{t.nothing}</div>}
                {usage.log.slice().reverse().map((x, i) => (
                  <div className="log" key={i}><b>{x.t}</b> — “{x.text}” <i>({t.r[x.result] || x.result})</i></div>
                ))}
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn2" onClick={() => setModal(null)}>{t.close}</button>
                  <button className="big" style={{ fontSize: 17, padding: 10 }} onClick={saveSettings}>{t.save}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
