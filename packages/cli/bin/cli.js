#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, basename } from 'path';
import { homedir } from 'node:os';
import { exec } from 'node:child_process';

import { startServer } from '../src/server.js';
import { runPythonAnalysis, runRefreshAi } from '../src/bridge.js';
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

const COMMANDS = ['analyze', 'serve', 'version'];

const globalOptions = {
  version: { type: 'boolean', short: 'v' },
  help:    { type: 'boolean', short: 'h' },
};

const analyzeOptions = {
  help:        { type: 'boolean', short: 'h' },
  target:      { type: 'string', short: 't' },
  output:      { type: 'string', short: 'o' },
  'mock-scan': { type: 'boolean' },
  'mock-ai':   { type: 'boolean' },
  fast:        { type: 'boolean' },
  'no-sarif':  { type: 'boolean' },
  'refresh-ai':{ type: 'string' },
  format:      { type: 'string', short: 'f' },
  thresholds:  { type: 'string' },
  explain:     { type: 'boolean' },
  'fail-on-threshold': { type: 'boolean' },
};

const serveOptions = {
  help: { type: 'boolean', short: 'h' },
  port: { type: 'string', short: 'p' },
};



function printVersion() {
  console.log(version);
}

function printVersionDetail() {
  console.log(`
\x1b[38;2;249;115;22m██╗   ██╗███████╗██╗  ██╗\x1b[0m ██████╗ ██████╗ ██████╗ ███████╗
\x1b[38;2;249;115;22m██║   ██║██╔════╝╚██╗██╔╝\x1b[0m██╔════╝██╔═══██╗██╔══██╗██╔════╝
\x1b[38;2;249;115;22m██║   ██║█████╗   ╚███╔╝\x1b[0m ██║     ██║   ██║██║  ██║█████╗
\x1b[38;2;249;115;22m╚██╗ ██╔╝██╔══╝   ██╔██╗\x1b[0m ██║     ██║   ██║██║  ██║██╔══╝
\x1b[38;2;249;115;22m ╚████╔╝ ███████╗██╔╝ ██╗\x1b[0m╚██████╗╚██████╔╝██████╔╝███████╗
\x1b[38;2;249;115;22m  ╚═══╝  ╚══════╝╚═╝  ╚═╝\x1b[0m ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝\x1b[0m

VexCode CLI v${version}

Node.js : ${process.version}
Platform: ${process.platform} ${process.arch}
CWD     : ${process.cwd()}
`);
}

