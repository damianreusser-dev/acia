/**
 * Incident Agent
 *
 * Specializes in incident response, automated recovery, and escalation.
 * Executes runbooks, performs restarts/rollbacks, and escalates to humans when needed.
 *
 * Part of Phase 6c-6e: MonitoringAgent and IncidentAgent
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';

const INCIDENT_SYSTEM_PROMPT = `You are an Incident Agent. You respond to alerts, execute recovery actions, and escalate when needed.

## Core Responsibilities

1. **Incident Response**: Acknowledge and investigate incidents
2. **Automated Recovery**: Execute recovery actions (restart, rollback)
3. **Runbook Execution**: Follow predefined recovery procedures
4. **Escalation**: Notify humans when automated recovery fails

## Recovery Strategy

Follow this order for incident recovery:

1. **Restart** (try up to 2 times)
   - Restart the affected service
   - Wait for health check to pass
   - If still unhealthy after 2 attempts, proceed to rollback

2. **Rollback** (try once)
   - Rollback to the previous deployment version
   - Wait for health check to pass
   - If still unhealthy, proceed to escalation

3. **Escalate**
   - Create escalation for human operator
   - Document all recovery attempts
   - Provide diagnosis information

## Incident States

- detected: Issue first observed
- acknowledged: Agent is working on it
- investigating: Gathering information
- recovering: Executing recovery actions
- resolved: Issue fixed
- escalated: Requires human intervention

## Tools Reference

| Tool | Use For |
|------|---------|
| health_check | Verify service health after recovery |
| docker_stop | Stop a container |
| docker_run | Start a container |
| rollback_deployment | Rollback to previous version |
| read_wiki | Get runbook procedures |
| write_wiki | Document incident timeline |

## Output Format

After handling incident:
- Incident ID: [id]
- Initial State: [state]
- Actions Taken: [list]
- Final State: [resolved/escalated]
- Duration: [time]`;

/**
 * Incident state
 */
export type IncidentState =
  | 'detected'
  | 'acknowledged'
  | 'investigating'
  | 'recovering'
  | 'resolved'
  | 'escalated';

/**
 * Incident timeline event
 */
export interface IncidentEvent {
  timestamp: Date;
  action: string;
  actor: string;
  details?: string;
}

/**
 * Recovery action
 */
export interface RecoveryAction {
  type: 'restart' | 'rollback' | 'scale' | 'escalate';
  target: string;
  success: boolean;
  timestamp: Date;
  details?: string;
}

/**
 * Incident record
 */
export interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  state: IncidentState;
  affectedServices: string[];
  timeline: IncidentEvent[];
  recoveryActions: RecoveryAction[];
  createdAt: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
}

/**
 * Runbook step
 */
export interface RunbookStep {
  name: string;
  action: string;
  params?: Record<string, unknown>;
  continueOnFailure?: boolean;
}

/**
 * Runbook definition
 */
export interface Runbook {
  name: string;
  description: string;
  triggers: string[];
  steps: RunbookStep[];
}

export interface IncidentAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
  maxRecoveryAttempts?: number;
  runbooks?: Runbook[];
}

export class IncidentAgent extends Agent {
  private workspace: string;
  private maxRecoveryAttempts: number;
  private runbooks: Map<string, Runbook>;
  private incidents: Map<string, Incident>;
  private incidentCounter: number;

  constructor(config: IncidentAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'IncidentAgent',
      role: 'Incident Response Engineer',
      systemPrompt: INCIDENT_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
    this.maxRecoveryAttempts = config.maxRecoveryAttempts ?? 3;
    this.runbooks = new Map();
    this.incidents = new Map();
    this.incidentCounter = 0;

    // Register default runbooks
    if (config.runbooks) {
      for (const runbook of config.runbooks) {
        this.registerRunbook(runbook);
      }
    }
  }

  /**
   * Execute an incident response task
   */
  async executeTask(task: Task): Promise<TaskResult> {
    console.log(`[${this.name}] === TASK START: ${task.title} ===`);

    try {
      // Process the task with LLM assistance
      const prompt = this.buildTaskPrompt(task);
      const response = await this.processMessageWithTools(prompt, 10);

      // Analyze response for recovery outcomes
      const success = this.analyzeIncidentResponse(response);

      return {
        success,
        output: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Build a prompt for the incident task
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `## Task: ${task.title}\n\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }

    prompt += `**Workspace**: ${this.workspace}\n\n`;

    // Add active incidents
    const activeIncidents = Array.from(this.incidents.values())
      .filter(i => i.state !== 'resolved');

    if (activeIncidents.length > 0) {
      prompt += `## Active Incidents\n\n`;
      for (const incident of activeIncidents) {
        prompt += `- **${incident.id}**: ${incident.title} (${incident.state})\n`;
        prompt += `  Services: ${incident.affectedServices.join(', ')}\n`;
        prompt += `  Recovery attempts: ${incident.recoveryActions.length}\n`;
      }
      prompt += '\n';
    }

    // Add available runbooks
    if (this.runbooks.size > 0) {
      prompt += `## Available Runbooks\n\n`;
      for (const [name, runbook] of this.runbooks) {
        prompt += `- **${name}**: ${runbook.description}\n`;
      }
      prompt += '\n';
    }

    return prompt;
  }

  /**
   * Analyze incident response
   */
  private analyzeIncidentResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Check for resolution indicators
    const resolutionIndicators = [
      'resolved',
      'recovered',
      'healthy',
      'service restored',
      'incident closed',
    ];

    const isResolved = resolutionIndicators.some(ind => lowerResponse.includes(ind));

    // Check for escalation indicators
    const escalationIndicators = [
      'escalated',
      'human required',
      'requires attention',
      'automated recovery failed',
    ];

    const isEscalated = escalationIndicators.some(ind => lowerResponse.includes(ind));

    // Success if either resolved or properly escalated
    return isResolved || isEscalated;
  }

