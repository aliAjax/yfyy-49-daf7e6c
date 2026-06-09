import fs from 'fs';
import os from 'os';
import path from 'path';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-service-test-'));
process.env.TEST_DB_PATH = path.join(testDir, 'test.sqlite');

afterAll(() => {
  const dbPath = process.env.TEST_DB_PATH;
  if (!dbPath) {
    return;
  }

  for (const file of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
    if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
    }
  }

  fs.rmSync(testDir, { force: true, recursive: true });
});
