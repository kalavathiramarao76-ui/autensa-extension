import React, { useCallback, useRef, useEffect } from 'react';

interface ResizeHandleProps {
  onResize: (deltaY: number) => void;
  onDoubleClick: () => void;
}

export function ResizeHandle({ onResize, onDoubleClick }: ResizeHandleProps) {
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const handleRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastY.current = e.clientY;
    handleRef.current?.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    handleRef.current?.setAttribute('data-dragging', 'true');
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = lastY.current - e.clientY; // positive = dragging up = bigger input
    lastY.current = e.clientY;
    if (Math.abs(delta) > 0) {
      onResize(delta);
    }
  }, [onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    handleRef.current?.releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handleRef.current?.removeAttribute('data-dragging');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return (
    <div
      ref={handleRef}
      className="resize-handle-zone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize input area"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); onResize(8); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onResize(-8); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDoubleClick(); }
      }}
    >
      <div className="resize-handle-pill" />
    </div>
  );
}
