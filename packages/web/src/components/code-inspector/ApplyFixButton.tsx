import React from 'react';
import { Check } from 'lucide-react';

interface ApplyFixButtonProps {
  hasRemediation: boolean;
  isApplied: boolean;
  isApplying: boolean;
  onApply: () => void;
}

export const ApplyFixButton: React.FC<ApplyFixButtonProps> = ({
  hasRemediation,
  isApplied,
  isApplying,
  onApply,
}) => {
  if (!hasRemediation || isApplied) {
    return null;
  }

  return (
    <button
      onClick={onApply}
      disabled={isApplying}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:bg-success-hover text-white text-xs font-semibold rounded-lg shadow-md hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
    >
      <Check className="h-3.5 w-3.5" />
      <span>{isApplying ? 'Applying Fix...' : 'Apply Fix'}</span>
    </button>
  );
};