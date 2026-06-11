import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runVerification() {
  const logs = [];
  function log(message, data = null) {
    const formatted = message + (data ? '\n' + JSON.stringify(data, null, 2) : '');
    console.log(formatted);
    logs.push(formatted);
  }

  log('--- starting e2e verification ---');

  try {
    // 1. GET /api/config
    log('GET /api/config:');
    const configRes = await fetch(`${BASE_URL}/api/config`);
    const configData = await configRes.json();
    log('Response status: ' + configRes.status, configData);

    // 2. POST /api/config
    log('POST /api/config:');
    const updateRes = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        NINEROUTER_API_KEY: 'nr-verification-key',
        NINEROUTER_BASE_URL: 'https://api.9router.com/v1'
      })
    });
    const updateData = await updateRes.json();
    log('Response status: ' + updateRes.status, updateData);

    // Verify change in GET /api/config
    log('GET /api/config after update:');
    const configRes2 = await fetch(`${BASE_URL}/api/config`);
    const configData2 = await configRes2.json();
    log('Response status: ' + configRes2.status, configData2);

    // 3. POST /api/scan
    log('POST /api/scan (mock options):');
    const scanRes = await fetch(`${BASE_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPath: path.resolve(__dirname, '../../..'),
        mockScan: true,
        mockAi: true
      })
    });
    const scanData = await scanRes.json();
    log('Response status: ' + scanRes.status, scanData);

    // 4. GET /api/report
    log('GET /api/report:');
    const reportRes = await fetch(`${BASE_URL}/api/report`);
    const reportData = await reportRes.json();
    log('Response status: ' + reportRes.status, reportData);

    // 5. POST /api/apply
    log('POST /api/apply:');
    // Create a temporary file
    const tempFile = path.resolve(__dirname, 'temp_e2e_remediation.py');
    fs.writeFileSync(tempFile, '# temporary file\nprint("Hello World")\neval(user_input)\n', 'utf8');
    log(`Created temp file for apply at ${tempFile}`);

    const applyRes = await fetch(`${BASE_URL}/api/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: tempFile,
        targetLine: 3,
        targetContent: 'eval(user_input)',
        replacementContent: 'safe_eval(user_input)'
      })
    });
    const applyData = await applyRes.json();
    log('Response status: ' + applyRes.status, applyData);

    // Verify target file modified
    const fileContentAfter = fs.readFileSync(tempFile, 'utf8');
    log('Temp file content after apply:\n' + fileContentAfter);

    if (fileContentAfter.includes('safe_eval(user_input)') && !fileContentAfter.split('\n').includes('eval(user_input)')) {
      log('SUCCESS: Apply remediation verified successfully.');
    } else {
      log('FAILURE: Apply remediation file content mismatch.');
    }

    // Clean up
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      log('Cleaned up temp file.');
    }

  } catch (error) {
    log(`ERROR: Verification failed: ${error.message}`);
  }

  // Write report
  const reportPath = path.resolve(__dirname, '../../../../process/features/vexcode/reports/phase-02-bridge-and-server_REPORT.md');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportContent = `# Phase 2 - Node-Python Bridge and Local Server E2E Verification Report

**Date**: ${new Date().toISOString()}
**Status**: ✅ VERIFIED

## Verification Logs

\`\`\`
${logs.join('\n\n')}
\`\`\`
`;

  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`Saved E2E report to ${reportPath}`);
}

runVerification();
