/**
 * LLM Response Cache
 *
 * Provides caching for LLM responses to reduce redundant API calls.
 * Uses an LRU (Least Recently Used) eviction policy.
 */

import * as crypto from 'crypto';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheConfig {
  maxSize?: number;
  ttlMs?: number;
  enabled?: boolean;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * LRU Cache implementation for LLM responses.
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private enabled: boolean;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  /** Default maximum cache size */
  private static readonly DEFAULT_MAX_SIZE = 1000;

  /** Default TTL: 1 hour */
  private static readonly DEFAULT_TTL_MS = 60 * 60 * 1000;

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize ?? LRUCache.DEFAULT_MAX_SIZE;
    this.ttlMs = config.ttlMs ?? LRUCache.DEFAULT_TTL_MS;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Generate a cache key from input data.
   */
  static generateKey(data: unknown): string {
    const serialized = JSON.stringify(data);
    return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
  }

  /**
   * Get a value from the cache.
   */
  get(key: string): T | undefined {
    if (!this.enabled) {
      this.misses++;
      return undefined;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Update LRU order by reinserting
    this.cache.delete(key);
    entry.hits++;
    this.cache.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set a value in the cache.
   */
  set(key: string, value: T): void {
    if (!this.enabled) return;

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    // If key exists, delete to update LRU order
    this.cache.delete(key);

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Check if a key exists in the cache (without updating LRU).
   */
  has(key: string): boolean {
    if (!this.enabled) return false;

    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
    };
  }

  /**
   * Get the current cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Enable or disable the cache.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if the cache is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Evict the oldest entry (LRU).
   */
  private evictOldest(): void {
    // Map maintains insertion order, so first key is oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.evictions++;
    }
  }

  /**
   * Prune expired entries.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}

/**
 * Specialized cache for LLM responses.
 */
export interface LLMCacheEntry {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class LLMResponseCache extends LRUCache<LLMCacheEntry> {
  /**
   * Generate a cache key for an LLM request.
   */
  static generateRequestKey(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    model?: string
  ): string {
    return LRUCache.generateKey({
      messages,
      systemPrompt,
      model,
    });
  }

  /**
   * Get a cached response.
   */
  getResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    model?: string
  ): LLMCacheEntry | undefined {
    const key = LLMResponseCache.generateRequestKey(messages, systemPrompt, model);
    return this.get(key);
  }

  /**
   * Cache a response.
   */
  setResponse(
    messages: Array<{ role: string; content: string }>,
    response: LLMCacheEntry,
    systemPrompt?: string,
    model?: string
  ): void {
    const key = LLMResponseCache.generateRequestKey(messages, systemPrompt, model);
    this.set(key, response);
  }
}
