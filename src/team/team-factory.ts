/**
 * Team Factory
 *
 * Factory for creating different types of teams without coupling to concrete implementations.
 * Allows CEO and other components to create teams by type name.
 *
 * Part of Phase 6a: Coordination Layer Refactoring
 */

import { LLMClient } from '../core/llm/client.js';
import { Tool } from '../core/tools/types.js';
import { WikiService } from '../core/wiki/wiki-service.js';
import { ITeam, TeamCallbacks } from './team-interface.js';
import { Team, TeamConfig } from './team.js';

/**
 * Configuration passed to team creators
 */
export interface TeamFactoryConfig extends TeamCallbacks {
  workspace: string;
  llmClient: LLMClient;
  tools?: Tool[];
  wikiService?: WikiService;
  maxRetries?: number;
  maxIterations?: number;
}

/**
 * Function type for creating teams
 */
export type TeamCreator = (config: TeamFactoryConfig) => ITeam;

/**
 * Supported team types (extendable via register)
 */
export type TeamType = 'tech' | 'ops' | string;

/**
 * TeamFactory
 *
 * Creates teams by type without coupling to concrete implementations.
 * Supports registering custom team types for extensibility.
 *
 * @example
 * ```typescript
 * // Create a tech team
 * const techTeam = TeamFactory.create('tech', {
 *   workspace: '/tmp/project',
 *   llmClient,
 *   tools: allTools,
 * });
 *
 * // Register a custom team type
 * TeamFactory.register('marketing', (config) => new MarketingTeam(config));
 * const marketingTeam = TeamFactory.create('marketing', { ... });
 * ```
 */
export class TeamFactory {
  /**
   * Registry of team creators by type
   */
  private static creators: Map<TeamType, TeamCreator> = new Map();

  /**
   * Initialize the factory with default team types
   */
  static {
    // Register default tech team
    TeamFactory.register('tech', TeamFactory.createTechTeam);
  }

  /**
   * Register a team creator for a given type.
   *
   * @param type - Team type identifier
   * @param creator - Function that creates the team
   */
  static register(type: TeamType, creator: TeamCreator): void {
    TeamFactory.creators.set(type, creator);
  }

  /**
   * Unregister a team type.
   *
   * @param type - Team type to remove
   * @returns true if the type was registered and removed, false otherwise
   */
  static unregister(type: TeamType): boolean {
    return TeamFactory.creators.delete(type);
  }

  /**
   * Check if a team type is registered.
   *
   * @param type - Team type to check
   * @returns true if registered
   */
  static isRegistered(type: TeamType): boolean {
    return TeamFactory.creators.has(type);
  }

  /**
   * Get all registered team types.
   *
   * @returns Array of registered type names
   */
  static getRegisteredTypes(): TeamType[] {
    return Array.from(TeamFactory.creators.keys());
  }

  /**
   * Create a team of the specified type.
   *
   * @param type - Team type to create
   * @param config - Configuration for the team
   * @returns Created team implementing ITeam
   * @throws Error if team type is not registered
   */
  static create(type: TeamType, config: TeamFactoryConfig): ITeam {
    const creator = TeamFactory.creators.get(type);
    if (!creator) {
      const registered = TeamFactory.getRegisteredTypes().join(', ');
      throw new Error(
        `Unknown team type: "${type}". Registered types: ${registered || 'none'}`
      );
    }
    return creator(config);
  }

  /**
   * Default creator for TechTeam.
   *
   * Creates a team with PM, Dev (general/frontend/backend), and QA agents.
   */
  private static createTechTeam(config: TeamFactoryConfig): ITeam {
    const teamConfig: TeamConfig = {
      workspace: config.workspace,
      llmClient: config.llmClient,
      tools: config.tools ?? [],
      wikiService: config.wikiService,
      maxRetries: config.maxRetries,
      maxIterations: config.maxIterations,
      onEscalation: config.onEscalation,
      onProgress: config.onProgress,
    };
    return new Team(teamConfig);
  }
}
