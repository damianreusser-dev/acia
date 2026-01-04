/**
 * Jarvis Agent
 *
 * The universal entry point for the ACIA system.
 * Manages multiple CEOs/companies and routes user requests.
 * Handles high-level decision making and human interaction.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient, LLMProvider } from '../../core/llm/client.js';
import { CEOAgent, CEOResult, DeploymentConfig, CEODeploymentResult } from './ceo-agent.js';
import { WikiService } from '../../core/wiki/wiki-service.js';
import { createFileTools } from '../../core/tools/file-tools.js';
import { createExecTools } from '../../core/tools/exec-tools.js';
import { createGitTools } from '../../core/tools/git-tools.js';
import { createTemplateTools } from '../../core/tools/template-tools.js';
import { createDockerTools } from '../../core/tools/docker-tools.js';
import { createDeployTools } from '../../core/tools/deploy-tools.js';
import { createAzureDeployTools } from '../../core/tools/azure-tools.js';
import { createDeploymentTemplateTools } from '../../core/tools/deployment-template-tools.js';
import { getMetrics as getGlobalMetrics } from '../../core/metrics/metrics.js';

const JARVIS_SYSTEM_PROMPT = `You are JARVIS, the universal AI assistant and entry point for the ACIA (Autonomous Company Intelligence Architecture) system.

Your responsibilities:
1. Receive requests from users and understand their intent
2. Route requests to appropriate companies/CEOs
3. Create new companies when needed for new domains
4. Provide status updates and summaries
5. Handle human escalations from CEOs
6. Maintain overview of all active work

When receiving a request:
1. Determine if it fits an existing company's domain
2. If yes, delegate to that company's CEO
3. If no, CREATE A NEW COMPANY for any coding/building tasks
4. Track all delegated work

IMPORTANT: For any task that involves:
- Creating applications or projects
- Writing code or implementing features
- Building fullstack, frontend, or backend systems
- Creating files with specific content

You MUST create a company and delegate. This ensures proper:
- Project planning (by PM agent)
- Implementation (by Dev agent)
- Quality assurance (by QA agent)

Only respond directly for simple questions or greetings.

When handling escalations:
1. Understand why the CEO couldn't resolve it
2. Provide guidance or make executive decisions
3. Escalate to human only for critical decisions

You are the bridge between humans and the autonomous system.
Always be helpful, clear, and transparent about what's happening.`;

/**
 * Configuration for JarvisAgent
 * Supports two modes:
 * 1. Explicit: Provide llmClient and tools directly
 * 2. Workspace: Provide workspace path and tools are auto-created
 */
export interface JarvisAgentConfig {
  name?: string;
  llmClient?: LLMClient;
  tools?: Tool[];
  wikiService?: WikiService;
  /** Workspace directory - if provided, tools are auto-created */
  workspace?: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  ceo: CEOAgent;
  createdAt: Date;
  status: 'active' | 'paused' | 'archived';
}

export interface JarvisResult {
  success: boolean;
  response: string;
  delegatedTo?: string;
  ceoResult?: CEOResult;
  deploymentResult?: CEODeploymentResult;
  newCompanyCreated?: boolean;
  escalatedToHuman: boolean;
  humanEscalationReason?: string;
  /** URLs for deployed services */
  urls?: {
    frontendUrl?: string;
    backendUrl?: string;
  };
}

export interface ConversationEntry {
  role: 'user' | 'jarvis';
  message: string;
  timestamp: Date;
  context?: {
    companyId?: string;
    projectId?: string;
  };
}

export class JarvisAgent extends Agent {
  private wikiService?: WikiService;
  private companies: Map<string, Company> = new Map();
  private jarvisLLMClient: LLMClient;
  private conversation: ConversationEntry[] = [];
  private onHumanEscalation?: (reason: string, context: unknown) => void;
  private agentTools: Tool[];
  private workspace: string;
  private metricsData: {
    tokensUsed: number;
    requestCount: number;
    startTime: Date;
  };