function printHelp() {
  console.log(`
\x1b[38;2;249;115;22m██╗   ██╗███████╗██╗  ██╗\x1b[0m ██████╗ ██████╗ ██████╗ ███████╗
\x1b[38;2;249;115;22m██║   ██║██╔════╝╚██╗██╔╝\x1b[0m██╔════╝██╔═══██╗██╔══██╗██╔════╝
\x1b[38;2;249;115;22m██║   ██║█████╗   ╚███╔╝\x1b[0m ██║     ██║   ██║██║  ██║█████╗
\x1b[38;2;249;115;22m╚██╗ ██╔╝██╔══╝   ██╔██╗\x1b[0m ██║     ██║   ██║██║  ██║██╔══╝
\x1b[38;2;249;115;22m ╚████╔╝ ███████╗██╔╝ ██╗\x1b[0m╚██████╗╚██████╔╝██████╔╝███████╗
\x1b[38;2;249;115;22m  ╚═══╝  ╚══════╝╚═╝  ╚═╝\x1b[0m ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝\x1b[0m

VexCode - AI Code Review CLI v${version}

Usage: vexcode [command] [options]

Commands:
  analyze [options]    Review source code and detect bugs using AI
  serve [options]      Launch the HTTP server and open the web dashboard
  version              Display detailed version and system environment

Global Flags:
  -v , --version       Print version number and exit
  -h , --help          Display help for command

Run 'vexcode [command] --help' for more information on a command.
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
   const optionDefs = command === 'serve' ? serveOptions : analyzeOptions;
  const { values } = parseArgs({ options: optionDefs, allowPositionals: true, args: rawArgs });
  return values;
}

function printAnalyzeHelp() {
  console.log(`
Usage: vexcode analyze [options]

Analyze a project for security vulnerabilities using Opengrep, enriched with
GitNexus AST context and AI-powered remediation suggestions.

Options:
  -t, --target <path>     Target directory to analyze (default: current dir)
  -o, --output <path>     Custom output path for the report JSON (default: auto)
  -f, --format <format>   Primary report format: json, md, sarif (default: json)
      --thresholds <path> Path to a TOML file with quality gate thresholds
      --explain           Print detailed explanations and gate status to stdout
      --fail-on-threshold Exit with code 1 if thresholds are violated
      --fast              Incremental scan: only analyze changed/untracked files (git)
      --mock-scan         Use mock scan findings (skip Opengrep)
      --mock-ai           Use mock AI suggestions (skip AI API)
      --no-sarif          Skip SARIF 2.1.0 sidecar report (default: write both)
      --refresh-ai <path> Re-run AI resolution on an existing report without re-scanning

Examples:
  vexcode analyze --target ./my-project
  vexcode analyze -t D:/src/my-app --fast
  vexcode analyze -f md --output ./report.md --explain
  vexcode analyze --thresholds conf/thresholds.toml --fail-on-threshold
  vexcode analyze --mock-scan --mock-ai
  vexcode analyze --refresh-ai ~/.vexcode/reports/my-project/report_2026-01-01.json
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
  let values;
  try {
    values = parseArgsForCommand('analyze', rawArgs);
  } catch (err) {
    if (err.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
      const match = err.message.match(/Option '([^']+)'/);
      const badOption = match ? match[1] : '--target';

      const allOpts = [
        { short: '-t', long: '--target' },
        { short: '-o', long: '--output' },
        { short: '-p', long: '--port' },
      ];
      let badLong = badOption;
      let badIdx = -1;
      for (const opt of allOpts) {
        if (badOption.includes(opt.short) || badOption.includes(opt.long)) {
          badLong = opt.long;
          const idx = rawArgs.indexOf(opt.short);
          const idxLong = rawArgs.indexOf(opt.long);
          badIdx = idx !== -1 ? idx : idxLong;
          break;
        }
      }

      const guessValue = badIdx !== -1 ? rawArgs[badIdx + 1] : null;
      const fullName = badOption.replace(/<[^>]+>\s*/g, '').trim();

      if (badLong === '--target') {
        const fluff = badIdx !== -1 && guessValue ? `, but got '${guessValue}'` : '';
        console.error(`\x1b[31mError:\x1b[0m ${fullName} requires a directory path${fluff}. Did you forget to specify a path?`);
      } else if (badLong === '--output' || badLong === '--refresh-ai') {
        const fluff = badIdx !== -1 && guessValue ? `, but got '${guessValue}'` : ', but none was provided';
        console.error(`\x1b[31mError:\x1b[0m ${fullName} requires a path${fluff}.`);
      } else {
        console.error(`\x1b[31mError:\x1b[0m ${fullName} requires a value, but none was provided.`);
      }
    } else {
      console.error(`\x1b[31mError:\x1b[0m Invalid arguments: ${err.message}`);
    }
    process.exit(1);
  }

  if (values.help) {
    printAnalyzeHelp();
    process.exit(0);
  }

  // --refresh-ai mode: skip scan, just re-resolve AI on existing report
  if (values['refresh-ai']) {
    const reportPath = resolve(values['refresh-ai']);
    if (!existsSync(reportPath)) {
      console.error(`\x1b[31mError:\x1b[0m Report not found: ${reportPath}`);
      process.exit(1);
    }
    console.log(`\nRe-resolving AI findings from: ${reportPath}`);
    const mockAi = !!values['mock-ai'];
    if (mockAi) console.log('  (mock AI enabled)');
    console.log('');
    try {
      await runRefreshAi(reportPath, mockAi);
      console.log('\x1b[32mAI re-resolution complete.\x1b[0m');
    } catch (err) {
      console.error(`\x1b[31mRe-resolution failed:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  const targetPath = resolve(values.target || '.');
  const mockScan = !!values['mock-scan'];
  const mockAi = !!values['mock-ai'];
  const fastScan = !!values['fast'];
  const noSarif = !!values['no-sarif'];
  const customOutput = values.output ? resolve(values.output) : null;
  const format = values.format || 'json';
  const thresholdsPath = values.thresholds ? resolve(values.thresholds) : null;
  const explain = !!values.explain;
  const failOnThreshold = !!values['fail-on-threshold'];

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

  const projectName = getProjectName(targetPath);
  const outputPath = customOutput || (() => {
    const projectDir = getProjectReportDir(projectName);
    mkdirSync(projectDir, { recursive: true });
    const reportFilename = getReportFilename();
    return join(projectDir, reportFilename);
  })();

  console.log(`\nScanning target: ${targetPath}`);
  console.log(`Project:        ${projectName}`);
  if (mockScan) console.log('  (mock scan enabled)');
  if (mockAi)   console.log('  (mock AI enabled)');
  if (fastScan) console.log('  (fast/incremental scan enabled)');
  if (noSarif)  console.log('  (SARIF sidecar disabled)');
  if (format !== 'json') console.log(`  (output format: ${format})`);
  if (thresholdsPath) console.log(`  (thresholds: ${thresholdsPath})`);
  if (explain) console.log('  (explain mode enabled)');
  if (failOnThreshold) console.log('  (fail-on-threshold enabled)');
  console.log('');

  try {
    await runPythonAnalysis(targetPath, outputPath, mockScan, mockAi, fastScan, noSarif, null, {
      format, thresholdsPath, explain, failOnThreshold
    });

    // Track latest report path
    updateLatestReportPath(outputPath);

    // Read the saved report (load JSON copy if format is md)
    let jsonReportPath = outputPath;
    if (format === 'md' && jsonReportPath.endsWith('.md')) {
      jsonReportPath = jsonReportPath.replace(/\.md$/, '.json');
    } else if (format === 'md' && !jsonReportPath.endsWith('.json')) {
      // If it doesn't end with .md or .json, python will write it to .json
      jsonReportPath = jsonReportPath + '.json';
    }
    const reportContent = JSON.parse(readFileSync(jsonReportPath, 'utf8'));
    reportContent._outputPath = outputPath;
    reportContent._project = projectName;
    reportContent._id = basename(outputPath).replace('.json', '');

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

if (!command) {
  printHelp();
  process.exit(0);
}

if (command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  printVersion();
  process.exit(0);
}

if (command === '--server' || command === '-s') {
  handleServe(commandArgs);
} else if (!COMMANDS.includes(command)) {
  console.error(`Error: Unknown command "${command}"`);
  console.log('Run "vexcode --help" for usage information.');
  process.exit(1);
} else if (command === 'analyze') {
  await handleAnalyze(commandArgs);
} else if (command === 'serve') {
  handleServe(commandArgs);
} else if (command === 'version') {
  printVersionDetail();
}
