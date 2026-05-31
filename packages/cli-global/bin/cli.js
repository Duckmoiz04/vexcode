#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file and directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package version from package.json
let version = '1.0.0';
try {
  const packageJsonPath = join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  version = packageJson.version || version;
} catch (error) {
  // Fallback if reading package.json fails
}

const options = {
  help: {
    type: 'boolean',
    short: 'h',
  },
  version: {
    type: 'boolean',
    short: 'v',
  },
  name: {
    type: 'string',
    short: 'n',
  },
};

try {
  const { values } = parseArgs({
    options,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Usage: ai-code-review [options]

Options:
  -h, --help           Show this help message
  -v, --version        Show version number
  -n, --name <string>  Greet a specific user or name
    `);
    process.exit(0);
  }

  if (values.version) {
    console.log(version);
    process.exit(0);
  }

  if (values.name) {
    console.log(`Hello, ${values.name}!`);
    process.exit(0);
  }

  // Default behavior if no option is provided
  console.log('AI Code Review CLI. Run with --help for options.');
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.log('Run with --help for usage information.');
  process.exit(1);
}
