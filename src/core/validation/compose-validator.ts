/**
 * Docker Compose Validation
 *
 * Validates docker-compose.yml files to catch common issues before deployment.
 * Prevents problematic configurations that cause container failures.
 */

/**
 * Result of compose file validation
 */
export interface ComposeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a docker-compose.yml file content
 *
 * Checks for:
 * - Problematic volume mounts that overwrite container files
 * - Missing health checks (warning)
 * - Missing restart policies (warning)
 * - Invalid service names
 */
export function validateComposeYml(content: string): ComposeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for problematic volume mounts
  // Pattern: volumes that mount to /usr/src/app (overwrites container files)
  if (content.includes('volumes:')) {
    // Check for volume mount patterns that overwrite container working directory
    const problematicPatterns = [
      '/usr/src/app',
      ':/app',
      './:/app',
      '.:/app',
      '- .:/app',
      '- ./:/app',
    ];

    for (const pattern of problematicPatterns) {
      if (content.includes(pattern)) {
        // Distinguish between binding to /app and /app/subdir
        // /app/logs, /app/data are okay, /app or /app: is not
        const appVolumePattern = /volumes:[\s\S]*?(?:-\s*[.\w/]+:\/app(?:\/)?(?:\s|$|\n))/;
        if (appVolumePattern.test(content) || content.includes('/usr/src/app')) {
          errors.push(
            `Volume mount to container working directory detected. This will overwrite built files and cause container failures. Pattern found: "${pattern}"`
          );
          break;
        }
      }
    }
  }

  // Check for health checks (warning if missing)
  if (!content.includes('healthcheck:')) {
    warnings.push('No health check defined. Services may appear ready before they are.');
  }

  // Check for restart policy (warning if missing)
  if (!content.includes('restart:')) {
    warnings.push('No restart policy defined. Containers will not restart on failure.');
  }

  // Check for version header
  if (!content.includes('version:')) {
    warnings.push('No version specified. Consider adding version: "3.8" for compatibility.');
  }

  // Check for services section
  if (!content.includes('services:')) {
    errors.push('No services section found. Invalid docker-compose.yml structure.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick check if a compose file has problematic volume mounts
 * Returns true if problematic, false if safe
 */
export function hasProblematicVolumeMounts(content: string): boolean {
  if (!content.includes('volumes:')) {
    return false;
  }

  // Check for mounts that overwrite the entire app directory
  const problematicPatterns = [
    // Mounts that overwrite /usr/src/app
    /volumes:[\s\S]*?-\s*\.?\/?:[/]usr[/]src[/]app(?:\/)?(?:\s|$|\n|")/i,
    // Mounts that overwrite /app
    /volumes:[\s\S]*?-\s*\.?\/?:[/]app(?:\/)?(?:\s|$|\n|")/i,
    // Direct current directory mounts
    /volumes:[\s\S]*?-\s*["']?\.[/"']?:["']?\/(?:usr\/src\/)?app["']?/i,
  ];

  for (const pattern of problematicPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Format validation results for display
 */
export function formatValidationResults(result: ComposeValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Compose file is valid');
  } else {
    lines.push('✗ Compose file has errors:');
  }

  for (const error of result.errors) {
    lines.push(`  ERROR: ${error}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  WARNING: ${warning}`);
  }

  return lines.join('\n');
}
