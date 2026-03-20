import React, { useRef, useEffect, useImperativeHandle, forwardRef, KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxHeight?: number;
}

export interface InputHandle {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
}

export const Input = forwardRef<InputHandle, Props>(function Input(
  { value, onChange, onSubmit, placeholder = 'Message Autensa...', disabled, autoFocus, maxHeight },
  fwdRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(fwdRef, () => ({
    focus: () => ref.current?.focus(),
    blur: () => ref.current?.blur(),
    isFocused: () => document.activeElement === ref.current,
  }));

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      const limit = maxHeight && maxHeight > 44 ? maxHeight : 120;
      ref.current.style.height = Math.min(ref.current.scrollHeight, limit) + 'px';
    }
  }, [value, maxHeight]);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="input-base resize-none pr-12 min-h-[44px]"
        style={{ transition: 'height 150ms ease' }}
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim() || disabled}
        className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center
                   rounded-lg bg-accent text-white transition-all duration-150
                   hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent
                   active:scale-90
                   outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
});
