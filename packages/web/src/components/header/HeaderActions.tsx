import React from 'react';
import { Settings } from 'lucide-react';

export interface HeaderActionsProps {
  onOpenSettings: () => void;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({ onOpenSettings }) => {
  return (
    <button
      onClick={onOpenSettings}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-card-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
      title="Settings"
    >
      <Settings className="h-4.5 w-4.5" />
    </button>
  );
};
