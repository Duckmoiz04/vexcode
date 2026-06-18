import React from 'react';
import { Palette } from 'lucide-react';
import { themeRegistry, type ThemeDefinition } from '../../utils/themes.ts';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ThemePickerProps {
  current: ThemeDefinition;
  onChange: (theme: ThemeDefinition) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const ThemePicker: React.FC<ThemePickerProps> = ({ current, onChange }) => {
  return (
    <div className="flex items-center gap-1.5">
      <Palette size={12} className="text-text-tertiary" />
      <select
        value={current.id}
        onChange={(e) => {
          const next = themeRegistry.find((t) => t.id === e.target.value);
          if (next) onChange(next);
        }}
        className="appearance-none bg-bg-tertiary/50 border border-card-border/30 rounded-md px-2 py-0.5 pr-5 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:bg-bg-tertiary hover:text-text-primary transition-colors focus:outline-none focus:border-accent/50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 4px center',
          backgroundSize: '8px',
        }}
      >
        {themeRegistry.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
};
