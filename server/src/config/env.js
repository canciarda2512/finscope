import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEnvPath = resolve(__dirname, '../../.env');
const rootEnvPath = resolve(__dirname, '../../../.env');

for (const path of [rootEnvPath, serverEnvPath]) {
  if (existsSync(path)) {
    dotenv.config({ path });
  }
}
