import React, { useState, useRef, useEffect } from 'react';

/**
 * Accessible, tactile Swipe-to-Confirm component.
 * Works seamlessly with touch, mouse drag, and keyboard Enter/Space.
 */
export default function SwipeToConfirm({ onConfirm, disabled = false, label = 'Swipe to Finalize Bill ➔' }) {
  const [dragProgress, setDragProgress] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);

  const maxDrag = 240; // Max drag distance in pixels

  const handleStart = (clientX) => {
    if (disabled || isSwiped) return;
    isDraggingRef.current = true;
    startXRef.current = clientX;
  };

  const handleMove = (clientX) => {
    if (!isDraggingRef.current || isSwiped) return;
    const diff = clientX - startXRef.current;
    if (diff <= 0) {
      setDragProgress(0);
    } else if (diff >= maxDrag) {
      setDragProgress(maxDrag);
    } else {
      setDragProgress(diff);
    }
  };

  const handleEnd = () => {
    if (!isDraggingRef.current || isSwiped) return;
    isDraggingRef.current = false;

    if (dragProgress >= maxDrag * 0.85) {
      setDragProgress(maxDrag);
      setIsSwiped(true);
      if (onConfirm) onConfirm();
    } else {
      setDragProgress(0);
    }
  };

  // Global listeners for mouse move and touch
  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => handleEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragProgress, isSwiped]);

  return (
    <div style={{ width: '100%', marginBottom: 12 }}>
      <div
        ref={trackRef}
        className={`swipe-track ${isSwiped ? 'swipe-track-active' : ''}`}
        style={{
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          className="swipe-thumb"
          style={{
            transform: `translateX(${dragProgress}px)`,
            backgroundColor: isSwiped ? '#0f7b5f' : 'var(--color-success)',
          }}
          onMouseDown={(e) => handleStart(e.clientX)}
          onTouchStart={(e) => {
            if (e.touches.length > 0) handleStart(e.touches[0].clientX);
          }}
          role="slider"
          aria-valuenow={Math.round((dragProgress / maxDrag) * 100)}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled && !isSwiped) {
                setIsSwiped(true);
                setDragProgress(maxDrag);
                if (onConfirm) onConfirm();
              }
            }
          }}
        >
          {isSwiped ? '✓' : '➔'}
        </div>

        <div
          className="swipe-text"
          style={{
            opacity: Math.max(0, 1 - (dragProgress / maxDrag) * 1.5),
            color: isSwiped ? '#0f7b5f' : 'var(--color-text-muted)',
          }}
        >
          {isSwiped ? 'Finalized!' : label}
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        Drag slider to lock & generate link
      </div>
    </div>
  );
}
