import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Mail bodies are third-party HTML, so they are never injected into this
 * document. They render inside a sandboxed iframe: `allow-scripts` is
 * deliberately omitted so nothing in a message can execute, while
 * `allow-same-origin` is kept purely so the frame can be measured and
 * auto-sized from here. `allow-popups` lets links open in a new tab.
 */
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

const FRAME_STYLES = `
  <style>
    html, body { margin: 0; padding: 0; }
    body {
      font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    a { color: #2563eb; }
    img { max-width: 100%; height: auto; }
    blockquote {
      margin: 12px 0;
      padding-left: 16px;
      border-left: 2px solid #cbd5e1;
      color: #475569;
    }
    pre { overflow-x: auto; background: #f1f5f9; padding: 12px; border-radius: 8px; }
    table { max-width: 100%; }
  </style>
`;

export default function MailBodyFrame({ html, text }) {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(120);

  const body = html || `<pre style="white-space:pre-wrap;font:inherit">${escapeText(text)}</pre>`;
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${FRAME_STYLES}</head><body>${body}</body></html>`;

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.body) return;
    setHeight(Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 40) + 8);
  }, []);

  // Images finishing later change the height, so keep watching after load.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const doc = frame.contentDocument;
    if (!doc?.body || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(doc.body);
    return () => observer.disconnect();
  }, [measure, srcDoc]);

  return (
    <iframe
      ref={frameRef}
      title="Message body"
      sandbox={SANDBOX}
      srcDoc={srcDoc}
      onLoad={measure}
      className="w-full border-0"
      style={{ height: `${height}px` }}
    />
  );
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
