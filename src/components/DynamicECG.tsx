'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

type RhythmType = 'unknown' | 'vf' | 'vt' | 'asystole' | 'pea' | 'bradycardia' | 'svt' | 'a_fib' | 'a_flutter' | 'torsades' | 'rosc' | 'stable_vt' | 'sinus';

interface DynamicECGProps {
  rhythm: RhythmType;
  height?: number;
  color?: string;
  speed?: number; // Wave speed control
}

export function DynamicECG({ rhythm, height = 120, color = "#22c55e", speed = 0.6 }: DynamicECGProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const pointsRef = useRef<number[]>(Array(400).fill(50));
  const phaseRef = useRef(0);
  const requestRef = useRef<number>(0);

  // Generate the next point based on rhythm type
  const getNextPoint = (currentType: RhythmType, phase: number) => {
    const base = 50;

    switch (currentType) {
      case 'asystole':
        return base + (Math.random() - 0.5) * 1.2;

      case 'vf':
      case 'torsades':
        return base + (Math.random() - 0.5) * 35;

      case 'vt':
      case 'stable_vt': {
        const vtPhase = phase % 20;
        const sineValue = Math.sin((vtPhase / 20) * Math.PI * 2) * 35;
        return base + sineValue + (Math.random() - 0.5) * 1.5;
      }

      case 'bradycardia':
      default: {
        // Cycle scales with base speed logic internally
        const cycle = currentType === 'bradycardia' ? 250 : (currentType === 'svt' ? 40 : 80);
        const p = Math.floor(phase) % cycle;

        // 1. P-Wave
        if (p >= 10 && p <= 30) {
          return base - Math.sin(((p - 10) / 20) * Math.PI) * 6;
        }

        // 2. QRS Complex
        if (p >= 34 && p <= 38) {
          if (p === 34) return base + 4;
          if (p === 35) return base - 10;
          if (p === 36) return base - 45; // R peak
          if (p === 37) return base + 15; // S peak
          if (p === 38) return base + 5;
        }

        // 3. T-Wave
        if (p >= 50 && p <= 80) {
          return base - Math.sin(((p - 50) / 30) * Math.PI) * 10;
        }

        return base + (Math.random() - 0.5) * 0.8;
      }
    }
  };

  const animate = () => {
    // Generate new point
    phaseRef.current += speed; // Use the speed prop here
    const newPoint = getNextPoint(rhythm, phaseRef.current);

    // Update ref buffer
    pointsRef.current.push(newPoint);
    pointsRef.current.shift();

    // Directly update SVG path string via DOM for 60FPS performance
    if (pathRef.current) {
      const d = pointsRef.current.reduce((acc, p, i) => {
        return acc + (i === 0 ? "M" : " L") + " " + i + " " + p;
      }, "");
      pathRef.current.setAttribute("d", d);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [rhythm, speed]); // Re-run effect if speed changes

  return (
    <div className="w-full overflow-hidden bg-black/40 rounded flex items-center">
      <svg
        viewBox="0 0 400 100"
        className="w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        <path
          ref={pathRef}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]"
        />
      </svg>
    </div>
  );
}
