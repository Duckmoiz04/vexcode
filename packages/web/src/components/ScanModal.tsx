import React from 'react';

interface ScanModalProps {
  isScanning: boolean;
  scanStatus: string;
  elapsedTime: number;
  scanLogs: string[];
  onCancelScan: () => void;
}

const getStepStatus = (stepIndex: number, statusText: string) => {
  const txt = (statusText || '').toLowerCase();
  
  // Step index mappings:
  // 0: Static Security Scan (Semgrep)
  // 1: AST Structural Analysis (GitNexus)
  // 2: Complexity Metrics (Lizard)
  // 3: Obscure Naming Audit (AI)
  // 4: Generate Fix Suggestions (9router AI)
  // 5: Package & Save Report
  
  let currentStep = 0;
  if (txt.includes('gitnexus') || txt.includes('ast context') || txt.includes('enriching')) {
    currentStep = 1;
  } else if (txt.includes('lizard') || txt.includes('complexity')) {
    currentStep = 2;
  } else if (txt.includes('naming quality') || txt.includes('naming audit')) {
    currentStep = 3;
  } else if (txt.includes('resolving findings') || txt.includes('ai resolutions') || txt.includes('using mock ai')) {
    currentStep = 4;
  } else if (txt.includes('writing report') || txt.includes('executed successfully')) {
    currentStep = 5;
  }
  
  if (currentStep > stepIndex) return 'completed';
  if (currentStep === stepIndex) return 'active';
  return 'pending';
};

const scanSteps = [
  { label: 'Static Security Scan (Semgrep)', desc: 'Identify vulnerabilities & secrets' },
  { label: 'AST Structural Analysis (GitNexus)', desc: 'Construct call graph & blast radius' },
  { label: 'Calculate Complexity Metrics (Lizard)', desc: 'Measure Cyclomatic complexity & LOC' },
  { label: 'Audit Obscure Naming (AI)', desc: 'Evaluate symbol naming semantics' },
  { label: 'Generate Fix Suggestions (9router AI)', desc: 'Generate context-aware remediation code' },
  { label: 'Package & Save Report', desc: 'Synchronize analysis results' }
];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ScanModal: React.FC<ScanModalProps> = ({
  isScanning,
  scanStatus,
  elapsedTime,
  scanLogs,
  onCancelScan,
}) => {
  if (!isScanning) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-bg-secondary/95 border border-card-border/80 rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,149,255,0.15)] p-8 flex flex-col gap-6 animate-slide-up glass">
        
        {/* Modal Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-6 w-6 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/20 opacity-75"></span>
                <svg className="relative h-5 w-5 text-accent animate-spin" style={{ animationDuration: '4s' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
                Analysis Progress
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                scanStatus.toLowerCase().includes('fast')
                  ? 'bg-success/10 border-success/35 text-success'
                  : 'bg-accent/10 border-accent/35 text-accent'
              }`}>
                {scanStatus.toLowerCase().includes('fast') ? 'FAST SCAN' : 'FULL SCAN'}
              </span>
              <span className="text-[11px] text-text-secondary font-mono bg-bg-primary/80 px-2.5 py-0.5 rounded border border-card-border/60 font-semibold flex items-center gap-1.5 shadow-inner">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Steps Checklist */}
        <div className="space-y-3 py-3 border-y border-card-border/30">
          {scanSteps.map((step, idx) => {
            const status = getStepStatus(idx, scanStatus);
            return (
              <div 
                key={idx} 
                className={`flex items-start gap-4 p-2.5 rounded-xl border transition-all duration-300 ${
                  status === 'active' 
                    ? 'bg-accent/5 border-accent/25 shadow-[0_0_15px_rgba(0,149,255,0.03)]' 
                    : status === 'completed' 
                    ? 'bg-success/5 border-success/10' 
                    : 'border-transparent bg-transparent opacity-40'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {status === 'completed' ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 border border-success/40 text-success text-[10px] font-bold shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                      ✓
                    </div>
                  ) : status === 'active' ? (
                    <div className="relative flex h-5 w-5 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-accent/30 opacity-75"></span>
                      <div className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-card-border bg-bg-primary/40 border-dashed" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-semibold leading-none ${
                    status === 'active' 
                      ? 'text-accent font-bold' 
                      : status === 'completed' 
                      ? 'text-text-primary' 
                      : 'text-text-secondary/70'
                  }`}>
                    {step.label}
                  </span>
                  <span className={`text-[10px] mt-1.5 leading-none ${
                    status === 'active' ? 'text-text-secondary' : 'text-text-tertiary'
                  }`}>
                    {step.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Terminal Logs View */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Log Console (Terminal)
            </span>
            <span className="text-[8px] font-mono text-text-tertiary">Real-time SSE Stream</span>
          </div>
          <div className="font-mono text-[10px] text-left text-success bg-black/95 border border-card-border/60 p-3.5 rounded-xl h-24 overflow-y-auto scrollbar-thin select-text flex flex-col gap-1 shadow-inner">
            {scanLogs.map((log, lIdx) => (
              <div key={lIdx} className={`truncate ${lIdx === scanLogs.length - 1 ? 'text-cyan-400 font-semibold' : 'opacity-60'}`}>
                <span className="text-text-tertiary select-none mr-2">&gt;</span>
                {log}
                {lIdx === scanLogs.length - 1 && <span className="animate-pulse ml-0.5">_</span>}
              </div>
            ))}
            {scanLogs.length === 0 && (
              <div className="text-text-tertiary italic">Waiting for logs...</div>
            )}
          </div>
        </div>

        {/* Cancel Button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onCancelScan}
            className="px-5 py-2 bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 text-xs font-semibold rounded-lg shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Scan
          </button>
        </div>
      </div>
    </div>
  );
};
