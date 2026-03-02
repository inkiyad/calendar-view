import React, { useState } from 'react';
import { getEmbedCode } from './embed';

function EmbedCode() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(getEmbedCode()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="embed-panel">
      <h2>Embed This Calendar</h2>
      <p className="embed-subtitle">Copy and paste this code into any website to display your calendar.</p>
      <div className="embed-code-box">
        <textarea
          className="embed-textarea"
          readOnly
          value={getEmbedCode()}
        />
      </div>
      <button
        className={`embed-copy-btn${copied ? ' copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy Code'}
      </button>
    </div>
  );
}

export default EmbedCode;
