import React, { useState } from 'react';
import { getEmbedCode } from './embed';

function EmbedCode() {
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const embedCode = getEmbedCode({ darkMode });

  function handleCopy() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="embed-panel">
      <h2>Embed This Calendar</h2>
      <p className="embed-subtitle">Copy and paste this code into any website to display your calendar.</p>
      
      <div className="embed-options">
        <label className="embed-option">
          <input 
            type="checkbox" 
            checked={darkMode} 
            onChange={(e) => setDarkMode(e.target.checked)}
          />
          <span>Dark Mode</span>
        </label>
      </div>

      <div className="embed-code-box">
        <textarea
          className="embed-textarea"
          readOnly
          value={embedCode}
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
