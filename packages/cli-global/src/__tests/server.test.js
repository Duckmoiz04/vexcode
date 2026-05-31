import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../../analysis-core/.env');

vi.mock('../bridge.js', () => ({
  runPythonAnalysis: vi.fn().mockImplementation(() => Promise.resolve())
}));

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

  describe('Config Endpoints', () => {
    it('should read and write env config', async () => {
      // Test POST /api/config
      const postRes = await request(app)
        .post('/api/config')
        .send({
          NINEROUTER_API_KEY: 'test-key-123',
          TEST_VAR: 'test-value'
        });
      
      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);

      // Test GET /api/config
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
          targetPath: path.resolve(__dirname, '../..'), // cli-global
          mockScan: true,
          mockAi: true
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
});
