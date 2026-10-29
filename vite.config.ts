// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vitest/config';

if (!existsSync(path.join(import.meta.dirname, '.env'))) {
  copyFileSync(path.join(import.meta.dirname, '.env.defaults'), path.join(import.meta.dirname, '.env'));
}

// https://vitejs.dev/config/
export default defineConfig({
  // MINIPACS_: variables propias del portal MiniPACS (por ejemplo MINIPACS_PASE_URL, la puerta del servicio de pase)
  envPrefix: ['MEDPLUM_', 'GOOGLE_', 'RECAPTCHA_', 'MINIPACS_'],
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    maxWorkers: process.env.TEST_MAX_WORKERS ?? '50%',
    environment: 'jsdom',
    setupFiles: ['./src/test.setup.ts'],
    globals: true,
    testTimeout: 120000,
  },
});