  /**
   * Create a new incident
   */
  createIncident(
    title: string,
    severity: Incident['severity'],
    affectedServices: string[]
  ): Incident {
    this.incidentCounter++;
    const id = `INC-${String(this.incidentCounter).padStart(5, '0')}`;

    const incident: Incident = {
      id,
      title,
      severity,
      state: 'detected',
      affectedServices,
      timeline: [
        {
          timestamp: new Date(),
          action: 'created',
          actor: this.name,
          details: `Incident created: ${title}`,
        },
      ],
      recoveryActions: [],
      createdAt: new Date(),
    };

    this.incidents.set(id, incident);
    console.log(`[${this.name}] Created incident ${id}: ${title}`);

    return incident;
  }

  /**
   * Update incident state
   */
  updateIncidentState(incidentId: string, newState: IncidentState, details?: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const oldState = incident.state;
    incident.state = newState;

    incident.timeline.push({
      timestamp: new Date(),
      action: `state_change`,
      actor: this.name,
      details: `${oldState} -> ${newState}${details ? `: ${details}` : ''}`,
    });

    if (newState === 'resolved') {
      incident.resolvedAt = new Date();
    } else if (newState === 'escalated') {
      incident.escalatedAt = new Date();
    }

    this.incidents.set(incidentId, incident);
    return true;
  }

  /**
   * Record a recovery action
   */
  recordRecoveryAction(
    incidentId: string,
    action: RecoveryAction['type'],
    target: string,
    success: boolean,
    details?: string
  ): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const recoveryAction: RecoveryAction = {
      type: action,
      target,
      success,
      timestamp: new Date(),
      details,
    };

    incident.recoveryActions.push(recoveryAction);
    incident.timeline.push({
      timestamp: new Date(),
      action: `recovery_${action}`,
      actor: this.name,
      details: `${action} on ${target}: ${success ? 'success' : 'failed'}${details ? ` - ${details}` : ''}`,
    });

    this.incidents.set(incidentId, incident);
  }

  /**
   * Determine next recovery action for an incident
   */
  getNextRecoveryAction(incidentId: string): RecoveryAction['type'] | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    const restartAttempts = incident.recoveryActions
      .filter(a => a.type === 'restart' && !a.success).length;
    const rollbackAttempts = incident.recoveryActions
      .filter(a => a.type === 'rollback' && !a.success).length;

    // Try restart first (up to 2 times)
    if (restartAttempts < 2) return 'restart';

    // Then try rollback (once)
    if (rollbackAttempts < 1) return 'rollback';

    // Finally escalate
    return 'escalate';
  }

  /**
   * Check if incident should be escalated
   */
  shouldEscalate(incidentId: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    // Escalate if max recovery attempts reached
    const totalAttempts = incident.recoveryActions.length;
    if (totalAttempts >= this.maxRecoveryAttempts) return true;

    // Escalate if all recovery types have failed
    const restartFailed = incident.recoveryActions
      .filter(a => a.type === 'restart' && !a.success).length >= 2;
    const rollbackFailed = incident.recoveryActions
      .filter(a => a.type === 'rollback' && !a.success).length >= 1;

    return restartFailed && rollbackFailed;
  }

  /**
   * Register a runbook
   */
  registerRunbook(runbook: Runbook): void {
    this.runbooks.set(runbook.name, runbook);
  }

  /**
   * Get a runbook by name
   */
  getRunbook(name: string): Runbook | undefined {
    return this.runbooks.get(name);
  }

  /**
   * Find runbook for a trigger
   */
  findRunbookForTrigger(trigger: string): Runbook | undefined {
    for (const runbook of this.runbooks.values()) {
      if (runbook.triggers.includes(trigger)) {
        return runbook;
      }
    }
    return undefined;
  }

  /**
   * Get an incident by ID
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values())
      .filter(i => i.state !== 'resolved');
  }

  /**
   * Calculate incident duration in seconds
   */
  getIncidentDuration(incidentId: string): number {
    const incident = this.incidents.get(incidentId);
    if (!incident) return 0;

    const endTime = incident.resolvedAt || new Date();
    return Math.floor((endTime.getTime() - incident.createdAt.getTime()) / 1000);
  }

  /**
   * Get workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }
}
