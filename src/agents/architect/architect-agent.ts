/**
 * Architect Agent
 *
 * Creates technical designs and API contracts before implementation.
 * Enables parallel team execution by defining clear interfaces.
 *
 * Key responsibilities:
 * - System architecture design
 * - API contract definition
 * - Shared type specifications
 * - File structure planning
 * - Technology decisions
 *
 * @see docs/COORDINATION.md for the contract-first development approach
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';
import { WikiService } from '../../core/wiki/wiki-service.js';

const ARCHITECT_SYSTEM_PROMPT = `You are a Software Architect Agent in an autonomous software development team.

Your primary responsibility is to create technical designs that enable multiple teams to work in parallel without conflicts.

## When You Receive a Project Request

You must create a comprehensive System Design Document that includes:

### 1. SYSTEM OVERVIEW
- High-level architecture description
- Component responsibilities
- Technology choices with brief rationale

### 2. FILE STRUCTURE
- Directory layout for the project
- What files go where
- Shared code locations

### 3. API CONTRACTS (if the project has frontend/backend)
- Every endpoint with HTTP method and path
- Request body types (TypeScript interfaces)
- Response types (TypeScript interfaces)
- Error response format
- Authentication requirements (if any)

### 4. DATA MODELS
- TypeScript interfaces for all entities
- Required vs optional fields
- Validation rules

### 5. COMMUNICATION
- How components communicate (REST, WebSocket, etc.)
- Ports and URLs
- CORS configuration
- Error handling patterns

## Output Format

You must output your design in this exact format for parsing:

SYSTEM_OVERVIEW:
[Your system overview here]

FILE_STRUCTURE:
[Directory tree here]

API_CONTRACTS:
[Endpoint definitions here]

DATA_MODELS:
\`\`\`typescript
[TypeScript interfaces here]
\`\`\`

COMMUNICATION:
[Communication details here]

TECH_STACK:
[Technology choices here]

## Important Guidelines

1. Be SPECIFIC - vague designs lead to integration failures
2. Define ALL interfaces upfront - teams can't work in parallel without contracts
3. Include error handling - what happens when things fail
4. Consider security - auth, validation, sanitization
5. Keep it simple - don't over-engineer

Your design must be detailed enough that:
- Frontend team can build UI without waiting for backend
- Backend team can implement API without waiting for frontend
- QA can write integration tests from the spec
- Teams can work in PARALLEL, not sequentially`;

export interface ArchitectAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
  wikiService?: WikiService;
}

/**
 * Represents a complete system design
 */
export interface SystemDesign {
  /** Unique identifier for the design */
  id: string;
  /** Project name/title */
  projectName: string;
  /** High-level system overview */
  overview: string;
  /** Directory/file structure */
  fileStructure: string;
  /** API endpoint contracts */
  apiContracts: ApiContract[];
  /** TypeScript data models */
  dataModels: string;
  /** Communication protocols and configuration */
  communication: CommunicationConfig;
  /** Technology stack choices */
  techStack: TechStackChoice[];
  /** Path where design is stored in wiki */
  wikiPath?: string;
  /** When the design was created */
  createdAt: Date;
}

/**
 * API endpoint contract
 */
export interface ApiContract {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Endpoint path */
  path: string;
  /** Endpoint description */
  description: string;
  /** Request body type (TypeScript interface name) */
  requestType?: string;
  /** Response body type (TypeScript interface name) */
  responseType: string;
  /** Query parameters */
  queryParams?: Array<{ name: string; type: string; required: boolean }>;
  /** Whether authentication is required */
  authRequired: boolean;
}

/**
 * Communication configuration between components
 */
export interface CommunicationConfig {
  /** Protocol used (REST, WebSocket, etc.) */
  protocol: string;
  /** Backend port */
  backendPort: number;
  /** Frontend port */
  frontendPort: number;
  /** Base URL for API */
  apiBaseUrl: string;
  /** CORS configuration */
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
  };
  /** Error response format description */
  errorFormat: string;
}

/**
 * Technology stack choice
 */
export interface TechStackChoice {
  /** Component (frontend, backend, database, etc.) */
  component: string;
  /** Technology chosen */
  technology: string;
  /** Brief rationale */
  rationale: string;
}

export class ArchitectAgent extends Agent {
  private workspace: string;
  private wikiService?: WikiService;

