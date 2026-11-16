import { useEffect, useRef, useState } from 'react';
import type { Mode } from './types';
import { loadVox, startRun } from './api';

// Panel layout ported from deepgram-voice-dashboard (mic button, state, transcript).
// The live Deepgram connection is not wired: it needs a token route on bin/serve (see README).
// Nothing here fakes audio or transcripts. Typed commands are shown as typed.

type Line = { who: 'you (typed)' | 'screen'; text: string; tone?: 'fail' };

export function Vox({ mode }: { mode: Mode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== 'server') { setHasKey(null); return; }
    loadVox().then((v) => setHasKey(v ? !!v.hasKey : null));
  }, [mode]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [lines]);

  const voiceState = mode === 'checking' ? 'checking…' : hasKey ? 'key found · client not wired' : 'voice off';
  const canType = mode === 'server';

  const send = async () => {
    const t = text.trim();
    if (!t || !canType) return;
    setBusy(true);
    setLines((l) => [...l, { who: 'you (typed)', text: t }]);
    const err = await startRun({ prompt: t });
    setLines((l) => [...l, err ? { who: 'screen', text: err, tone: 'fail' } : { who: 'screen', text: 'Run started. Watch the graph and output.' }]);
    setBusy(false);
    if (!err) setText('');
  };

  return (
    <section className="vox" aria-label="Vox voice agent">
      <header className="panel-h">
        <h2>Vox</h2>
        <span className={`pill ${hasKey ? '' : 'pill-off'}`}>{voiceState}</span>
      </header>
      <div className="vox-main">
        <button className="mic" disabled aria-disabled title="Voice is off">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Talk</span>
        </button>
        <div className="vox-msg">
          {hasKey ? (
            <>
              <strong>Deepgram key found on the server.</strong>
              <p>The voice client still needs a token route on <code>bin/serve</code> (<code>POST /api/vox/token</code>, see 05-screen/README.md).</p>
            </>
          ) : (
            <>
              <strong>Needs DEEPGRAM_API_KEY — voice is off.</strong>
              <p>To enable: <code>export DEEPGRAM_API_KEY=…</code> in the shell that starts <code>bin/serve</code>, then restart it.</p>
            </>
          )}
        </div>
      </div>
      <div className="vox-log" ref={list} aria-live="polite">
        {lines.length === 0 ? (
          <p className="muted small">Transcript shows here when voice is on. Typed commands show here too.</p>
        ) : lines.map((l, i) => (
          <div key={i} className={`vl ${l.tone === 'fail' ? 'st-txt-fail' : ''}`}><span className="vl-who">{l.who}</span>{l.text}</div>
        ))}
      </div>
      <form className="vox-type" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label htmlFor="vox-type" className="small">type instead</label>
        <div className="row">
          <input id="vox-type" value={text} onChange={(e) => setText(e.target.value)} disabled={!canType || busy}
            placeholder={canType ? 'Ask the agent something…' : 'needs the server (bin/serve)'} />
          <button className="btn primary" type="submit" disabled={!canType || busy || !text.trim()}>Send</button>
        </div>
      </form>
    </section>
  );
}
