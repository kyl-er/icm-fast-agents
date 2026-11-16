import { useEffect, useRef, useState } from 'react';
import { model } from './model';

const CAP = 2000;

// Appends straight to the DOM: one div per line, no React render per event.
export function Terminal({ status }: { status: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const stickRef = useRef(true);
  stickRef.current = stick;

  useEffect(() => {
    return model.onLines((lines) => {
      const el = box.current;
      if (!el) return;
      const frag = document.createDocumentFragment();
      for (const l of lines) {
        const d = document.createElement('div');
        d.className = `ln ln-${l.tone}`;
        d.textContent = l.text;
        frag.appendChild(d);
      }
      el.appendChild(frag);
      while (el.childElementCount > CAP) el.firstElementChild?.remove();
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
  }, []);

  return (
    <section className="term" aria-label="Agent output">
      <header className="panel-h">
        <h2>Output</h2>
        <span className="muted small">{status}</span>
        <span className="grow" />
        {!stick && <button className="btn sm" onClick={() => { setStick(true); const el = box.current; if (el) el.scrollTop = el.scrollHeight; }}>Jump to latest</button>}
        <button className="btn sm" onClick={() => { if (box.current) box.current.textContent = ''; }}>Clear</button>
      </header>
      <div
        className="term-body"
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          if (atEnd !== stickRef.current) setStick(atEnd);
        }}
      />
    </section>
  );
}
