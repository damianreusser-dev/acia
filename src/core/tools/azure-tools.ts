/**
 * Azure Deployment Tools
 *
 * Provides Azure cloud deployment operations for agents.
 * Supports Azure App Service (backend), Static Web Apps (frontend),
 * and Container Apps (Docker containers).
 *
 * Part of Phase 6h: Azure Deployment + E2E Build-Deploy-Monitor Integration
 *
 * Environment Variables Required:
 * - AZURE_SUBSCRIPTION_ID: Azure subscription ID
 * - AZURE_TENANT_ID: Azure tenant ID
 * - AZURE_CLIENT_ID: Service principal client ID
 * - AZURE_CLIENT_SECRET: Service principal client secret
 *
 * Optional:
 * - AZURE_RESOURCE_GROUP: Default resource group (auto-creates if not exists)
 * - AZURE_LOCATION: Default location (default: eastus)
 */

import { spawn } from 'child_process';
import { Tool, ToolDefinition, ToolResult, AgentRole } from './types.js';

/** Roles that can use Azure deployment tools */
const AZURE_TOOL_ROLES: AgentRole[] = ['devops', 'ops'];

/** Default Azure location */
const DEFAULT_AZURE_LOCATION = 'eastus';

/** Default App Service plan */
const DEFAULT_APP_SERVICE_PLAN = 'B1';

/**
 * Execute an Azure CLI command and return the result
 */
async function executeAzureCommand(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('az', args, {
      cwd: options?.cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => (stdout += data.toString()));
    proc.stderr?.on('data', (data) => (stderr += data.toString()));

    // Timeout handling - Azure operations can be slow
    const timeout = options?.timeout ?? 600000; // 10 min default
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      stderr += '\nProcess timed out';
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

/**
 * Check if Azure CLI is installed and user is logged in
 */
async function checkAzureCLI(): Promise<{ available: boolean; error?: string }> {
  const versionResult = await executeAzureCommand(['--version'], { timeout: 30000 });
  if (versionResult.code !== 0) {
    return {
      available: false,
      error: 'Azure CLI is not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli',
    };
  }

  // Check if logged in
  const accountResult = await executeAzureCommand(['account', 'show'], { timeout: 30000 });
  if (accountResult.code !== 0) {
    return {
      available: false,
      error: 'Not logged in to Azure. Run: az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID',
    };
  }

  return { available: true };
}

/**
 * Ensure resource group exists
 */
async function ensureResourceGroup(resourceGroup: string, location: string): Promise<ToolResult | null> {
  // Check if resource group exists
  const checkResult = await executeAzureCommand(['group', 'show', '--name', resourceGroup], { timeout: 30000 });

  if (checkResult.code !== 0) {
    // Create resource group
    const createResult = await executeAzureCommand([
      'group',
      'create',
      '--name',
      resourceGroup,
      '--location',
      location,
    ], { timeout: 60000 });

    if (createResult.code !== 0) {
      return {
        success: false,
        error: `Failed to create resource group: ${createResult.stderr}`,
      };
    }
  }

  return null; // Success, no error
}

/**
 * Login to Azure using service principal if credentials are available
 */
async function loginToAzure(): Promise<ToolResult | null> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    return {
      success: false,
      error: 'Azure credentials not configured. Required: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID',
    };
  }

  const loginResult = await executeAzureCommand([
    'login',
    '--service-principal',
    '-u',
    clientId,
    '-p',
    clientSecret,
    '--tenant',
    tenantId,
  ], { timeout: 60000 });

  if (loginResult.code !== 0) {
    return {
      success: false,
      error: `Azure login failed: ${loginResult.stderr}`,
    };
  }

  // Set subscription if specified
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (subscriptionId) {
    const subResult = await executeAzureCommand(['account', 'set', '--subscription', subscriptionId], { timeout: 30000 });
    if (subResult.code !== 0) {
      return {
        success: false,
        error: `Failed to set subscription: ${subResult.stderr}`,
      };
    }
  }

  return null; // Success
}

