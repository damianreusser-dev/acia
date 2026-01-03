/**
 * Operations Division
 *
 * Coordinates DevOpsAgent, MonitoringAgent, and IncidentAgent for operations workflows.
 * Implements ITeam interface for integration with CEO and TeamFactory.
 *
 * Workflow: Deploy → Monitor → Respond
 *
 * Part of Phase 6f-6g: OpsDivision and Registration
 */

import { ITeam, WorkflowResult, Priority, TeamCallbacks } from '../../team/team-interface.js';
import { LLMClient } from '../../core/llm/client.js';
import { Tool, filterToolsByRole } from '../../core/tools/types.js';
import { WikiService } from '../../core/wiki/wiki-service.js';
import { createTask, Task, TaskResult } from '../../core/tasks/types.js';
import { DevOpsAgent } from '../../agents/devops/devops-agent.js';
import { MonitoringAgent, MonitoringTarget } from '../../agents/ops/monitoring-agent.js';
import { IncidentAgent, Runbook } from '../../agents/ops/incident-agent.js';

/**
 * Configuration for OpsDivision
 */
export interface OpsDivisionConfig extends TeamCallbacks {
  workspace: string;
  llmClient: LLMClient;
  tools?: Tool[];
  wikiService?: WikiService;
  monitoringTargets?: MonitoringTarget[];
  runbooks?: Runbook[];
  alertThreshold?: number;
  maxRecoveryAttempts?: number;
}

/**
 * OpsDivision
 *
 * Coordinates operations agents for deployment, monitoring, and incident response.
 *
 * @example
 * ```typescript
 * const ops = new OpsDivision({
 *   workspace: '/app',
 *   llmClient,
 *   tools: [...deployTools, ...dockerTools],
 *   monitoringTargets: [{ name: 'api', url: 'http://localhost:3000', ... }],
 * });
 *
 * const result = await ops.executeTask('Deploy to production', 'high');
 * ```
 */
export class OpsDivision implements ITeam {
  private readonly workspace: string;
  private readonly llmClient: LLMClient;
  private readonly tools: Tool[];
  private readonly onEscalation?: TeamCallbacks['onEscalation'];
  private readonly onProgress?: TeamCallbacks['onProgress'];

  // Agents
  private readonly devOpsAgent: DevOpsAgent;
  private readonly monitoringAgent: MonitoringAgent;
  private readonly incidentAgent: IncidentAgent;

  constructor(config: OpsDivisionConfig) {
    this.workspace = config.workspace;
    this.llmClient = config.llmClient;
    this.tools = config.tools ?? [];
    this.onEscalation = config.onEscalation;
    this.onProgress = config.onProgress;
    // Note: wikiService is available in config but not used yet

    // Create DevOps agent with devops-role tools
    const devOpsTools = filterToolsByRole(this.tools, 'devops');
    this.devOpsAgent = new DevOpsAgent({
      llmClient: this.llmClient,
      tools: devOpsTools,
      workspace: this.workspace,
    });

    // Create Monitoring agent with monitoring-role tools
    const monitoringTools = filterToolsByRole(this.tools, 'monitoring');
    this.monitoringAgent = new MonitoringAgent({
      llmClient: this.llmClient,
      tools: monitoringTools,
      workspace: this.workspace,
      targets: config.monitoringTargets,
      alertThreshold: config.alertThreshold,
    });

    // Create Incident agent with ops-role tools
    const opsTools = filterToolsByRole(this.tools, 'ops');
    this.incidentAgent = new IncidentAgent({
      llmClient: this.llmClient,
      tools: opsTools,
      workspace: this.workspace,
      runbooks: config.runbooks,
      maxRecoveryAttempts: config.maxRecoveryAttempts,
    });
  }

  /**
   * Get the division name.
   */
  getName(): string {
    return 'OpsDivision';
  }

  /**
   * Get the workspace path.
   */
  getWorkspace(): string {
    return this.workspace;
  }

  /**
   * Get the roles of agents in this division.
   */
  getAgentRoles(): string[] {
    return ['devops', 'monitoring', 'incident'];
  }

