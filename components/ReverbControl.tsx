
import React from 'react';

interface ReverbControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}

const ReverbControl: React.FC<ReverbControlProps> = ({ label, value, min, max, step, unit = "", onChange }) => {
  return (
    <div className="flex flex-col items-center space-y-2 p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-emerald-500 transition-colors">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="relative group">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>
      <span className="text-sm font-mono text-emerald-400">
        {value.toFixed(2)}{unit}
      </span>
    </div>
  );
};

export default ReverbControl;
