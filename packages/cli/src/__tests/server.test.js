import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { runConfigCli } from '../bridge.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(os.homedir(), '.vexcode', '.env');
process.env.TEST_SKIP_GITNEXUS = 'true';

const reportsBaseDir = path.join(os.homedir(), '.vexcode', 'reports');
const backupsBaseDir = path.join(os.homedir(), '.vexcode', 'backups');

let mockCancelled = false;

vi.mock('../bridge.js', () => ({
  runPythonAnalysis: vi.fn().mockImplementation((targetPath, reportOutputPath, mockScan, mockAi) => {
    if (mockCancelled) {
      mockCancelled = false;
      const err = new Error('Scan cancelled by user');
      err.cancelled = true;
      return Promise.reject(err);
    }
    const fs = require('node:fs');
    fs.writeFileSync(reportOutputPath, JSON.stringify({
      scanner: 'opengrep',
      target_path: targetPath,
      timestamp: new Date().toISOString(),
      findings: []
    }), 'utf8');
    return Promise.resolve();
  }),
  cancelActiveScan: vi.fn().mockImplementation(() => {
    mockCancelled = true;
    return true;
  }),
  runRefreshAi: vi.fn().mockImplementation((reportPath, mockAi) => {
    const fs = require('node:fs');
    const existing = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    existing.reResolved = true;
    fs.writeFileSync(reportPath, JSON.stringify(existing), 'utf8');
    return Promise.resolve();
  }),
  runConfigCli: vi.fn().mockImplementation((command, payload) => {
    if (command === 'dump') {
      return Promise.resolve({
        enabled: false,
        providers: {},
        agents: {}
      });
    }
    return Promise.resolve({ success: true });
  })
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exec: vi.fn((cmd, callback) => {
      callback(null, { stdout: '', stderr: '' });
    })
  };
});

