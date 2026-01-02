/**
 * Vitest Setup File
 *
 * Loads environment variables from .env file for all tests.
 * This runs before any test files are executed.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Load .env file and set environment variables
 */
function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    // .env file is optional - tests will skip E2E if API key not available
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalsIndex).trim();
    let value = trimmed.substring(equalsIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Only set if not already defined or empty (allows CLI override but fixes empty string issue)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Load environment variables
loadEnvFile();