  constructor(config: JarvisAgentConfig) {
    // Resolve workspace
    const workspace = config.workspace ?? process.cwd();

    // Create LLM client if not provided
    const provider = (process.env.LLM_PROVIDER ?? 'openai') as LLMProvider;
    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;
    const llmClient = config.llmClient ?? new LLMClient({
      provider,
      apiKey: apiKey ?? '',
    });

    // Create tools if not provided (workspace mode)
    let tools = config.tools;
    if (!tools || tools.length === 0) {
      const fileTools = createFileTools(workspace);
      const execTools = createExecTools(workspace, ['test', 'build', 'typecheck', 'dev', 'lint']);
      const gitTools = createGitTools(workspace);
      const templateTools = createTemplateTools(workspace);
      const dockerTools = createDockerTools();
      const deployTools = createDeployTools();
      const azureTools = createAzureDeployTools();
      const deploymentTemplateTools = createDeploymentTemplateTools(workspace);
      tools = [...fileTools, ...execTools, ...gitTools, ...templateTools, ...dockerTools, ...deployTools, ...azureTools, ...deploymentTemplateTools];
    }

    const agentConfig: AgentConfig = {
      name: config.name ?? 'JARVIS',
      role: 'Universal Assistant',
      systemPrompt: JARVIS_SYSTEM_PROMPT,
      llmClient,
      tools,
    };
    super(agentConfig);
    this.wikiService = config.wikiService;
    this.jarvisLLMClient = llmClient;
    this.agentTools = tools;
    this.workspace = workspace;
    this.metricsData = {
      tokensUsed: 0,
      requestCount: 0,
      startTime: new Date(),
    };
  }

  /**
   * Set callback for human escalation
   */
  setHumanEscalationHandler(handler: (reason: string, context: unknown) => void): void {
    this.onHumanEscalation = handler;
  }