/**
 * Deploy to Azure App Service Tool
 * Deploys a Node.js backend application to Azure App Service
 */
export class DeployToAzureAppServiceTool implements Tool {
  roles: AgentRole[] = AZURE_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'deploy_to_azure_app_service',
      description: 'Deploy a Node.js application to Azure App Service. Requires Azure credentials.',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory to deploy',
          required: true,
        },
        {
          name: 'resourceGroup',
          type: 'string',
          description: 'Azure resource group name',
          required: true,
        },
        {
          name: 'appName',
          type: 'string',
          description: 'Name for the App Service (must be globally unique)',
          required: true,
        },
        {
          name: 'plan',
          type: 'string',
          description: 'App Service plan SKU (default: B1)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];
    const resourceGroup = params['resourceGroup'];
    const appName = params['appName'];
    const plan = params['plan'] ?? DEFAULT_APP_SERVICE_PLAN;

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }
    if (typeof resourceGroup !== 'string') {
      return { success: false, error: 'Parameter "resourceGroup" must be a string' };
    }
    if (typeof appName !== 'string') {
      return { success: false, error: 'Parameter "appName" must be a string' };
    }

    try {
      // Check Azure CLI
      const cliCheck = await checkAzureCLI();
      if (!cliCheck.available) {
        // Try to login
        const loginError = await loginToAzure();
        if (loginError) return loginError;
      }

      const location = process.env.AZURE_LOCATION || DEFAULT_AZURE_LOCATION;

      // Ensure resource group exists
      const rgError = await ensureResourceGroup(resourceGroup, location);
      if (rgError) return rgError;

      // Deploy using az webapp up (simplest deployment method)
      const deployResult = await executeAzureCommand([
        'webapp',
        'up',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--location',
        location,
        '--sku',
        String(plan),
        '--runtime',
        'NODE:20-lts',
      ], {
        cwd: projectPath,
        timeout: 900000, // 15 min for deployment
      });

      if (deployResult.code !== 0) {
        return {
          success: false,
          error: `Azure App Service deployment failed: ${deployResult.stderr}`,
          output: deployResult.stdout,
        };
      }

      // Get the deployment URL
      const deploymentUrl = `https://${appName}.azurewebsites.net`;

      return {
        success: true,
        output: `Deployed to Azure App Service successfully!\nURL: ${deploymentUrl}\n${deployResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Deploy to Azure Static Web Apps Tool
 * Deploys a React/static frontend to Azure Static Web Apps
 */
export class DeployToAzureStaticWebTool implements Tool {
  roles: AgentRole[] = AZURE_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'deploy_to_azure_static_web',
      description: 'Deploy a static website (React, Vue, etc.) to Azure Static Web Apps.',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory to deploy',
          required: true,
        },
        {
          name: 'resourceGroup',
          type: 'string',
          description: 'Azure resource group name',
          required: true,
        },
        {
          name: 'appName',
          type: 'string',
          description: 'Name for the Static Web App',
          required: true,
        },
        {
          name: 'buildFolder',
          type: 'string',
          description: 'Build output folder (default: dist or build)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];
    const resourceGroup = params['resourceGroup'];
    const appName = params['appName'];
    const buildFolder = params['buildFolder'] ?? 'dist';

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }
    if (typeof resourceGroup !== 'string') {
      return { success: false, error: 'Parameter "resourceGroup" must be a string' };
    }
    if (typeof appName !== 'string') {
      return { success: false, error: 'Parameter "appName" must be a string' };
    }

    try {
      // Check Azure CLI
      const cliCheck = await checkAzureCLI();
      if (!cliCheck.available) {
        const loginError = await loginToAzure();
        if (loginError) return loginError;
      }

      const location = process.env.AZURE_LOCATION || DEFAULT_AZURE_LOCATION;

      // Ensure resource group exists
      const rgError = await ensureResourceGroup(resourceGroup, location);
      if (rgError) return rgError;

      // Create Static Web App
      const createResult = await executeAzureCommand([
        'staticwebapp',
        'create',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--location',
        location,
        '--sku',
        'Free',
      ], { timeout: 300000 });

      // Ignore error if app already exists
      if (createResult.code !== 0 && !createResult.stderr.includes('already exists')) {
        return {
          success: false,
          error: `Failed to create Static Web App: ${createResult.stderr}`,
        };
      }

      // Get deployment token
      const tokenResult = await executeAzureCommand([
        'staticwebapp',
        'secrets',
        'list',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--query',
        'properties.apiKey',
        '-o',
        'tsv',
      ], { timeout: 60000 });

      if (tokenResult.code !== 0) {
        return {
          success: false,
          error: `Failed to get deployment token: ${tokenResult.stderr}`,
        };
      }

      const deployToken = tokenResult.stdout.trim();

      // Deploy using az staticwebapp deploy
      const deployResult = await executeAzureCommand([
        'staticwebapp',
        'deploy',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--app-location',
        String(buildFolder),
        '--deployment-token',
        deployToken,
      ], {
        cwd: projectPath,
        timeout: 600000,
      });

      if (deployResult.code !== 0) {
        return {
          success: false,
          error: `Static Web App deployment failed: ${deployResult.stderr}`,
          output: deployResult.stdout,
        };
      }

      // Get the deployment URL
      const urlResult = await executeAzureCommand([
        'staticwebapp',
        'show',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--query',
        'defaultHostname',
        '-o',
        'tsv',
      ], { timeout: 30000 });

      const hostname = urlResult.stdout.trim() || `${appName}.azurestaticapps.net`;
      const deploymentUrl = `https://${hostname}`;

      return {
        success: true,
        output: `Deployed to Azure Static Web Apps successfully!\nURL: ${deploymentUrl}\n${deployResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Deploy to Azure Container Apps Tool
 * Deploys Docker containers to Azure Container Apps
 */
export class DeployToAzureContainerAppsTool implements Tool {
  roles: AgentRole[] = AZURE_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'deploy_to_azure_container_apps',
      description: 'Deploy a Docker container to Azure Container Apps.',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory with Dockerfile',
          required: true,
        },
        {
          name: 'resourceGroup',
          type: 'string',
          description: 'Azure resource group name',
          required: true,
        },
        {
          name: 'appName',
          type: 'string',
          description: 'Name for the Container App',
          required: true,
        },
        {
          name: 'registry',
          type: 'string',
          description: 'Azure Container Registry name (optional, auto-creates)',
          required: false,
        },
        {
          name: 'port',
          type: 'number',
          description: 'Container port to expose (default: 3000)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];
    const resourceGroup = params['resourceGroup'];
    const appName = params['appName'];
    const registry = params['registry'];
    const port = params['port'] ?? 3000;

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }
    if (typeof resourceGroup !== 'string') {
      return { success: false, error: 'Parameter "resourceGroup" must be a string' };
    }
    if (typeof appName !== 'string') {
      return { success: false, error: 'Parameter "appName" must be a string' };
    }

    try {
      // Check Azure CLI
      const cliCheck = await checkAzureCLI();
      if (!cliCheck.available) {
        const loginError = await loginToAzure();
        if (loginError) return loginError;
      }

      const location = process.env.AZURE_LOCATION || DEFAULT_AZURE_LOCATION;

      // Ensure resource group exists
      const rgError = await ensureResourceGroup(resourceGroup, location);
      if (rgError) return rgError;

      // Use az containerapp up for simplified deployment
      // This handles ACR creation, image building, and deployment
      const deployArgs = [
        'containerapp',
        'up',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--location',
        location,
        '--source',
        '.',
        '--ingress',
        'external',
        '--target-port',
        String(port),
      ];

      if (typeof registry === 'string') {
        deployArgs.push('--registry-server', `${registry}.azurecr.io`);
      }

      const deployResult = await executeAzureCommand(deployArgs, {
        cwd: projectPath,
        timeout: 900000, // 15 min for container build + deploy
      });

      if (deployResult.code !== 0) {
        return {
          success: false,
          error: `Container Apps deployment failed: ${deployResult.stderr}`,
          output: deployResult.stdout,
        };
      }

      // Get the deployment URL
      const urlResult = await executeAzureCommand([
        'containerapp',
        'show',
        '--name',
        appName,
        '--resource-group',
        resourceGroup,
        '--query',
        'properties.configuration.ingress.fqdn',
        '-o',
        'tsv',
      ], { timeout: 30000 });

      const hostname = urlResult.stdout.trim();
      const deploymentUrl = hostname ? `https://${hostname}` : '';

      return {
        success: true,
        output: `Deployed to Azure Container Apps successfully!\n${deploymentUrl ? `URL: ${deploymentUrl}` : ''}\n${deployResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get Azure Deployment Status Tool
 * Check the status of an Azure deployment
 */
export class GetAzureDeploymentStatusTool implements Tool {
  roles: AgentRole[] = AZURE_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'get_azure_deployment_status',
      description: 'Check the status of an Azure deployment',
      parameters: [
        {
          name: 'resourceGroup',
          type: 'string',
          description: 'Azure resource group name',
          required: true,
        },
        {
          name: 'appName',
          type: 'string',
          description: 'Name of the deployed resource',
          required: true,
        },
        {
          name: 'resourceType',
          type: 'string',
          description: 'Type of resource: "appservice", "staticwebapp", or "containerapp"',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const resourceGroup = params['resourceGroup'];
    const appName = params['appName'];
    const resourceType = params['resourceType'];

    if (typeof resourceGroup !== 'string') {
      return { success: false, error: 'Parameter "resourceGroup" must be a string' };
    }
    if (typeof appName !== 'string') {
      return { success: false, error: 'Parameter "appName" must be a string' };
    }
    if (typeof resourceType !== 'string' || !['appservice', 'staticwebapp', 'containerapp'].includes(resourceType)) {
      return { success: false, error: 'Parameter "resourceType" must be "appservice", "staticwebapp", or "containerapp"' };
    }

    try {
      let command: string[];

      switch (resourceType) {
        case 'appservice':
          command = ['webapp', 'show', '--name', appName, '--resource-group', resourceGroup];
          break;
        case 'staticwebapp':
          command = ['staticwebapp', 'show', '--name', appName, '--resource-group', resourceGroup];
          break;
        case 'containerapp':
          command = ['containerapp', 'show', '--name', appName, '--resource-group', resourceGroup];
          break;
        default:
          return { success: false, error: 'Invalid resource type' };
      }

      const result = await executeAzureCommand(command, { timeout: 60000 });

      if (result.code !== 0) {
        return {
          success: false,
          error: `Status check failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        output: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get Azure Deployment Logs Tool
 * Get logs from an Azure deployment
 */
export class GetAzureDeploymentLogsTool implements Tool {
  roles: AgentRole[] = AZURE_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'get_azure_deployment_logs',
      description: 'Get logs from an Azure App Service or Container App',
      parameters: [
        {
          name: 'resourceGroup',
          type: 'string',
          description: 'Azure resource group name',
          required: true,
        },
        {
          name: 'appName',
          type: 'string',
          description: 'Name of the deployed resource',
          required: true,
        },
        {
          name: 'resourceType',
          type: 'string',
          description: 'Type of resource: "appservice" or "containerapp"',
          required: true,
        },
        {
          name: 'lines',
          type: 'number',
          description: 'Number of log lines to retrieve (default: 100)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const resourceGroup = params['resourceGroup'];
    const appName = params['appName'];
    const resourceType = params['resourceType'];
    const lines = params['lines'] ?? 100;

    if (typeof resourceGroup !== 'string') {
      return { success: false, error: 'Parameter "resourceGroup" must be a string' };
    }
    if (typeof appName !== 'string') {
      return { success: false, error: 'Parameter "appName" must be a string' };
    }
    if (typeof resourceType !== 'string' || !['appservice', 'containerapp'].includes(resourceType)) {
      return { success: false, error: 'Parameter "resourceType" must be "appservice" or "containerapp"' };
    }

    try {
      let command: string[];

      if (resourceType === 'appservice') {
        command = [
          'webapp',
          'log',
          'tail',
          '--name',
          appName,
          '--resource-group',
          resourceGroup,
          '--timeout',
          '10',
        ];
      } else {
        command = [
          'containerapp',
          'logs',
          'show',
          '--name',
          appName,
          '--resource-group',
          resourceGroup,
          '--tail',
          String(lines),
        ];
      }

      const result = await executeAzureCommand(command, { timeout: 60000 });

      return {
        success: result.code === 0,
        output: result.stdout || result.stderr || '(no logs)',
        error: result.code !== 0 ? `Failed to get logs: ${result.stderr}` : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Delete Azure Deployment Tool
 * Delete an Azure deployment (for cleanup)
 */
export class DeleteAzureDeploymentTool implements Tool {
  roles: AgentRole[] = AZURE_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'delete_azure_deployment',
      description: 'Delete an Azure deployment (for cleanup)',
      parameters: [
        {
          name: 'resourceGroup',
          type: 'string',
          description: 'Azure resource group name',
          required: true,
        },
        {
          name: 'appName',
          type: 'string',
          description: 'Name of the deployed resource',
          required: true,
        },
        {
          name: 'resourceType',
          type: 'string',
          description: 'Type of resource: "appservice", "staticwebapp", or "containerapp"',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const resourceGroup = params['resourceGroup'];
    const appName = params['appName'];
    const resourceType = params['resourceType'];

    if (typeof resourceGroup !== 'string') {
      return { success: false, error: 'Parameter "resourceGroup" must be a string' };
    }
    if (typeof appName !== 'string') {
      return { success: false, error: 'Parameter "appName" must be a string' };
    }
    if (typeof resourceType !== 'string' || !['appservice', 'staticwebapp', 'containerapp'].includes(resourceType)) {
      return { success: false, error: 'Parameter "resourceType" must be "appservice", "staticwebapp", or "containerapp"' };
    }

    try {
      let command: string[];

      switch (resourceType) {
        case 'appservice':
          command = ['webapp', 'delete', '--name', appName, '--resource-group', resourceGroup, '--yes'];
          break;
        case 'staticwebapp':
          command = ['staticwebapp', 'delete', '--name', appName, '--resource-group', resourceGroup, '--yes'];
          break;
        case 'containerapp':
          command = ['containerapp', 'delete', '--name', appName, '--resource-group', resourceGroup, '--yes'];
          break;
        default:
          return { success: false, error: 'Invalid resource type' };
      }

      const result = await executeAzureCommand(command, { timeout: 120000 });

      return {
        success: result.code === 0,
        output: result.code === 0 ? `Azure ${resourceType} "${appName}" deleted` : result.stderr,
        error: result.code !== 0 ? `Delete failed: ${result.stderr}` : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Creates all Azure deployment tools
 */
export function createAzureDeployTools(): Tool[] {
  return [
    new DeployToAzureAppServiceTool(),
    new DeployToAzureStaticWebTool(),
    new DeployToAzureContainerAppsTool(),
    new GetAzureDeploymentStatusTool(),
    new GetAzureDeploymentLogsTool(),
    new DeleteAzureDeploymentTool(),
  ];
}