describe('Express REST Server API', () => {
  let originalEnvContent = '';
  let envExists = false;

  beforeAll(() => {
    if (fs.existsSync(envPath)) {
      originalEnvContent = fs.readFileSync(envPath, 'utf8');
      envExists = true;
    }
  });

  afterAll(() => {
    if (envExists) {
      fs.writeFileSync(envPath, originalEnvContent, 'utf8');
    } else if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
  });

  describe('Static Files Endpoint', () => {
    it('should serve index.html on GET /', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('AI Code Review');
      expect(res.headers['content-type']).toContain('text/html');
    });
  });

  describe('Config Endpoints', () => {
    it('should read and write env config', async () => {
      const postRes = await request(app)
        .post('/api/config')
        .send({
          NINEROUTER_API_KEY: 'test-key-123',
          TEST_VAR: 'test-value'
        });

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);

      const getRes = await request(app).get('/api/config');
      expect(getRes.status).toBe(200);
      expect(getRes.body.NINEROUTER_API_KEY).toBe('test-key-123');
      expect(getRes.body.TEST_VAR).toBe('test-value');
    });
  });

  describe('Scan Endpoint', () => {
    it('should trigger a scan and return success', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({
          targetPath: path.resolve(__dirname, '../..'),
          mockScan: true,
          mockAi: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reportPath).toBeDefined();
    });

    it('should trigger a fast scan and return success', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({
          targetPath: path.resolve(__dirname, '../..'),
          mockScan: true,
          mockAi: true,
          fastScan: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reportPath).toBeDefined();
    });

    it('should reject unsafe target path', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({
          targetPath: 'C:\\Windows'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the workspace directory');
    });

    it('should support scan cancellation', async () => {
      const cancelRes = await request(app)
        .post('/api/scan/cancel')
        .send();

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);
      expect(cancelRes.body.cancelled).toBe(true);

      const scanRes = await request(app)
        .post('/api/scan')
        .send({
          targetPath: path.resolve(__dirname, '../..'),
          mockScan: true,
          mockAi: true
        });

      expect(scanRes.status).toBe(400);
      expect(scanRes.body.success).toBe(false);
      expect(scanRes.body.error).toBe('Scan cancelled by user');
    });

    it('should support real-time scan streaming (SSE)', async () => {
      const res = await request(app)
        .get('/api/scan/stream')
        .query({
          targetPath: path.resolve(__dirname, '../..'),
          mockScan: true,
          mockAi: true
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data: {"type":"status",');
      expect(res.text).toContain('data: {"type":"complete",');
    });
  });

  describe('Report Endpoint', () => {
    const tempReportPath = path.resolve(__dirname, 'temp_report.json');

    beforeAll(() => {
      fs.writeFileSync(tempReportPath, JSON.stringify({ mock: 'report' }), 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(tempReportPath)) {
        fs.unlinkSync(tempReportPath);
      }
    });

    it('should return report content', async () => {
      const res = await request(app)
        .get(`/api/report?path=${encodeURIComponent(tempReportPath)}`);

      expect(res.status).toBe(200);
      expect(res.body.mock).toBe('report');
    });

    it('should error if report does not exist', async () => {
      const res = await request(app)
        .get(`/api/report?path=${encodeURIComponent(path.resolve(__dirname, 'non_existent.json'))}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reject unsafe report path', async () => {
      const res = await request(app)
        .get(`/api/report?path=${encodeURIComponent('C:\\Windows\\system32\\config.json')}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject path traversal attempt', async () => {
      const res = await request(app)
        .get(`/api/report?path=${encodeURIComponent('C:\\outside.json')}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the workspace directory');
    });
  });

  describe('Apply Remediation Endpoint', () => {
    const tempFilePath = path.resolve(__dirname, 'temp_code.py');

    beforeEach(() => {
      fs.writeFileSync(
        tempFilePath,
        '# Line 1\n' +
        '# Line 2\n' +
        'exec(user_input)\n' +
        '# Line 4\n',
        'utf8'
      );
    });

    afterEach(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    it('should successfully apply remediation', async () => {
      const res = await request(app)
        .post('/api/apply')
        .send({
          filePath: tempFilePath,
          targetLine: 3,
          targetContent: 'exec(user_input)',
          replacementContent: 'subprocess.run(["echo", user_input])'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const fileContent = fs.readFileSync(tempFilePath, 'utf8');
      expect(fileContent).toContain('subprocess.run(["echo", user_input])');
      expect(fileContent).not.toContain('exec(user_input)');
    });

    it('should reject remediation if targetContent mismatch', async () => {
      const res = await request(app)
        .post('/api/apply')
        .send({
          filePath: tempFilePath,
          targetLine: 3,
          targetContent: 'different_content',
          replacementContent: 'some_remediation'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Target content mismatch');
    });

    it('should reject remediation if path is outside workspace', async () => {
      const res = await request(app)
        .post('/api/apply')
        .send({
          filePath: 'C:\\Windows\\system32\\drivers\\etc\\hosts',
          targetLine: 1,
          targetContent: 'something',
          replacementContent: 'else'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the workspace directory');
    });
  });

  describe('Line Mapping and Alignment', () => {
    const tempMapFilePath = path.join(__dirname, 'temp_map_file.py');

    beforeEach(() => {
      fs.writeFileSync(
        tempMapFilePath,
        '# Line 1\n' +
        '# Line 2\n' +
        'exec(user_input)\n' +
        '# Line 4\n',
        'utf8'
      );
    });

    afterEach(() => {
      if (fs.existsSync(tempMapFilePath)) {
        fs.unlinkSync(tempMapFilePath);
      }
    });

    it('should resolve line mapping with exact match at original line', async () => {
      const res = await request(app)
        .get('/api/line-map')
        .query({
          path: tempMapFilePath,
          line: 3,
          codeText: 'exec(user_input)'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mappedLine).toBe(3);
    });

    it('should resolve line mapping if content shifts down', async () => {
      fs.writeFileSync(
        tempMapFilePath,
        '# Line 1\n' +
        '# New Line A\n' +
        '# New Line B\n' +
        '# Line 2\n' +
        'exec(user_input)\n' +
        '# Line 4\n',
        'utf8'
      );

      const res = await request(app)
        .get('/api/line-map')
        .query({
          path: tempMapFilePath,
          line: 3,
          codeText: 'exec(user_input)'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mappedLine).toBe(5);
    });

    it('should apply remediation successfully even after line shift', async () => {
      fs.writeFileSync(
        tempMapFilePath,
        '# Line 1\n' +
        '# New Line A\n' +
        '# New Line B\n' +
        '# Line 2\n' +
        'exec(user_input)\n' +
        '# Line 4\n',
        'utf8'
      );

      const res = await request(app)
        .post('/api/apply')
        .send({
          filePath: tempMapFilePath,
          targetLine: 3,
          targetContent: 'exec(user_input)',
          replacementContent: 'subprocess.run(["echo", user_input])',
          codeText: 'exec(user_input)'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const fileContent = fs.readFileSync(tempMapFilePath, 'utf8');
      expect(fileContent).toContain('subprocess.run(["echo", user_input])');
      expect(fileContent).not.toContain('exec(user_input)');
    });

    it('should return 400 when missing required parameters', async () => {
      const res = await request(app)
        .get('/api/line-map')
        .query({
          path: tempMapFilePath
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameters');
    });

    it('should return 400 for unsafe path', async () => {
      const res = await request(app)
        .get('/api/line-map')
        .query({
          path: 'C:\\Windows\\system32\\config\\SAM',
          line: 1,
          codeText: 'test'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the allowed directory');
    });

    it('should return 404 when file not found', async () => {
      const res = await request(app)
        .get('/api/line-map')
        .query({
          path: path.resolve(__dirname, 'nonexistent_file.py'),
          line: 1,
          codeText: 'test'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('File not found');
    });
  });

  describe('File Content Endpoint', () => {
    const tempFilePath = path.resolve(__dirname, 'temp_content.txt');

    beforeAll(() => {
      fs.writeFileSync(tempFilePath, 'Hello, world!\nLine 2\n', 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    it('should return file content on success', async () => {
      const res = await request(app)
        .get('/api/file-content')
        .query({ path: tempFilePath });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBe('Hello, world!\nLine 2\n');
    });

    it('should return 400 when path parameter is missing', async () => {
      const res = await request(app)
        .get('/api/file-content');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter');
    });

    it('should return 400 for unsafe path outside workspace', async () => {
      const res = await request(app)
        .get('/api/file-content')
        .query({ path: 'C:\\Windows\\system32\\config\\SAM' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the allowed directory');
    });

    it('should return 404 when file does not exist', async () => {
      const res = await request(app)
        .get('/api/file-content')
        .query({ path: path.resolve(__dirname, 'nonexistent_file.txt') });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('File not found');
    });
  });

  describe('Re-Resolve Endpoint', () => {
    const tempReportPath = path.resolve(__dirname, 'temp_reresolve_report.json');

    beforeAll(() => {
      fs.writeFileSync(tempReportPath, JSON.stringify({
        scanner: 'opengrep',
        findings: [{ id: 1, title: 'Test finding' }]
      }), 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(tempReportPath)) {
        fs.unlinkSync(tempReportPath);
      }
    });

    it('should re-resolve successfully with valid reportPath', async () => {
      const res = await request(app)
        .post('/api/re-resolve')
        .send({
          reportPath: tempReportPath,
          mockAi: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Refresh AI complete');
      expect(res.body.report).toBeDefined();
      expect(res.body.report.reResolved).toBe(true);
    });

    it('should return 400 when reportPath is missing', async () => {
      const res = await request(app)
        .post('/api/re-resolve')
        .send({ mockAi: true });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid reportPath: must be a non-empty string');
    });

    it('should return 400 when reportPath does not exist', async () => {
      const res = await request(app)
        .post('/api/re-resolve')
        .send({
          reportPath: path.resolve(__dirname, 'nonexistent_report.json'),
          mockAi: true
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Valid reportPath is required');
    });
  });

  describe('Reports List Endpoint', () => {
    const testProjectDir = path.join(reportsBaseDir, '__test_project_list__');

    beforeAll(() => {
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.writeFileSync(
        path.join(testProjectDir, 'report_2026-01-01T00-00-00.json'),
        JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', findings: [{ id: 1 }] }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(testProjectDir, 'report_2026-01-02T00-00-00.json'),
        JSON.stringify({ timestamp: '2026-01-02T00:00:00Z', findings: [{ id: 1 }, { id: 2 }] }),
        'utf8'
      );
    });

    afterAll(() => {
      if (fs.existsSync(testProjectDir)) {
        fs.rmSync(testProjectDir, { recursive: true, force: true });
      }
    });

    it('should list all projects with reports', async () => {
      const res = await request(app).get('/api/reports');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.projects)).toBe(true);

      const testProject = res.body.projects.find(p => p.name === '__test_project_list__');
      expect(testProject).toBeDefined();
      expect(testProject.reportCount).toBe(2);
      expect(testProject.latestReport.findings).toBe(2);
    });

    it('should return empty projects array when no reports exist', async () => {
      const emptyDir = path.join(reportsBaseDir, '__test_empty__');
      fs.mkdirSync(emptyDir, { recursive: true });

      try {
        const res = await request(app).get('/api/reports');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.projects)).toBe(true);
      } finally {
        if (fs.existsSync(emptyDir)) {
          fs.rmSync(emptyDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('Project Reports Endpoint', () => {
    const testProjectDir = path.join(reportsBaseDir, '__test_project_reports__');

    beforeAll(() => {
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.writeFileSync(
        path.join(testProjectDir, 'report_2026-03-01T12-00-00.json'),
        JSON.stringify({ timestamp: '2026-03-01T12:00:00Z', target_path: '/test', findings: [{ id: 1 }] }),
        'utf8'
      );
    });

    afterAll(() => {
      if (fs.existsSync(testProjectDir)) {
        fs.rmSync(testProjectDir, { recursive: true, force: true });
      }
    });

    it('should list reports for an existing project', async () => {
      const res = await request(app).get('/api/reports/__test_project_reports__');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.project).toBe('__test_project_reports__');
      expect(Array.isArray(res.body.reports)).toBe(true);
      expect(res.body.reports.length).toBe(1);
      expect(res.body.reports[0].findings).toBe(1);
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app).get('/api/reports/__nonexistent_project_xyz__');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('Specific Report Endpoint', () => {
    const testProjectDir = path.join(reportsBaseDir, '__test_specific_report__');
    const reportId = 'report_2026-04-01T08-00-00';

    beforeAll(() => {
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.writeFileSync(
        path.join(testProjectDir, `${reportId}.json`),
        JSON.stringify({ timestamp: '2026-04-01T08:00:00Z', findings: [{ id: 42, title: 'SQL Injection' }] }),
        'utf8'
      );
    });

    afterAll(() => {
      if (fs.existsSync(testProjectDir)) {
        fs.rmSync(testProjectDir, { recursive: true, force: true });
      }
    });

    it('should return a specific report by project and id', async () => {
      const res = await request(app).get(`/api/report/__test_specific_report__/${reportId}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(reportId);
      expect(res.body._project).toBe('__test_specific_report__');
      expect(res.body.findings).toBeDefined();
      expect(res.body.findings[0].id).toBe(42);
    });

    it('should return 404 for non-existent report', async () => {
      const res = await request(app).get('/api/report/__test_specific_report__/nonexistent_id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Report not found');
    });
  });

  describe('Latest Report Endpoint (backward compat)', () => {
    const testProjectDir = path.join(reportsBaseDir, '__test_latest_report__');

    beforeAll(() => {
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.writeFileSync(
        path.join(testProjectDir, 'report_older.json'),
        JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', findings: [] }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(testProjectDir, 'report_newer.json'),
        JSON.stringify({ timestamp: '2026-06-01T00:00:00Z', findings: [{ id: 99 }] }),
        'utf8'
      );
    });

    afterAll(() => {
      if (fs.existsSync(testProjectDir)) {
        fs.rmSync(testProjectDir, { recursive: true, force: true });
      }
    });

    it('should return the latest report across all projects', async () => {
      const res = await request(app).get('/api/report');

      expect(res.status).toBe(200);
      expect(res.body._project).toBeDefined();
      expect(res.body._id).toBeDefined();
      expect(res.body.findings).toBeDefined();
    });

    it('should return 404 when no reports exist anywhere', async () => {
      const backupDir = path.join(os.homedir(), '.vexcode', `__reports_backup_${Date.now()}__`);

      if (fs.existsSync(reportsBaseDir)) {
        fs.renameSync(reportsBaseDir, backupDir);
      }

      try {
        const res = await request(app).get('/api/report');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('No reports found');
      } finally {
        if (fs.existsSync(backupDir)) {
          fs.renameSync(backupDir, reportsBaseDir);
        }
      }
    });
  });

  describe('Open in IDE Endpoint', () => {
    it('should return 400 when filePath is missing', async () => {
      const res = await request(app)
        .post('/api/open-in-ide')
        .send({ line: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: filePath');
    });

    it('should return 400 for unsafe path outside workspace', async () => {
      const res = await request(app)
        .post('/api/open-in-ide')
        .send({ filePath: 'C:\\Windows\\system32\\notepad.exe' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the allowed directory');
    });
  });

  describe('Rollback Endpoint', () => {
    it('should return 400 when filePath is missing', async () => {
      const res = await request(app)
        .post('/api/rollback')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: filePath');
    });

    it('should return 400 for unsafe path outside workspace', async () => {
      const res = await request(app)
        .post('/api/rollback')
        .send({ filePath: 'C:\\Windows\\system32\\drivers\\etc\\hosts' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('outside the workspace directory');
    });

    it('should return 404 when no backup exists', async () => {
      const tempFile = path.resolve(__dirname, 'temp_rollback_test.py');
      fs.writeFileSync(tempFile, '# test\n', 'utf8');

      try {
        const res = await request(app)
          .post('/api/rollback')
          .send({ filePath: tempFile });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('No backup found');
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('Models Endpoint', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return 400 when baseUrl is missing', async () => {
      const res = await request(app).get('/api/models');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: baseUrl');
    });

    it('should return models list on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', owned_by: 'openai' }
          ]
        })
      });

      const res = await request(app)
        .get('/api/models')
        .query({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.models)).toBe(true);
      expect(res.body.models.length).toBe(2);
      expect(res.body.models[0].id).toBe('gpt-3.5-turbo');
      expect(res.body.models[1].id).toBe('gpt-4');
    });

    it('should return empty models when provider returns non-ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      const res = await request(app)
        .get('/api/models')
        .query({ baseUrl: 'https://api.example.com/v1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toEqual([]);
    });

    it('should return empty models when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await request(app)
        .get('/api/models')
        .query({ baseUrl: 'https://offline.example.com/v1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toEqual([]);
    });
  });

  describe('Chat Endpoint', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return 400 when messages is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ provider: 'openai' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: messages');
    });

    it('should return 400 when messages is empty array', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ messages: [], provider: 'openai' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: messages');
    });

    it('should return 400 when provider is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ messages: [{ role: 'user', content: 'Hello' }] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: provider');
    });

    it('should return 400 when baseUrl is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'openai'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: baseUrl');
    });

    it('should return 400 when model is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: model');
    });

    it('should return 400 when apiKey is missing for non-9router provider', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing required parameter: apiKey');
    });

    it('should succeed with OpenAI-compatible provider', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({
          choices: [{ message: { content: 'Hello! How can I help?' } }]
        })).buffer
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hi' }],
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4',
          apiKey: 'sk-test'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response).toBe('Hello! How can I help?');
    });

    it('should succeed with 9router provider without apiKey', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({
          choices: [{ message: { content: '9router response' } }]
        })).buffer
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Test' }],
          provider: '9router',
          baseUrl: 'https://api.9router.com/v1',
          model: 'gemini-2.0-flash'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response).toBe('9router response');
    });

    it('should handle Anthropic provider format', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({
          content: [{ type: 'text', text: 'Claude response here' }]
        })).buffer
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello' }
          ],
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-3-opus',
          apiKey: 'sk-ant-test'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response).toBe('Claude response here');
    });

    it('should handle Google provider format', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }]
        })).buffer
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'google',
          baseUrl: 'https://generativelanguage.googleapis.com',
          model: 'gemini-1.5-flash',
          apiKey: 'google-key'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response).toBe('Gemini response');
    });

    it('should return 500 when provider fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'openai',
          baseUrl: 'https://offline.example.com/v1',
          model: 'gpt-4',
          apiKey: 'sk-test'
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Provider request failed');
    });
  });

  describe('PUT /api/settings/ai', () => {
    it('should accept a valid AI settings update', async () => {
      const res = await request(app)
        .put('/api/settings/ai')
        .send({ enabled: true, providers: {}, agents: {} });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('AI settings updated successfully.');
    });

    it('should return 400 when body is an array instead of object', async () => {
      const res = await request(app)
        .put('/api/settings/ai')
        .send([]);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid request body');
    });

    it('should return JSON error when update fails', async () => {
      runConfigCli.mockRejectedValueOnce(new Error('Update failed'));
      const res = await request(app)
        .put('/api/settings/ai')
        .send({ enabled: true });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Update failed');
    });
  });

  describe('Unmatched API routes', () => {
    it('should return JSON 404 for unmatched GET /api/*', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: 'Route not found: GET /nonexistent' });
    });

    it('should return JSON 404 for unmatched POST /api/*', async () => {
      const res = await request(app).post('/api/unknown');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: 'Route not found: POST /unknown' });
    });
  });
});