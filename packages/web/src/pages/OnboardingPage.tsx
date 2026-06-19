import React, { useState, useRef } from 'react';
import { ChevronRight, FolderPlus, FolderOpen } from 'lucide-react';
import type { Project } from '../types';

interface OnboardingPageProps {
  projects: Project[];
  onSelectProject: (name: string) => void;
  onStartScan: (targetPath: string, mockScan: boolean, mockAi: boolean) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  projects,
  onSelectProject,
  onStartScan,
}) => {
  const [targetPath, setTargetPath] = useState('');
  const [mockScan, setMockScan] = useState(false);
  const [mockAi, setMockAi] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const rel = files[0].webkitRelativePath;
      const folderName = rel.split('/')[0];
      if (folderName) {
        setTargetPath(folderName);
      }
    }
    e.target.value = '';
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    await onStartScan(targetPath, mockScan, mockAi);
    setIsScanning(false);
  };

  const formatTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-bg-primary overflow-y-auto relative scrollbar-thin">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent/5 filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-success/5 filter blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl border border-card-border bg-card-bg backdrop-blur-md rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Onboarding Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <h2 className="text-xl font-bold text-text-primary">Select a Project</h2>
          <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
            Choose a previously scanned project from the list, or initiate a new codebase scan below.
          </p>
        </div>

        {/* Existing Projects List */}
        <div className="space-y-2.5 max-h-56 overflow-y-auto p-1 scrollbar-thin">
          {projects.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-6 border border-card-border/40 border-dashed rounded-xl bg-bg-primary/20">
              No projects scanned yet
            </div>
          ) : (
            projects.map((p) => {
              const timestamp = p.latestReport?.timestamp ? formatTime(p.latestReport.timestamp) : 'N/A';
              return (
                <div
                  key={p.name}
                  onClick={() => onSelectProject(p.name)}
                  className="flex items-center justify-between p-4 rounded-xl bg-bg-primary/30 border border-card-border hover:border-text-secondary hover:bg-bg-primary/70 cursor-pointer transition-all group"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                     <span className="font-mono font-bold text-text-primary text-sm truncate">{p.name}</span>
                    <span className="text-xs text-text-tertiary">
                      {p.reportCount} scan(s) • Last scan: {timestamp}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 text-text-tertiary text-xs uppercase font-bold tracking-widest select-none">
          <span className="h-px bg-card-border/70 flex-1" />
          <span>Or Scan a New Project</span>
          <span className="h-px bg-card-border/70 flex-1" />
        </div>

        {/* Scan Form */}
        <form onSubmit={handleScan} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="targetPath" className="text-xs font-semibold text-text-secondary">
              Target Directory Path
            </label>
            <div className="flex gap-2">
              <input
                id="targetPath"
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="e.g. D:\projects\my-app or /home/user/project"
                className="flex-1 min-w-0 bg-bg-primary border border-card-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary font-mono"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-bg-primary border border-card-border rounded-xl text-sm text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all cursor-pointer shrink-0"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Browse</span>
              </button>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Browse selects the folder name as a shortcut; type the full path manually. Browsers
              don't expose the full filesystem path for security reasons.
            </p>
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              onChange={handleFolderSelect}
              {...({ webkitdirectory: '' } as any)}
            />
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-text-secondary font-medium">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mockScan}
                onChange={(e) => setMockScan(e.target.checked)}
                className="h-3.5 w-3.5 border border-card-border bg-bg-primary accent-accent rounded focus:outline-none"
              />
              <span>Mock Scan</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mockAi}
                onChange={(e) => setMockAi(e.target.checked)}
                className="h-3.5 w-3.5 border border-card-border bg-bg-primary accent-accent rounded focus:outline-none"
              />
              <span>Mock AI</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isScanning || !targetPath.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white text-sm font-bold rounded-xl shadow-lg hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            <span>{isScanning ? 'Scanning...' : 'Analyze'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
