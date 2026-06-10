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
    <div className="flex justify-end pt-2">
      <button
        onClick={onApply}
        disabled={isApplying}
        className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-white text-xs font-semibold rounded-lg shadow-lg hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        <Check className="h-4 w-4" />
        <span>{isApplying ? 'Applying Fix...' : 'Apply Fix'}</span>
      </button>
    </div>
  );
};