  constructor(config: ArchitectAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'ArchitectAgent',
      role: 'Software Architect',
      systemPrompt: ARCHITECT_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
    this.wikiService = config.wikiService;
  }

  /**
   * Create a system design for a project
   */
  async createDesign(projectRequest: string): Promise<SystemDesign> {
    const prompt = this.buildDesignPrompt(projectRequest);
    const response = await this.processMessageWithTools(prompt);

    const design = this.parseDesignResponse(response, projectRequest);

    // Write design to wiki if available
    if (this.wikiService) {
      await this.writeDesignToWiki(design);
    }

    return design;
  }

  /**
   * Build the prompt for design creation
   */
  private buildDesignPrompt(projectRequest: string): string {
    let prompt = `## Create System Design\n\n`;
    prompt += `**Project Request**:\n${projectRequest}\n\n`;
    prompt += `**Workspace**: ${this.workspace}\n\n`;
    prompt += `Please create a comprehensive system design following the format specified in your instructions.\n\n`;
    prompt += `Important:\n`;
    prompt += `- If this is a fullstack project, define API contracts between frontend and backend\n`;
    prompt += `- Define TypeScript interfaces for all data models\n`;
    prompt += `- Specify file structure so teams know where to put code\n`;
    prompt += `- Be specific about ports, URLs, and communication patterns\n`;

    return prompt;
  }

