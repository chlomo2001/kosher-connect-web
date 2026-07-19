import { useState } from 'react'

// File intake for the /tools pages — a proper click-or-drop zone instead of
// the browser's raw "Choose file" widget sitting inline with the heading.
// The real <input type="file"> stays in the tree (visually hidden, still
// keyboard-focusable) so htmlFor/aria wiring keeps working; drag-and-drop
// feeds the same onFiles callback.
export default function ToolDrop({ id, multiple, accept, main, sub, describedBy, onFiles }) {
  const [over, setOver] = useState(false)
  const fire = (list) => {
    const files = [...(list || [])]
    if (files.length) onFiles(files)
  }
  return (
    <label
      className={'tool-drop' + (over ? ' dragover' : '')}
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); fire(e.dataTransfer.files) }}
    >
      <span className="tool-drop-icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 9 12 4 17 9" />
          <line x1="12" y1="4" x2="12" y2="16" />
        </svg>
      </span>
      <span className="tool-drop-main">{main}</span>
      {sub && <span className="tool-drop-sub">{sub}</span>}
      <input
        id={id}
        className="tool-drop-input"
        type="file"
        multiple={multiple}
        accept={accept}
        aria-describedby={describedBy}
        onChange={(e) => { fire(e.target.files); e.target.value = '' }}
      />
    </label>
  )
}
