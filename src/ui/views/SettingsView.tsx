import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { ApiProvider } from '@/shared/types';

interface Props {
  onBack: () => void;
}

export function SettingsView({ onBack }: Props) {
  const { settings, updateSettings, loading } = useSettings();
  const [saved, setSaved] = useState(false);

  const handleChange = async (key: string, value: string) => {
    await updateSettings({ [key]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) return <div className="p-6 text-text-tertiary text-sm">Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <button onClick={onBack} className="btn-ghost !p-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-text-primary">Settings</span>
        {saved && <span className="text-xs text-success ml-auto animate-fade-in">Saved</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Provider Toggle */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">AI Provider</label>
          <div className="flex gap-2">
            {(['ollama', 'claude'] as ApiProvider[]).map(p => (
              <button
                key={p}
                onClick={() => handleChange('provider', p)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  settings.provider === p
                    ? 'bg-accent text-white'
                    : 'bg-surface-3 text-text-secondary hover:text-text-primary'
                }`}
              >
                {p === 'ollama' ? 'Ollama / Custom' : 'Claude API'}
              </button>
            ))}
          </div>
        </div>

        {/* Ollama Settings */}
        {settings.provider === 'ollama' && (
          <>
            <SettingField
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
                  className={`text-2xs px-2.5 py-1 rounded-md transition-all ${
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

function SettingField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={type === 'password' && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-base !py-2 !text-sm pr-10"
        />
        {type === 'password' && (
          <button
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost !p-1"
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
}