  /**
   * Parse design response from LLM
   */
  private parseDesignResponse(response: string, projectRequest: string): SystemDesign {
    const id = `design_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    // Extract project name from request
    const projectName = this.extractProjectName(projectRequest);

    // Parse SYSTEM_OVERVIEW
    const overviewMatch = response.match(/SYSTEM_OVERVIEW:?\s*([\s\S]*?)(?=FILE_STRUCTURE:|API_CONTRACTS:|DATA_MODELS:|COMMUNICATION:|TECH_STACK:|$)/i);
    const overview = overviewMatch && overviewMatch[1] ? overviewMatch[1].trim() : projectRequest;

    // Parse FILE_STRUCTURE
    const fileStructureMatch = response.match(/FILE_STRUCTURE:?\s*([\s\S]*?)(?=SYSTEM_OVERVIEW:|API_CONTRACTS:|DATA_MODELS:|COMMUNICATION:|TECH_STACK:|$)/i);
    const fileStructure = fileStructureMatch && fileStructureMatch[1] ? fileStructureMatch[1].trim() : '';

    // Parse API_CONTRACTS
    const apiContracts = this.parseApiContracts(response);

    // Parse DATA_MODELS
    const dataModelsMatch = response.match(/DATA_MODELS:?\s*```typescript\s*([\s\S]*?)```/i);
    const dataModels = dataModelsMatch && dataModelsMatch[1] ? dataModelsMatch[1].trim() : '';

    // Parse COMMUNICATION
    const communication = this.parseCommunicationConfig(response);

    // Parse TECH_STACK
    const techStack = this.parseTechStack(response);

    // Generate wiki path - ensure we have a valid name
    let safeProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .substring(0, 50);

    // Fallback if name becomes empty after sanitization
    if (!safeProjectName) {
      safeProjectName = `project-${Date.now().toString(36)}`;
    }

    return {
      id,
      projectName,
      overview,
      fileStructure,
      apiContracts,
      dataModels,
      communication,
      techStack,
      wikiPath: `designs/${safeProjectName}`,
      createdAt: new Date(),
    };
  }

  /**
   * Extract project name from request
   */
  private extractProjectName(request: string): string {
    // Try to find a clear project name
    const patterns = [
      /build\s+(?:a\s+)?(.+?)(?:\s+with|\s+using|\s+application|\s+app|\.|$)/i,
      /create\s+(?:a\s+)?(.+?)(?:\s+with|\s+using|\s+application|\s+app|\.|$)/i,
      /(.+?)\s+application/i,
      /(.+?)\s+app/i,
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: use first few words
    const words = request.split(/\s+/).slice(0, 5).join(' ');
    return words.length > 50 ? words.substring(0, 50) : words;
  }

  /**
   * Parse API contracts from response
   */
  private parseApiContracts(response: string): ApiContract[] {
    const contracts: ApiContract[] = [];

    const apiSection = response.match(/API_CONTRACTS:?\s*([\s\S]*?)(?=SYSTEM_OVERVIEW:|FILE_STRUCTURE:|DATA_MODELS:|COMMUNICATION:|TECH_STACK:|$)/i);
    if (!apiSection || !apiSection[1]) {
      return contracts;
    }

    const section = apiSection[1];

    // Match patterns like: GET /api/todos - Description
    // or: POST /api/todos - Create todo, Request: CreateTodoRequest, Response: Todo
    const endpointPattern = /(GET|POST|PUT|PATCH|DELETE)\s+([/\w:-]+)\s*[-:]?\s*([^\n]+)?/gi;
    let match;

    while ((match = endpointPattern.exec(section)) !== null) {
      if (!match[1] || !match[2]) continue;

      const method = match[1].toUpperCase() as ApiContract['method'];
      const path = match[2].trim();
      const rest = match[3] || '';

      // Parse description and types from the rest
      const descMatch = rest.match(/^([^,\n]+)/);
      const description = descMatch && descMatch[1] ? descMatch[1].trim() : `${method} ${path}`;

      const requestTypeMatch = rest.match(/Request:?\s*(\w+)/i);
      const requestType = requestTypeMatch && requestTypeMatch[1] ? requestTypeMatch[1] : undefined;

      const responseTypeMatch = rest.match(/Response:?\s*(\w+(?:\[\])?)/i);
      const responseType = responseTypeMatch && responseTypeMatch[1] ? responseTypeMatch[1] : 'void';

      const authRequired = /auth|protected|authenticated/i.test(rest);

      contracts.push({
        method,
        path,
        description,
        requestType,
        responseType,
        authRequired,
      });
    }

    return contracts;
  }

  /**
   * Parse communication configuration from response
   */
  private parseCommunicationConfig(response: string): CommunicationConfig {
    const commSection = response.match(/COMMUNICATION:?\s*([\s\S]*?)(?=SYSTEM_OVERVIEW:|FILE_STRUCTURE:|API_CONTRACTS:|DATA_MODELS:|TECH_STACK:|$)/i);
    const section = commSection && commSection[1] ? commSection[1] : '';

    // Extract ports
    const backendPortMatch = section.match(/backend.*?port[:\s]*(\d+)/i) || section.match(/port[:\s]*(\d+).*?backend/i);
    const frontendPortMatch = section.match(/frontend.*?port[:\s]*(\d+)/i) || section.match(/port[:\s]*(\d+).*?frontend/i);

    const backendPort = backendPortMatch && backendPortMatch[1] ? parseInt(backendPortMatch[1], 10) : 3001;
    const frontendPort = frontendPortMatch && frontendPortMatch[1] ? parseInt(frontendPortMatch[1], 10) : 3000;

    // Extract protocol
    const protocolMatch = section.match(/protocol[:\s]*(REST|WebSocket|GraphQL|gRPC)/i);
    const protocol = protocolMatch && protocolMatch[1] ? protocolMatch[1] : 'REST';

    // Extract API base URL
    const apiUrlMatch = section.match(/api.*?url[:\s]*([^\s\n]+)/i) || section.match(/base.*?url[:\s]*([^\s\n]+)/i);
    const apiBaseUrl = apiUrlMatch && apiUrlMatch[1] ? apiUrlMatch[1] : `http://localhost:${backendPort}/api`;

    // Extract CORS origins
    const corsMatch = section.match(/cors.*?origin[s]?[:\s]*([^\n]+)/i);
    const corsOrigins = corsMatch && corsMatch[1]
      ? corsMatch[1].split(/[,\s]+/).filter(o => o.startsWith('http') || o.includes('localhost'))
      : [`http://localhost:${frontendPort}`];

    // Extract error format
    const errorMatch = section.match(/error.*?format[:\s]*([^\n]+)/i);
    const errorFormat = errorMatch && errorMatch[1] ? errorMatch[1].trim() : '{ error: string, code?: string }';

    return {
      protocol,
      backendPort,
      frontendPort,
      apiBaseUrl,
      cors: {
        allowedOrigins: corsOrigins.length > 0 ? corsOrigins : [`http://localhost:${frontendPort}`],
        allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      },
      errorFormat,
    };
  }

