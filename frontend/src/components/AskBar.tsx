import { useState, type KeyboardEvent } from 'react';

interface Props {
  onAsk: (question: string) => void;
  disabled: boolean;
}

/** The primary research input. Enter submits; Shift+Enter adds a newline. */
export function AskBar({ onAsk, disabled }: Props) {
  const [value, setValue] = useState('');

  const submit = () => {
    const q = value.trim();
    if (!q || disabled) return;
    onAsk(q);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="ask-bar">
      <textarea
        className="ask-input"
        placeholder="Ask a research question… e.g. “How is the EV battery supply chain evolving?”"
        value={value}
        rows={1}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button className="ask-button" onClick={submit} disabled={disabled || !value.trim()}>
        {disabled ? 'Researching…' : 'Research'}
      </button>
    </div>
  );
}
