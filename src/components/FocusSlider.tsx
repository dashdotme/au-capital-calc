import { useState, useRef, useEffect } from 'react';
import { formatCompactValue } from '../utils/focusRanges';

interface FocusSliderProps {
  values: number[];
  onChange: (values: number[]) => void;
  unit: string;
  min?: number;
  max?: number;
}

export default function FocusSlider({
  values,
  onChange,
  unit,
  min = 0,
  max = 15,
}: FocusSliderProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (index: number) => {
    setDraggingIndex(index);
  };

  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sliderRef.current || draggingIndex === null) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newValue = min + percentage * (max - min);

      const newValues = [...values];
      newValues[draggingIndex] = Math.round(newValue * 100) / 100;

      // Ensure handles don't cross each other
      if (draggingIndex > 0 && newValues[draggingIndex] < newValues[draggingIndex - 1]) {
        newValues[draggingIndex] = newValues[draggingIndex - 1];
      }
      if (draggingIndex < 4 && newValues[draggingIndex] > newValues[draggingIndex + 1]) {
        newValues[draggingIndex] = newValues[draggingIndex + 1];
      }

      onChange(newValues);
    };

    const handleMouseUp = () => {
      setDraggingIndex(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIndex, values, min, max, onChange]);

  const getPosition = (value: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  return (
    <div className="mb-6">
      <div
        ref={sliderRef}
        className="relative h-2 bg-gray-700 rounded-full cursor-pointer"
      >
        {/* Track */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 opacity-30 rounded-full" />

        {/* Handles */}
        {values.map((value, index) => (
          <div
            key={index}
            onMouseDown={() => handleMouseDown(index)}
            style={{
              left: `${getPosition(value)}%`,
              backgroundColor: colors[index],
            }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full cursor-grab active:cursor-grabbing shadow-lg border-2 border-white transition-transform hover:scale-110"
          />
        ))}
      </div>

      {/* Labels */}
      <div className="relative h-16 mt-2">
        {values.map((value, index) => (
          <div
            key={index}
            style={{
              left: `${getPosition(value)}%`,
              color: colors[index],
              transform: 'translateX(-50%) rotate(-30deg)',
              transformOrigin: 'center top',
            }}
            className="absolute text-xs font-semibold whitespace-nowrap"
          >
            {formatCompactValue(value, unit)}
          </div>
        ))}
      </div>
    </div>
  );
}
