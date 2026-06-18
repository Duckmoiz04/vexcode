import React from 'react';

export interface SemgrepSectionProps {
  semgrepRules: string;
  onSemgrepRulesChange: (value: string) => void;
}

export const SemgrepSection: React.FC<SemgrepSectionProps> = ({
  semgrepRules,
  onSemgrepRulesChange,
}) => {
  return (
    <div className="space-y-2 border-t border-card-border/50 pt-4">
      <h4 className="text-base text-text-primary/90 font-medium tracking-wider mb-8">Semgrep</h4>
      <div className="space-y-1">
        <label htmlFor="settings-semgrep-rules" className="text-[13px] text-text-secondary font-medium">Rules Path</label>
        <input
          id="settings-semgrep-rules"
          type="text"
          value={semgrepRules}
          onChange={(e) => onSemgrepRulesChange(e.target.value)}
          placeholder="Optional rules file path"
          className="w-full bg-bg-primary border border-card-border rounded-md px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
        />
      </div>
    </div>
  );
};