  /**
   * Process a user request
   * Main entry point for all user interactions
   */
  async processRequest(request: string): Promise<JarvisResult> {
    // Log the conversation
    this.conversation.push({
      role: 'user',
      message: request,
      timestamp: new Date(),
    });

    try {
      // Analyze the request to determine routing
      const analysis = await this.analyzeRequest(request);

      let result: JarvisResult;

      if (analysis.action === 'delegate') {
        result = await this.delegateToCompany(request, analysis.companyId!);
      } else if (analysis.action === 'create_company') {
        result = await this.createCompanyAndDelegate(
          request,
          analysis.companyName!,
          analysis.domain!
        );
      } else if (analysis.action === 'create_company_with_deploy') {
        result = await this.createCompanyAndDeploy(
          request,
          analysis.companyName!,
          analysis.domain!,
          analysis.deployTarget!
        );
      } else if (analysis.action === 'status') {
        result = this.getStatusReport();
      } else if (analysis.action === 'direct_response') {
        result = {
          success: true,
          response: analysis.response!,
          escalatedToHuman: false,
        };
      } else {
        result = {
          success: false,
          response: 'I could not determine how to handle your request.',
          escalatedToHuman: true,
          humanEscalationReason: 'Unknown action type',
        };
      }

      // Log response
      this.conversation.push({
        role: 'jarvis',
        message: result.response,
        timestamp: new Date(),
        context: result.delegatedTo ? { companyId: result.delegatedTo } : undefined,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: JarvisResult = {
        success: false,
        response: `An error occurred: ${errorMessage}`,
        escalatedToHuman: true,
        humanEscalationReason: errorMessage,
      };

      if (this.onHumanEscalation) {
        this.onHumanEscalation(errorMessage, { request });
      }

      return result;
    }
  }

  /**
   * Analyze a request to determine the appropriate action
   */
  private async analyzeRequest(request: string): Promise<{
    action: 'delegate' | 'create_company' | 'create_company_with_deploy' | 'status' | 'direct_response';
    companyId?: string;
    companyName?: string;
    domain?: string;
    response?: string;
    deployTarget?: DeploymentConfig['target'];
  }> {
    // Check for deployment intent first (fast path)
    const deploymentIntent = this.detectDeploymentIntent(request);
    if (deploymentIntent.hasDeployIntent) {
      return {
        action: 'create_company_with_deploy',
        companyName: this.extractProjectName(request) || 'DeployProject',
        domain: 'Fullstack Application with Deployment',
        deployTarget: deploymentIntent.target,
      };
    }

    // Build context about existing companies
    const companiesContext = this.buildCompaniesContext();

    const prompt = `## User Request

${request}

## Current Companies
${companiesContext}

## Task
Analyze this request and determine the best action:

1. DELEGATE - If the request fits an existing company's domain
2. CREATE_COMPANY - If the request involves building an application, creating a project, or any substantial coding work
3. STATUS - If the user is asking about status/progress
4. DIRECT_RESPONSE - ONLY for simple questions or greetings (NOT for coding tasks)

IMPORTANT: For any task that involves creating files, building applications, or implementing features:
- Use CREATE_COMPANY to set up proper team structure (PM, Dev, QA)
- This ensures proper planning, implementation, and quality assurance

Examples requiring CREATE_COMPANY:
- "Create a todo application" → CREATE_COMPANY
- "Build a fullstack app" → CREATE_COMPANY
- "Implement a REST API" → CREATE_COMPANY
- "Create a greeting.txt file" → CREATE_COMPANY

Examples for DIRECT_RESPONSE:
- "Hello" or "Hi" → DIRECT_RESPONSE
- "What is TypeScript?" → DIRECT_RESPONSE (informational only)

Respond with:
ACTION: [delegate/create_company/status/direct_response]
COMPANY_ID: [existing company id, if delegate]
COMPANY_NAME: [new company name, if create_company]
DOMAIN: [company domain description, if create_company]
RESPONSE: [direct answer, if direct_response or status]`;

    const response = await this.processMessage(prompt);
    return this.parseAnalysisResponse(response);
  }

  /**
   * Detect deployment intent from request
   */
  private detectDeploymentIntent(request: string): {
    hasDeployIntent: boolean;
    target: DeploymentConfig['target'];
  } {
    const lowerRequest = request.toLowerCase();

    // Keywords that indicate deployment intent
    const deployKeywords = ['deploy', 'launch', 'host', 'put online', 'run it', 'make it live'];
    const hasDeployIntent = deployKeywords.some(k => lowerRequest.includes(k));

    if (!hasDeployIntent) {
      return { hasDeployIntent: false, target: 'local' };
    }

    // Determine deployment target
    const azureKeywords = ['azure', 'cloud', 'production', 'app service'];
    const localKeywords = ['locally', 'docker', 'local', 'localhost'];

    if (localKeywords.some(k => lowerRequest.includes(k))) {
      return { hasDeployIntent: true, target: 'local' };
    }

    if (azureKeywords.some(k => lowerRequest.includes(k))) {
      // Check for container apps vs app service
      if (lowerRequest.includes('container')) {
        return { hasDeployIntent: true, target: 'azure-containers' };
      }
      return { hasDeployIntent: true, target: 'azure-appservice' };
    }

    // Default to local if just "deploy" is mentioned
    return { hasDeployIntent: true, target: 'local' };
  }

  /**
   * Extract project name from request
   */
  private extractProjectName(request: string): string | undefined {
    // Common patterns for project names
    const patterns = [
      /create\s+(?:a\s+)?(?:fullstack\s+)?(\w+)\s+app/i,
      /build\s+(?:a\s+)?(\w+)\s+application/i,
      /(?:todo|task|note|blog|chat)\s+app/i,
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match?.[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1) + 'App';
      }
      if (match) {
        // For patterns like "todo app", extract the type
        const typeMatch = request.match(/(todo|task|note|blog|chat)/i);
        if (typeMatch?.[1]) {
          return typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1) + 'App';
        }
      }
    }

    return undefined;
  }

  /**
   * Parse the analysis response
   */
  private parseAnalysisResponse(response: string): {
    action: 'delegate' | 'create_company' | 'status' | 'direct_response';
    companyId?: string;
    companyName?: string;
    domain?: string;
    response?: string;
  } {
    const actionMatch = response.match(/ACTION:\s*(delegate|create_company|status|direct_response)/i);
    const companyIdMatch = response.match(/COMPANY_ID:\s*(\S+)/i);
    const companyNameMatch = response.match(/COMPANY_NAME:\s*(.+)/i);
    const domainMatch = response.match(/DOMAIN:\s*(.+)/i);
    const responseMatch = response.match(/RESPONSE:\s*([\s\S]+?)(?=\n(?:ACTION|COMPANY|DOMAIN):|$)/i);

    const action = (actionMatch?.[1]?.toLowerCase() as 'delegate' | 'create_company' | 'status' | 'direct_response') ?? 'direct_response';

    return {
      action,
      companyId: companyIdMatch?.[1]?.trim(),
      companyName: companyNameMatch?.[1]?.trim(),
      domain: domainMatch?.[1]?.trim(),
      response: responseMatch?.[1]?.trim() ?? response,
    };
  }

