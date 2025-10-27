import fs from 'fs';
import path from 'path';
import { SystemEnvVar } from './system-env-client';

/**
 * Read system-wide environment variables from .secret/.env
 * Only returns ANTHROPIC_* variables for security
 *
 * SERVER-SIDE ONLY - Do not import this in client components!
 */
export function readSystemEnv(): SystemEnvVar[] {
  // Check both current directory and parent directory for .secret/.env
  // This matches the kubeconfig loading logic
  let envPath = path.join(process.cwd(), '.secret', '.env');
  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '..', '.secret', '.env');
  }

  if (!fs.existsSync(envPath)) {
    console.warn(`System env file not found at: ${envPath}`);
    return [];
  }

  console.log(`Loading system env from: ${envPath}`);

  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const systemVars: SystemEnvVar[] = [];

    envContent.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.includes('=')) return;

      // Remove 'export' if present
      const cleanLine = line.replace(/^export\s+/, '');
      const [key, ...valueParts] = cleanLine.split('=');
      const value = valueParts.join('='); // Handle values with = signs

      if (key && value) {
        const cleanKey = key.trim();
        const cleanValue = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes

        // Only return ANTHROPIC-related variables for security
        if (cleanKey.startsWith('ANTHROPIC_')) {
          systemVars.push({
            key: cleanKey,
            value: cleanValue,
            description: getEnvDescription(cleanKey)
          });
        }
      }
    });

    console.log(`✅ Loaded ${systemVars.length} ANTHROPIC environment variable(s)`);
    systemVars.forEach(v => console.log(`  - ${v.key}: ${v.value ? '***' : '(empty)'}`));

    return systemVars;
  } catch (error) {
    console.error('Error reading system env file:', error);
    return [];
  }
}

/**
 * Get human-readable description for environment variable
 */
function getEnvDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'ANTHROPIC_AUTH_TOKEN': 'Claude Code API authentication token',
    'ANTHROPIC_BASE_URL': 'Claude Code API base URL (empty = default)',
    'ANTHROPIC_API_KEY': 'Anthropic API key (legacy)',
  };
  return descriptions[key] || 'System environment variable';
}

// Re-export client utilities for convenience
export { maskSecret, isEmptyValue } from './system-env-client';
