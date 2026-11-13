import React from 'react';

export interface ConfettiBurst {
  id: number;
  count: number;
}

interface ConfettiOverlayProps {
  burst: ConfettiBurst | null;
}

const COLORS = ['#0D9488', '#D97706', '#0284C7', '#E11D48', '#16A34A', '#7C3AED', '#F59E0B'];

export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({ burst }) => {
  if (!burst) return null;

  const pieces = Array.from({ length: burst.count }, (_, idx) => {
    const left = ((idx * 37 + burst.id * 13) % 96) + 2;
    const duration = 1.4 + ((idx * 19) % 14) / 10;
    const delay = ((idx * 7) % 25) / 100;
    const size = 8 + (idx % 6);
    const color = COLORS[idx % COLORS.length];
    return { idx, left, duration, delay, size, color };
  });

  return (
    <div
      key={burst.id}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p) => (
        <div
          key={p.idx}
          className="confetti-fall absolute -top-5 rounded-sm"
          style={{
            left: `${p.left}vw`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};