  /**
   * Build context string about existing companies
   */
  private buildCompaniesContext(): string {
    if (this.companies.size === 0) {
      return 'No companies currently active.';
    }

    const companyList = Array.from(this.companies.values())
      .map((c) => `- ${c.id}: "${c.name}" (${c.domain}) [${c.status}]`)
      .join('\n');

    return companyList;
  }

  /**
   * Delegate a request to an existing company
   */
  private async delegateToCompany(request: string, companyId: string): Promise<JarvisResult> {
    const company = this.companies.get(companyId);

    if (!company) {
      return {
        success: false,
        response: `Company "${companyId}" not found.`,
        escalatedToHuman: false,
      };
    }

    // Execute through the CEO
    const ceoResult = await company.ceo.executeGoal(request);

    // Generate summary
    const summary = this.generateResultSummary(ceoResult, company);

    return {
      success: ceoResult.success,
      response: summary,
      delegatedTo: companyId,
      ceoResult,
      escalatedToHuman: ceoResult.escalatedToHuman,
      humanEscalationReason: ceoResult.humanEscalationReason,
    };
  }

  /**
   * Create a new company and delegate the request
   */
  private async createCompanyAndDelegate(
    request: string,
    companyName: string,
    domain: string
  ): Promise<JarvisResult> {
    const companyId = `company_${Date.now().toString(36)}`;

    // Create new CEO for this company
    const ceo = new CEOAgent({
      name: `${companyName} CEO`,
      llmClient: this.jarvisLLMClient,
      tools: this.agentTools,
      wikiService: this.wikiService,
    });

    // Create default teams for the CEO
    // The teams share the same workspace and tools as Jarvis
    ceo.createTeam('default', {
      workspace: this.workspace,
      llmClient: this.jarvisLLMClient,
      tools: this.agentTools,
    });

    // For fullstack projects, create specialized teams
    if (domain.toLowerCase().includes('fullstack') ||
        domain.toLowerCase().includes('web') ||
        domain.toLowerCase().includes('application')) {
      ceo.createTeam('frontend', {
        workspace: this.workspace,
        llmClient: this.jarvisLLMClient,
        tools: this.agentTools,
      });
      ceo.createTeam('backend', {
        workspace: this.workspace,
        llmClient: this.jarvisLLMClient,
        tools: this.agentTools,
      });
    }

    // Register the company
    const company: Company = {
      id: companyId,
      name: companyName,
      domain,
      ceo,
      createdAt: new Date(),
      status: 'active',
    };
    this.companies.set(companyId, company);

    // Log to wiki if available
    if (this.wikiService) {
      await this.logCompanyCreation(company);
    }

    // Now delegate the request
    const delegateResult = await this.delegateToCompany(request, companyId);

    return {
      ...delegateResult,
      newCompanyCreated: true,
      response: `Created new company "${companyName}" for ${domain}.\n\n${delegateResult.response}`,
    };
  }

