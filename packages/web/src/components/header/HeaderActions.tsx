import React from 'react';
import { Settings, Sun, Moon } from 'lucide-react';

export interface HeaderActionsProps {
  onOpenSettings: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({ onOpenSettings, theme, onToggleTheme }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-card-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all cursor-pointer"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? (
          <Sun className="h-4.5 w-4.5" />
        ) : (
          <Moon className="h-4.5 w-4.5" />
        )}
      </button>
      <button
        onClick={onOpenSettings}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-card-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all cursor-pointer"
        title="Settings"
      >
        <Settings className="h-4.5 w-4.5" />
      </button>
    </div>
  );
};
