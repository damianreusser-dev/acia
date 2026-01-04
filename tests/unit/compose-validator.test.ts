/**
 * Compose Validator Unit Tests
 *
 * Tests for docker-compose.yml validation functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  validateComposeYml,
  hasProblematicVolumeMounts,
  formatValidationResults,
} from '../../src/core/validation/compose-validator';

describe('Compose Validator', () => {
  describe('validateComposeYml', () => {
    describe('Volume Mount Detection', () => {
      it('should detect problematic volume mount to /usr/src/app', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    volumes:
      - .:/usr/src/app
    ports:
      - "3001:3001"
`;
        const result = validateComposeYml(compose);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Volume mount');
      });

      it('should detect problematic volume mount to /app', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    volumes:
      - ./:/app
    ports:
      - "3001:3001"
`;
        const result = validateComposeYml(compose);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should accept compose without volumes', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    restart: unless-stopped
`;
        const result = validateComposeYml(compose);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should accept safe volume mounts (named volumes)', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    volumes:
      - data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    restart: unless-stopped

volumes:
  data:
`;
        const result = validateComposeYml(compose);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
    });

    describe('Health Check Detection', () => {
      it('should warn when no health check defined', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    restart: unless-stopped
`;
        const result = validateComposeYml(compose);
        expect(result.warnings).toContain('No health check defined. Services may appear ready before they are.');
      });

      it('should not warn when health check is defined', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    restart: unless-stopped
`;
        const result = validateComposeYml(compose);
        const hasHealthWarning = result.warnings.some(w => w.includes('health check'));
        expect(hasHealthWarning).toBe(false);
      });
    });

    describe('Restart Policy Detection', () => {
      it('should warn when no restart policy defined', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
`;
        const result = validateComposeYml(compose);
        expect(result.warnings).toContain('No restart policy defined. Containers will not restart on failure.');
      });

      it('should not warn when restart policy is defined', () => {
        const compose = `
version: "3.8"
services:
  backend:
    build: .
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
`;
        const result = validateComposeYml(compose);
        const hasRestartWarning = result.warnings.some(w => w.includes('restart policy'));
        expect(hasRestartWarning).toBe(false);
      });
    });

    describe('Services Section Detection', () => {
      it('should error when no services section', () => {
        const compose = `
version: "3.8"
`;
        const result = validateComposeYml(compose);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('No services section found. Invalid docker-compose.yml structure.');
      });
    });

    describe('Version Detection', () => {
      it('should warn when no version specified', () => {
        const compose = `
services:
  backend:
    build: .
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
`;
        const result = validateComposeYml(compose);
        const hasVersionWarning = result.warnings.some(w => w.includes('version'));
        expect(hasVersionWarning).toBe(true);
      });
    });
  });

  describe('hasProblematicVolumeMounts', () => {
    it('should return true for /usr/src/app mount', () => {
      const compose = `
services:
  app:
    volumes:
      - .:/usr/src/app
`;
      expect(hasProblematicVolumeMounts(compose)).toBe(true);
    });

    it('should return true for /app mount', () => {
      const compose = `
services:
  app:
    volumes:
      - ./:/app
`;
      expect(hasProblematicVolumeMounts(compose)).toBe(true);
    });

    it('should return false for no volumes', () => {
      const compose = `
services:
  app:
    build: .
`;
      expect(hasProblematicVolumeMounts(compose)).toBe(false);
    });

    it('should return false for safe volume mounts', () => {
      const compose = `
services:
  app:
    volumes:
      - logs:/app/logs
      - ./config:/app/config
`;
      expect(hasProblematicVolumeMounts(compose)).toBe(false);
    });
  });

  describe('formatValidationResults', () => {
    it('should format valid results', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };
      const formatted = formatValidationResults(result);
      expect(formatted).toContain('valid');
    });

    it('should format errors', () => {
      const result = {
        valid: false,
        errors: ['Volume mount issue'],
        warnings: [],
      };
      const formatted = formatValidationResults(result);
      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('Volume mount issue');
    });

    it('should format warnings', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: ['No health check'],
      };
      const formatted = formatValidationResults(result);
      expect(formatted).toContain('WARNING');
      expect(formatted).toContain('No health check');
    });
  });
});