  /**
   * Create a new company, build the project, and deploy it
   *
   * This orchestrates the full build-deploy-monitor workflow:
   * 1. Create company with CEO and teams
   * 2. Build the application via tech team
   * 3. Deploy via ops team
   * 4. Set up monitoring
   */
  private async createCompanyAndDeploy(
    request: string,
    companyName: string,
    domain: string,
    deployTarget: DeploymentConfig['target']
  ): Promise<JarvisResult> {
    const companyId = `company_${Date.now().toString(36)}`;

    // Create new CEO for this company
    const ceo = new CEOAgent({
      name: `${companyName} CEO`,
      llmClient: this.jarvisLLMClient,
      tools: this.agentTools,
      wikiService: this.wikiService,
    });

    // Create default tech team for building
    ceo.createTeam('default', {
      workspace: this.workspace,
      llmClient: this.jarvisLLMClient,
      tools: this.agentTools,
    });

    // Create specialized teams
    ceo.createTeam('frontend', {
      workspace: this.workspace,
      llmClient: this.jarvisLLMClient,
      tools: this.agentTools,
    });
    ceo.createTeam('backend', {
      workspace: this.workspace,
      llmClient: this.jarvisLLMClient,
      tools: this.agentTools,
    });

    // Register the company
    const company: Company = {
      id: companyId,
      name: companyName,
      domain,
      ceo,
      createdAt: new Date(),
      status: 'active',
    };
    this.companies.set(companyId, company);

    // Log to wiki if available
    if (this.wikiService) {
      await this.logCompanyCreation(company);
    }

    // Configure deployment
    const deploymentConfig: DeploymentConfig = {
      target: deployTarget,
      monitor: true,
      ports: { frontend: 3000, backend: 3001 },
    };

    // Execute build, deploy, and monitor workflow
    const deploymentResult = await ceo.executeGoalWithDeployment(request, 'default', deploymentConfig);

    // Generate enhanced summary with URLs
    const summary = this.generateDeploymentSummary(deploymentResult, company);

    return {
      success: deploymentResult.success,
      response: summary,
      delegatedTo: companyId,
      ceoResult: deploymentResult.buildResult,
      deploymentResult,
      newCompanyCreated: true,
      escalatedToHuman: deploymentResult.escalatedToHuman,
      humanEscalationReason: deploymentResult.humanEscalationReason,
      urls: deploymentResult.deployResult ? {
        frontendUrl: deploymentResult.deployResult.frontendUrl,
        backendUrl: deploymentResult.deployResult.backendUrl,
      } : undefined,
    };
  }

  /**
   * Generate a summary for deployment results
   */
  private generateDeploymentSummary(result: CEODeploymentResult, company: Company): string {
    let summary = `## ${company.name} - Deployment Complete\n\n`;

    // Build phase summary
    if (result.buildResult.success) {
      summary += `✅ **Build Phase**: All ${result.buildResult.completedProjects} project(s) completed successfully.\n\n`;
    } else {
      summary += `❌ **Build Phase**: Failed (${result.buildResult.failedProjects} project(s) failed)\n`;
      if (result.buildResult.humanEscalationReason) {
        summary += `   Reason: ${result.buildResult.humanEscalationReason}\n`;
      }
      summary += '\n';
      return summary;
    }

    // Deployment phase summary
    if (result.deployResult) {
      if (result.deployResult.success) {
        summary += `✅ **Deployment Phase**: Deployed successfully.\n\n`;

        // Show URLs
        summary += `### Your Application is Live!\n\n`;
        if (result.deployResult.frontendUrl) {
          summary += `- **Frontend**: ${result.deployResult.frontendUrl}\n`;
        }
        if (result.deployResult.backendUrl) {
          summary += `- **Backend API**: ${result.deployResult.backendUrl}\n`;
          summary += `- **Health Check**: ${result.deployResult.backendUrl}/health\n`;
        }
        summary += '\n';
      } else {
        summary += `❌ **Deployment Phase**: Failed\n`;
        if (result.deployResult.error) {
          summary += `   Error: ${result.deployResult.error}\n`;
        }
        summary += '\n';
      }
    }

    // Monitoring phase summary
    if (result.monitoringResult) {
      if (result.monitoringResult.active) {
        summary += `✅ **Monitoring**: Active\n`;
        summary += `   Watching ${result.monitoringResult.targets.length} endpoint(s)\n`;
        summary += `   Health checks running every 30 seconds.\n`;
      }
    }

    // Escalation notice
    if (result.escalatedToHuman) {
      summary += `\n⚠️ **Human Input Required**: ${result.humanEscalationReason}\n`;
    }

    return summary;
  }

  /**
   * Get status report of all companies and active work
   */
  private getStatusReport(): JarvisResult {
    if (this.companies.size === 0) {
      return {
        success: true,
        response: 'No companies are currently active. I can create a new company when you give me a task.',
        escalatedToHuman: false,
      };
    }

    let report = '## ACIA System Status\n\n';
    report += `**Active Companies**: ${this.companies.size}\n\n`;

    for (const [id, company] of this.companies) {
      report += `### ${company.name}\n`;
      report += `- **ID**: ${id}\n`;
      report += `- **Domain**: ${company.domain}\n`;
      report += `- **Status**: ${company.status}\n`;
      report += `- **Created**: ${company.createdAt.toISOString()}\n`;

      const projects = company.ceo.getActiveProjects();
      if (projects.length > 0) {
        report += `- **Active Projects**: ${projects.length}\n`;
        for (const project of projects) {
          report += `  - ${project.title} (${project.status}, ${project.priority})\n`;
        }
      }
      report += '\n';
    }

    return {
      success: true,
      response: report,
      escalatedToHuman: false,
    };
  }

