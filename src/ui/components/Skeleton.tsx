import React from 'react';

type SkeletonVariant = 'text' | 'paragraph' | 'avatar' | 'card';

interface Props {
  variant?: SkeletonVariant;
  className?: string;
  lines?: number;
}

export function Skeleton({ variant = 'text', className = '', lines = 3 }: Props) {
  switch (variant) {
    case 'avatar':
      return <div className={`skeleton-base w-10 h-10 rounded-full ${className}`} />;

    case 'card':
      return (
        <div className={`skeleton-base w-full h-24 rounded-xl ${className}`} />
      );

    case 'paragraph':
      return (
        <div className={`space-y-2 ${className}`}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="skeleton-base h-3 rounded"
              style={{ width: i === lines - 1 ? '60%' : i === 0 ? '100%' : '85%' }}
            />
          ))}
        </div>
      );

    case 'text':
    default:
      return <div className={`skeleton-base h-3 rounded w-full ${className}`} />;
  }
}
