#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, basename } from 'path';
import { homedir } from 'node:os';
import { exec } from 'node:child_process';

import { startServer } from '../src/server.js';
import { runPythonAnalysis } from '../src/bridge.js';
import { getProjectName, getProjectReportDir, getReportFilename, updateLatestReportPath } from '../src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Centralized report storage: ~/.vexcode/reports/
const reportsBaseDir = join(homedir(), '.vexcode', 'reports');

let version = '1.0.0';
try {
  const packageJsonPath = join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  version = packageJson.version || version;
} catch {}

const COMMANDS = ['analyze', 'serve', 'ui', 'help'];

const globalOptions = {
  version: { type: 'boolean', short: 'V' },
  help:    { type: 'boolean', short: 'h' },
};

const analyzeOptions = {
  help:        { type: 'boolean', short: 'h' },
  target:      { type: 'string', short: 't' },
  'mock-scan': { type: 'boolean' },
  'mock-ai':   { type: 'boolean' },
};

const serveOptions = {
  help: { type: 'boolean', short: 'h' },
  port: { type: 'string', short: 'p' },
};

function printVersion() {
  console.log(version);
}

function printHelp() {
  console.log(`
AI Code Review CLI v${version}

Usage: vexcode [options] [command]

Options:
  -V, -v, --version              output the version number
  -h, --help                      display help for command

Commands:
  analyze [options]                Analyze a project for vulnerabilities
  serve [options]                 Start local HTTP server for web UI connection
  ui [options]                    Start local HTTP server and open dashboard
  help                            Display help for command
`);
}