  /**
   * Generate a summary of CEO execution results
   */
  private generateResultSummary(result: CEOResult, company: Company): string {
    let summary = `## ${company.name} Report\n\n`;

    if (result.success) {
      summary += `✅ All ${result.completedProjects} project(s) completed successfully.\n\n`;
    } else {
      summary += `⚠️ Completed: ${result.completedProjects}, Failed: ${result.failedProjects}\n\n`;
    }

    if (result.projects.length > 0) {
      summary += '### Projects\n';
      for (const project of result.projects) {
        const statusIcon = project.status === 'completed' ? '✓' : project.status === 'blocked' ? '✗' : '○';
        summary += `${statusIcon} **${project.title}** (${project.priority}): ${project.status}\n`;
      }
      summary += '\n';
    }

    if (result.escalatedToHuman) {
      summary += `\n⚠️ **Human Input Required**: ${result.humanEscalationReason}\n`;
    }

    return summary;
  }

  /**
   * Log company creation to wiki
   */
  private async logCompanyCreation(company: Company): Promise<void> {
    if (!this.wikiService) return;

    const content = `# ${company.name}

**Created**: ${company.createdAt.toISOString()}
**Domain**: ${company.domain}
**Status**: ${company.status}

## Description
Company created to handle: ${company.domain}

## Activity Log
- ${company.createdAt.toISOString()}: Company created

`;

    await this.wikiService.writePage(`companies/${company.id}.md`, { content });
  }

  /**
   * Get a company by ID
   */
  getCompany(companyId: string): Company | undefined {
    return this.companies.get(companyId);
  }

  /**
   * Get all companies
   */
  getCompanies(): Company[] {
    return Array.from(this.companies.values());
  }

  /**
   * Register an existing company (for testing or initialization)
   */
  registerCompany(company: Company): void {
    this.companies.set(company.id, company);
  }

  /**
   * Get conversation history
   */
  getConversation(): ConversationEntry[] {
    return [...this.conversation];
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversation = [];
  }

  /**
   * Pause a company
   */
  pauseCompany(companyId: string): boolean {
    const company = this.companies.get(companyId);
    if (company) {
      company.status = 'paused';
      return true;
    }
    return false;
  }

  /**
   * Resume a paused company
   */
  resumeCompany(companyId: string): boolean {
    const company = this.companies.get(companyId);
    if (company && company.status === 'paused') {
      company.status = 'active';
      return true;
    }
    return false;
  }

  /**
   * Archive a company
   */
  archiveCompany(companyId: string): boolean {
    const company = this.companies.get(companyId);
    if (company) {
      company.status = 'archived';
      return true;
    }
    return false;
  }

  /**
   * Handle a request - simplified interface for benchmarks
   *
   * This is a convenience method that wraps processRequest for benchmark testing.
   * It returns a simplified response format with just success and output fields.
   */
  async handleRequest(request: string): Promise<{
    success: boolean;
    output: string;
    status?: string;
    response?: string;
    escalation?: string;
  }> {
    this.metricsData.requestCount++;
    const result = await this.processRequest(request);

    // Track token usage from global metrics
    const globalMetrics = getGlobalMetrics();
    const snapshot = globalMetrics.getSnapshot();
    this.metricsData.tokensUsed = snapshot.llm.totalInputTokens + snapshot.llm.totalOutputTokens;

    return {
      success: result.success,
      output: result.response,
      status: result.success ? 'completed' : 'failed',
      response: result.response,
      escalation: result.humanEscalationReason,
    };
  }

  /**
   * Get metrics for monitoring and benchmarks
   */
  getMetrics(): {
    tokensUsed: number;
    requestCount: number;
    uptime: number;
    companiesCount: number;
  } {
    return {
      tokensUsed: this.metricsData.tokensUsed,
      requestCount: this.metricsData.requestCount,
      uptime: Date.now() - this.metricsData.startTime.getTime(),
      companiesCount: this.companies.size,
    };
  }

  /**
   * Get the workspace directory
   */
  getWorkspace(): string {
    return this.workspace;
  }
}
