import React from 'react';

interface Props {
  text: string;
}

export function StreamingText({ text }: Props) {
  if (!text) return null;

  return (
    <div className="text-text-primary text-base leading-relaxed whitespace-pre-wrap">
      {text}
      <span className="inline-block w-[2px] h-[1.1em] bg-accent ml-0.5 align-text-bottom animate-pulse-soft" />
    </div>
  );
}