  /**
   * Parse technology stack from response
   */
  private parseTechStack(response: string): TechStackChoice[] {
    const stack: TechStackChoice[] = [];

    const techSection = response.match(/TECH_STACK:?\s*([\s\S]*?)(?=SYSTEM_OVERVIEW:|FILE_STRUCTURE:|API_CONTRACTS:|DATA_MODELS:|COMMUNICATION:|$)/i);
    if (!techSection || !techSection[1]) {
      return stack;
    }

    const section = techSection[1];

    // Match patterns like: Frontend: React - Modern UI library
    // or: - Frontend: React (component-based)
    const techPattern = /[-*]?\s*(frontend|backend|database|testing|build|deployment)[:\s]+([^-\n(]+)(?:[-:(]\s*([^)\n]+))?/gi;
    let match;

    while ((match = techPattern.exec(section)) !== null) {
      if (!match[1] || !match[2]) continue;

      stack.push({
        component: match[1].toLowerCase(),
        technology: match[2].trim(),
        rationale: match[3] ? match[3].trim() : '',
      });
    }

    return stack;
  }

  /**
   * Write design to wiki
   */
  private async writeDesignToWiki(design: SystemDesign): Promise<void> {
    if (!this.wikiService || !design.wikiPath) return;

    // Write main design document
    const designContent = this.formatDesignForWiki(design);
    await this.wikiService.writePage(`${design.wikiPath}/design.md`, {
      title: `System Design: ${design.projectName}`,
      content: designContent,
    });

    // Write contracts as separate TypeScript file
    if (design.dataModels) {
      const contractsContent = this.formatContractsForWiki(design);
      await this.wikiService.writePage(`${design.wikiPath}/contracts.md`, {
        title: `Contracts: ${design.projectName}`,
        content: contractsContent,
      });
    }
  }

  /**
   * Format design document for wiki storage
   */
  private formatDesignForWiki(design: SystemDesign): string {
    let content = `## Overview\n\n${design.overview}\n\n`;

    content += `## File Structure\n\n\`\`\`\n${design.fileStructure}\n\`\`\`\n\n`;

    if (design.apiContracts.length > 0) {
      content += `## API Contracts\n\n`;
      content += `| Method | Path | Description | Auth |\n`;
      content += `|--------|------|-------------|------|\n`;
      for (const api of design.apiContracts) {
        content += `| ${api.method} | ${api.path} | ${api.description} | ${api.authRequired ? 'Yes' : 'No'} |\n`;
      }
      content += `\n`;
    }

    if (design.techStack.length > 0) {
      content += `## Technology Stack\n\n`;
      for (const tech of design.techStack) {
        content += `- **${tech.component}**: ${tech.technology}${tech.rationale ? ` - ${tech.rationale}` : ''}\n`;
      }
      content += `\n`;
    }

    content += `## Communication\n\n`;
    content += `- **Protocol**: ${design.communication.protocol}\n`;
    content += `- **Backend Port**: ${design.communication.backendPort}\n`;
    content += `- **Frontend Port**: ${design.communication.frontendPort}\n`;
    content += `- **API Base URL**: ${design.communication.apiBaseUrl}\n`;
    content += `- **CORS Origins**: ${design.communication.cors.allowedOrigins.join(', ')}\n`;
    content += `- **Error Format**: ${design.communication.errorFormat}\n\n`;

    content += `---\n*Created by ${this.name} on ${design.createdAt.toISOString()}*\n`;

    return content;
  }

  /**
   * Format contracts for wiki storage
   */
  private formatContractsForWiki(design: SystemDesign): string {
    let content = `## Data Models\n\n`;
    content += `These TypeScript interfaces define the contract between frontend and backend.\n\n`;
    content += `\`\`\`typescript\n${design.dataModels}\n\`\`\`\n\n`;

    if (design.apiContracts.length > 0) {
      content += `## API Endpoints\n\n`;
      for (const api of design.apiContracts) {
        content += `### ${api.method} ${api.path}\n\n`;
        content += `${api.description}\n\n`;
        if (api.requestType) {
          content += `- **Request**: \`${api.requestType}\`\n`;
        }
        content += `- **Response**: \`${api.responseType}\`\n`;
        content += `- **Auth Required**: ${api.authRequired ? 'Yes' : 'No'}\n\n`;
      }
    }

    return content;
  }

  /**
   * Get the workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }

  /**
   * Check if wiki service is available
   */
  hasWiki(): boolean {
    return this.wikiService !== undefined;
  }
}
