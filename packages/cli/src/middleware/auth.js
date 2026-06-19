import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function resolveHomeDir() {
  if (process.platform === 'win32') {
    return process.env.USERPROFILE || process.env.HOMEDRIVE + process.env.HOMEPATH;
  }
  return process.env.HOME;
}

const HOME_DIR = resolveHomeDir() || process.cwd();
const VEXCODE_DIR = join(HOME_DIR, '.vexcode');
const KEY_FILE = join(VEXCODE_DIR, 'apikey');

function generateApiKey() {
  return randomBytes(32).toString('hex');
}

function loadOrCreateApiKey() {
  if (existsSync(KEY_FILE)) {
    return readFileSync(KEY_FILE, 'utf8').trim();
  }
  const key = generateApiKey();
  try {
    writeFileSync(KEY_FILE, key, { mode: 0o600 });
  } catch {
    writeFileSync(KEY_FILE, key);
  }
  return key;
}

const API_KEY = loadOrCreateApiKey();

export function getApiKey() {
  return API_KEY;
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required.', code: 'AUTH_REQUIRED' });
  }

  const token = authHeader.slice(7);
  if (token !== API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid API key.', code: 'AUTH_REQUIRED' });
  }

  next();
}