  /**
   * Execute an operations task through the appropriate workflow.
   *
   * The division detects the task type and routes to the appropriate agent:
   * - Deployment tasks → DevOpsAgent
   * - Monitoring tasks → MonitoringAgent
   * - Incident tasks → IncidentAgent
   *
   * For complex workflows (e.g., deploy + monitor), it coordinates multiple agents.
   */
  async executeTask(description: string, priority: Priority = 'medium'): Promise<WorkflowResult> {
    this.onProgress?.(`[OpsDivision] Starting task: ${description}`);

    const task = createTask({
      type: 'implement',
      title: description,
      description,
      priority,
      createdBy: 'OpsDivision',
    });

    const taskType = this.detectTaskType(description);
    this.onProgress?.(`[OpsDivision] Detected task type: ${taskType}`);

    try {
      let result: TaskResult;

      switch (taskType) {
        case 'deployment':
          result = await this.executeDeploymentWorkflow(task);
          break;
        case 'monitoring':
          result = await this.executeMonitoringWorkflow(task);
          break;
        case 'incident':
          result = await this.executeIncidentWorkflow(task);
          break;
        default:
          // Default to DevOps for general ops tasks
          result = await this.devOpsAgent.executeTask(task);
      }

      const workflowResult: WorkflowResult = {
        success: result.success,
        task,
        devResults: [{ task, result }],
        qaResults: [],
        iterations: 1,
        escalated: false,
      };

      if (!result.success) {
        this.onProgress?.(`[OpsDivision] Task failed: ${result.error || 'Unknown error'}`);
        this.onEscalation?.(result.error || 'Task execution failed', task);
        workflowResult.escalated = true;
        workflowResult.escalationReason = result.error;
      } else {
        this.onProgress?.(`[OpsDivision] Task completed successfully`);
      }

      return workflowResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.onEscalation?.(errorMessage, task);

      return {
        success: false,
        task,
        devResults: [{ task, result: { success: false, error: errorMessage } }],
        qaResults: [],
        iterations: 1,
        escalated: true,
        escalationReason: errorMessage,
      };
    }
  }

  /**
   * Detect the type of operations task.
   */
  private detectTaskType(description: string): 'deployment' | 'monitoring' | 'incident' | 'general' {
    const lowerDesc = description.toLowerCase();

    // Deployment keywords
    const deployKeywords = ['deploy', 'dockerfile', 'docker', 'container', 'railway', 'vercel', 'release', 'build'];
    if (deployKeywords.some(k => lowerDesc.includes(k))) {
      return 'deployment';
    }

    // Incident keywords
    const incidentKeywords = ['incident', 'outage', 'down', 'failed', 'crash', 'recovery', 'restore', 'rollback'];
    if (incidentKeywords.some(k => lowerDesc.includes(k))) {
      return 'incident';
    }

    // Monitoring keywords
    const monitoringKeywords = ['monitor', 'health', 'check', 'status', 'alert', 'metric', 'uptime'];
    if (monitoringKeywords.some(k => lowerDesc.includes(k))) {
      return 'monitoring';
    }

    return 'general';
  }

  /**
   * Execute a deployment workflow.
   *
   * 1. DevOps agent handles deployment
   * 2. After deployment, monitoring agent verifies health
   */
  private async executeDeploymentWorkflow(task: Task): Promise<TaskResult> {
    this.onProgress?.(`[OpsDivision] Executing deployment workflow`);

    // Step 1: Deploy with DevOps agent
    const deployResult = await this.devOpsAgent.executeTask(task);
    if (!deployResult.success) {
      return deployResult;
    }

    // Step 2: Verify health with monitoring agent (if targets are configured)
    const targets = this.monitoringAgent.getTargets();
    if (targets.length > 0) {
      this.onProgress?.(`[OpsDivision] Verifying deployment health for ${targets.length} targets`);

      const healthTask = createTask({
        type: 'test',
        title: 'Post-deployment health check',
        description: `Verify health of deployed services: ${targets.map(t => t.name).join(', ')}`,
        createdBy: 'OpsDivision',
      });

      const healthResult = await this.monitoringAgent.executeTask(healthTask);
      if (!healthResult.success) {
        return {
          success: false,
          output: deployResult.output,
          error: `Deployment succeeded but health check failed: ${healthResult.error}`,
        };
      }
    }

    return deployResult;
  }

  /**
   * Execute a monitoring workflow.
   */
  private async executeMonitoringWorkflow(task: Task): Promise<TaskResult> {
    this.onProgress?.(`[OpsDivision] Executing monitoring workflow`);
    return this.monitoringAgent.executeTask(task);
  }

  /**
   * Execute an incident response workflow.
   *
   * 1. IncidentAgent handles the incident
   * 2. If recovery fails, escalate
   */
  private async executeIncidentWorkflow(task: Task): Promise<TaskResult> {
    this.onProgress?.(`[OpsDivision] Executing incident response workflow`);
    return this.incidentAgent.executeTask(task);
  }

  /**
   * Get the DevOps agent for direct access.
   */
  getDevOpsAgent(): DevOpsAgent {
    return this.devOpsAgent;
  }

  /**
   * Get the Monitoring agent for direct access.
   */
  getMonitoringAgent(): MonitoringAgent {
    return this.monitoringAgent;
  }

  /**
   * Get the Incident agent for direct access.
   */
  getIncidentAgent(): IncidentAgent {
    return this.incidentAgent;
  }

  /**
   * Add a monitoring target.
   */
  addMonitoringTarget(target: MonitoringTarget): void {
    this.monitoringAgent.addTarget(target);
  }

  /**
   * Register a runbook with the incident agent.
   */
  registerRunbook(runbook: Runbook): void {
    this.incidentAgent.registerRunbook(runbook);
  }
}