function printReport(report) {
  const findings = report.findings || [];
  const resolutions = report.ai_resolutions || {};

  console.log('');
  console.log('='.repeat(70));
  console.log(`  AI Code Review Report`);
  console.log('='.repeat(70));
  console.log(`  Scanner   : ${report.scanner}`);
  console.log(`  Target    : ${report.target_path}`);
  console.log(`  Timestamp : ${report.timestamp}`);
  console.log(`  Findings  : ${findings.length}`);
  console.log('='.repeat(70));

  if (findings.length === 0) {
    console.log('\n  No findings. Code looks clean!\n');
    return;
  }

  const severityIcon = (sev) => {
    switch ((sev || '').toUpperCase()) {
      case 'ERROR':   return '\x1b[31m✖\x1b[0m';
      case 'WARNING': return '\x1b[33m⚠\x1b[0m';
      case 'INFO':    return '\x1b[36mℹ\x1b[0m';
      default:        return '•';
    }
  };

  findings.forEach((f, i) => {
    const icon = severityIcon(f.severity);
    console.log(`\n  [${i + 1}] ${icon} ${f.severity}  ${f.rule_id}`);
    console.log(`      File: ${f.file}`);
    console.log(`      Line: ${f.line}`);
    console.log(`      Msg:  ${f.message}`);

    if (f.ast_context) {
      const ast = f.ast_context;
      console.log(`      AST:  symbol="${ast.symbol_name}" kind=${ast.kind}`);
      if (ast.callers && ast.callers.length > 0) {
        console.log(`            callers: ${ast.callers.map(c => c.name).join(', ')}`);
      }
      if (ast.blast_radius && ast.blast_radius.length > 0) {
        console.log(`            blast radius: ${ast.blast_radius.length} affected symbol(s)`);
      }
    }

    const ruleId = f.rule_id;
    if (resolutions[ruleId]) {
      const res = resolutions[ruleId];
      console.log(`      Fix:  ${res.suggestion}`);
      if (res.remediation_code) {
        console.log(`            --- remediation code ---`);
        res.remediation_code.split('\n').forEach(line => {
          console.log(`            ${line}`);
        });
        console.log(`            --- end ---`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`  Report saved to: ${report._outputPath || '(in memory)'}`);
  console.log('='.repeat(70) + '\n');
}

function parseArgsForCommand(command, rawArgs) {
   const optionDefs = (command === 'serve' || command === 'ui') ? serveOptions : analyzeOptions;
  const { values } = parseArgs({ options: optionDefs, allowPositionals: true, args: rawArgs });
  return values;
}

function printAnalyzeHelp() {
  console.log(`
Usage: vexcode analyze [options]

Analyze a project for security vulnerabilities using Semgrep, enriched with
GitNexus AST context and AI-powered remediation suggestions.

Options:
  -t, --target <path>     Target directory to analyze (default: current dir)
      --mock-scan         Use mock scan findings (skip Semgrep)
      --mock-ai           Use mock AI suggestions (skip 9router API)

Examples:
  vexcode analyze --target ./my-project
  vexcode analyze -t D:/src/my-app
  vexcode analyze --mock-scan --mock-ai
`);
}

function printServeHelp() {
  console.log(`
Usage: vexcode serve [options]

Start local HTTP server for web UI connection.

Options:
  -p, --port <number>     Port for Express server (default: 3000)

Examples:
  vexcode serve
  vexcode serve --port 8080
`);
}

async function handleAnalyze(rawArgs) {
  const values = parseArgsForCommand('analyze', rawArgs);

  if (values.help) {
    printAnalyzeHelp();
    process.exit(0);
  }

  const targetPath = resolve(values.target || '.');
  const mockScan = !!values['mock-scan'];
  const mockAi = !!values['mock-ai'];

  // Pre-flight validation: fail fast before spawning Python
  try {
    if (!statSync(targetPath).isDirectory()) {
      console.error(`\x1b[31mError:\x1b[0m --target expects a directory, but '${targetPath}' is not a directory.`);
      process.exit(1);
    }
  } catch {
    console.error(`\x1b[31mError:\x1b[0m Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  // Generate report path in centralized storage
  const projectName = getProjectName(targetPath);
  const projectDir = getProjectReportDir(projectName);
  mkdirSync(projectDir, { recursive: true });
  const reportFilename = getReportFilename();
  const outputPath = join(projectDir, reportFilename);

  console.log(`\nScanning target: ${targetPath}`);
  console.log(`Project:        ${projectName}`);
  if (mockScan) console.log('  (mock scan enabled)');
  if (mockAi)   console.log('  (mock AI enabled)');
  console.log('');

  try {
    await runPythonAnalysis(targetPath, outputPath, mockScan, mockAi);

    // Track latest report path
    updateLatestReportPath(outputPath);

    // Read the saved report
    const reportContent = JSON.parse(readFileSync(outputPath, 'utf8'));
    reportContent._outputPath = outputPath;
    reportContent._project = projectName;
    reportContent._id = reportFilename.replace('.json', '');

    printReport(reportContent);
  } catch (err) {
    console.error(`\x1b[31mScan failed:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

function handleServe(rawArgs) {
  const values = parseArgsForCommand('serve', rawArgs);

  if (values.help) {
    printServeHelp();
    process.exit(0);
  }

  const port = values.port ? parseInt(values.port, 10) : 3000;
  if (isNaN(port) || port <= 0 || port > 65535) {
    console.error(`Error: Invalid port number: ${values.port}`);
    process.exit(1);
  }
  startServer(port);

  // Auto-open browser in non-test environment
  if (process.env.NODE_ENV !== 'test' && process.env.TEST_SKIP_BROWSER !== 'true') {
    const url = `http://localhost:${port}`;
    let openCmd = '';
    switch (process.platform) {
      case 'win32':
        openCmd = `start ${url}`;
        break;
      case 'darwin':
        openCmd = `open ${url}`;
        break;
      default:
        openCmd = `xdg-open ${url}`;
        break;
    }
    console.log(`Opening dashboard: ${url}`);
    exec(openCmd, (err) => {
      if (err) {
        console.error(`Failed to auto-open browser: ${err.message}`);
      }
    });
  }
}

// --- Main ---
const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

if (!command || command === 'help') {
  printHelp();
  process.exit(0);
}

if (command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === '--version' || command === '-V' || command === '-v') {
  printVersion();
  process.exit(0);
}

if (command === '--ui' || command === '--server' || command === '-s') {
  handleServe(commandArgs);
} else if (!COMMANDS.includes(command)) {
  console.error(`Error: Unknown command "${command}"`);
  console.log('Run "vexcode help" for usage information.');
  process.exit(1);
} else if (command === 'analyze') {
  await handleAnalyze(commandArgs);
} else if (command === 'serve' || command === 'ui') {
  handleServe(commandArgs);
}
