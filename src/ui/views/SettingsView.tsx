import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { ApiProvider, ThemeMode } from '@/shared/types';
import { MOD_KEY } from '../hooks/useKeyboardNav';

interface Props {
  onBack: () => void;
}

export function SettingsView({ onBack }: Props) {
  const { settings, updateSettings, loading } = useSettings();
  const { mode: themeMode, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Auto-focus first field on mount
  useEffect(() => {
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Escape to go back (handled by global hook, but also local for safety)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onBack]);

  const handleChange = async (key: string, value: string) => {
    await updateSettings({ [key]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) return <div className="p-6 text-text-tertiary text-sm">Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <button onClick={onBack} className="btn-ghost !p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 group/hint relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-2xs text-text-tertiary opacity-0 group-hover/hint:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Esc
          </span>
        </button>
        <span className="text-sm font-semibold text-text-primary">Settings</span>
        <span className="text-2xs text-text-tertiary ml-auto">
          {MOD_KEY}, to toggle
        </span>
        {saved && <span className="text-xs text-success ml-2 animate-fade-in">Saved</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Provider Toggle */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">AI Provider</label>
          <div className="provider-toggle-group">
            <div
              className="provider-toggle-slider"
              style={{
                left: settings.provider === 'ollama' ? '2px' : '50%',
                width: 'calc(50% - 2px)',
              }}
            />
            {(['ollama', 'claude'] as ApiProvider[]).map(p => (
              <button
                key={p}
                onClick={() => handleChange('provider', p)}
                className={`provider-toggle-btn outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  settings.provider === p ? 'provider-toggle-btn-active' : ''
                }`}
              >
                {p === 'ollama' ? 'Ollama / Custom' : 'Claude API'}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Toggle */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">Theme</label>
          <div className="theme-toggle-group">
            <div
              className="theme-toggle-slider"
              style={{
                left: themeMode === 'light' ? '2px' : themeMode === 'system' ? 'calc(33.333% + 0px)' : 'calc(66.666%)',
                width: 'calc(33.333% - 2px)',
              }}
            />
            {([
              { value: 'light' as ThemeMode, label: '\u2600\uFE0F Light' },
              { value: 'system' as ThemeMode, label: '\uD83D\uDCBB System' },
              { value: 'dark' as ThemeMode, label: '\uD83C\uDF19 Dark' },
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`theme-toggle-btn outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  themeMode === value ? 'theme-toggle-btn-active' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Ollama Settings */}
        {settings.provider === 'ollama' && (
          <>
            <SettingField
              ref={firstFieldRef}
              label="Ollama Endpoint"
              value={settings.ollamaEndpoint}
              onChange={v => handleChange('ollamaEndpoint', v)}
              placeholder="http://sai.sharedllm.com/v1"
            />
            <SettingField
              label="Model"
              value={settings.model}
              onChange={v => handleChange('model', v)}
              placeholder="gpt-oss:120b"
            />
            <div className="flex gap-1.5 flex-wrap">
              {['gpt-oss:120b', 'gpt-oss:20b', 'qwen2.5:3b'].map(m => (
                <button
                  key={m}
                  onClick={() => handleChange('model', m)}
                  className={`text-2xs px-2.5 py-1 rounded-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    settings.model === m
                      ? 'bg-accent/20 text-accent'
                      : 'bg-surface-3 text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Claude Settings */}
        {settings.provider === 'claude' && (
          <>
            <SettingField
              ref={firstFieldRef}
              label="Claude API Key"
              value={settings.claudeApiKey}
              onChange={v => handleChange('claudeApiKey', v)}
              placeholder="sk-ant-..."
              type="password"
            />
            <SettingField
              label="Model"
              value={settings.model}
              onChange={v => handleChange('model', v)}
              placeholder="claude-sonnet-4-20250514"
            />
          </>
        )}

        <div className="pt-2 border-t border-border" />

        <SettingField
          label="GitHub Token"
          value={settings.githubToken}
          onChange={v => handleChange('githubToken', v)}
          placeholder="ghp_..."
          type="password"
        />
        <SettingField
          label="Vercel Token"
          value={settings.vercelToken}
          onChange={v => handleChange('vercelToken', v)}
          placeholder="..."
          type="password"
        />

        <div className="pt-3 border-t border-border">
          <p className="text-2xs text-text-tertiary">
            Keys are stored locally on your device. Ollama endpoint requires no API key.
          </p>
        </div>
      </div>
    </div>
  );
}

const SettingField = React.forwardRef<HTMLInputElement, {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}>(function SettingField({ label, value, onChange, placeholder, type = 'text' }, ref) {
  const [show, setShow] = useState(false);
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = ref || localRef;

  // Prevent Enter from doing anything unexpected in settings fields
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to next focusable element
      const form = (e.target as HTMLElement).closest('.overflow-y-auto');
      if (form) {
        const focusable = form.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        );
        const arr = Array.from(focusable);
        const idx = arr.indexOf(e.target as HTMLElement);
        if (idx >= 0 && idx < arr.length - 1) {
          arr[idx + 1].focus();
        }
      }
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={type === 'password' && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input-base !py-2 !text-sm pr-10"
        />
        {type === 'password' && (
          <button
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost !p-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            tabIndex={-1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {show ? (
                <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              ) : (
                <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
              )}
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
