/**
 * Jarvis Agent
 *
 * The universal entry point for the ACIA system.
 * Manages multiple CEOs/companies and routes user requests.
 * Handles high-level decision making and human interaction.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';
import { CEOAgent, CEOResult } from './ceo-agent.js';
import { WikiService } from '../../core/wiki/wiki-service.js';

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
3. If no, consider creating a new company or asking for clarification
4. Track all delegated work

When handling escalations:
1. Understand why the CEO couldn't resolve it
2. Provide guidance or make executive decisions
3. Escalate to human only for critical decisions

You are the bridge between humans and the autonomous system.
Always be helpful, clear, and transparent about what's happening.`;

export interface JarvisAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  wikiService?: WikiService;
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
  newCompanyCreated?: boolean;
  escalatedToHuman: boolean;
  humanEscalationReason?: string;
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

  constructor(config: JarvisAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'JARVIS',
      role: 'Universal Assistant',
      systemPrompt: JARVIS_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.wikiService = config.wikiService;
    this.jarvisLLMClient = config.llmClient;
    this.agentTools = config.tools;
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
    action: 'delegate' | 'create_company' | 'status' | 'direct_response';
    companyId?: string;
    companyName?: string;
    domain?: string;
    response?: string;
  }> {
    // Build context about existing companies
    const companiesContext = this.buildCompaniesContext();

    const prompt = `## User Request

${request}

## Current Companies
${companiesContext}

## Task
Analyze this request and determine the best action:

1. DELEGATE - If the request fits an existing company's domain
2. CREATE_COMPANY - If we need a new company for this domain
3. STATUS - If the user is asking about status/progress
4. DIRECT_RESPONSE - If you can answer directly without delegation

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
  async handleRequest(request: string): Promise<{ success: boolean; output: string }> {
    const result = await this.processRequest(request);
    return {
      success: result.success,
      output: result.response,
    };
  }
}
