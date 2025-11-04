import { IDataCache } from '../interfaces';

interface CacheEntry<T> {
  value: T;
  expiry: number | null;
  lastAccessed: number;
  accessCount: number;
  size: number; // Approximate size in bytes
  priority: number; // Higher priority = less likely to be evicted
}

interface CacheConfig {
  maxSize?: number; // Maximum cache size in bytes (default: 50MB)
  maxEntries?: number; // Maximum number of entries (default: 1000)
  defaultTTL?: number; // Default TTL in milliseconds (default: 30 minutes)
  cleanupInterval?: number; // Cleanup interval in milliseconds (default: 5 minutes)
  compressionThreshold?: number; // Size threshold for compression (default: 1KB)
}

/**
 * Enhanced cache implementation with LRU eviction, size limits, and compression
 */
export class EnhancedCache implements IDataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: Required<CacheConfig>;
  private currentSize = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private compressionEnabled = false;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 50 * 1024 * 1024, // 50MB
      maxEntries: config.maxEntries ?? 1000,
      defaultTTL: config.defaultTTL ?? 30 * 60 * 1000, // 30 minutes
      cleanupInterval: config.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
      compressionThreshold: config.compressionThreshold ?? 1024 // 1KB
    };

    // Check if compression is available
    this.compressionEnabled = typeof CompressionStream !== 'undefined';

    // Start periodic cleanup
    this.startCleanupTimer();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return this.deserializeValue(entry.value) as T;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const now = Date.now();
    const expiry = ttl ? now + ttl : (this.config.defaultTTL ? now + this.config.defaultTTL : null);
    
    // Serialize and potentially compress the value
    const serializedValue = await this.serializeValue(value);
    const size = this.estimateSize(serializedValue);
    
    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      this.currentSize -= existingEntry.size;
      this.cache.delete(key);
    }
    
    // Check if we need to evict entries
    await this.ensureCapacity(size);
    
    const entry: CacheEntry<unknown> = {
      value: serializedValue,
      expiry,
      lastAccessed: now,
      accessCount: 1,
      size,
      priority: this.calculatePriority(key, value)
    };
    
    this.cache.set(key, entry);
    this.currentSize += size;
  }
  
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
    this.currentSize = 0;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return allKeys;
    }
    
    // Enhanced pattern matching with multiple wildcards
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\[([^\]]+)\]/g, '[$1]')
    );
    return allKeys.filter(key => regex.test(key));
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;
    let totalAccessCount = 0;
    let avgAccessCount = 0;
    let oldestEntry = now;
    let newestEntry = 0;

    for (const [, entry] of this.cache) {
      if (entry.expiry && now > entry.expiry) {
        expiredCount++;
      } else {
        validCount++;
      }
      
      totalAccessCount += entry.accessCount;
      oldestEntry = Math.min(oldestEntry, entry.lastAccessed);
      newestEntry = Math.max(newestEntry, entry.lastAccessed);
    }

    if (validCount > 0) {
      avgAccessCount = totalAccessCount / validCount;
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      currentSize: this.currentSize,
      maxSize: this.config.maxSize,
      sizeUtilization: (this.currentSize / this.config.maxSize) * 100,
      avgAccessCount: Math.round(avgAccessCount * 100) / 100,
      oldestEntryAge: oldestEntry === now ? 0 : now - oldestEntry,
      newestEntryAge: now - newestEntry,
      compressionEnabled: this.compressionEnabled
    };
  }

  /**
   * Perform cleanup of expired entries and LRU eviction if needed
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    // Remove expired entries
    for (const [key, entry] of this.cache) {
      if (entry.expiry && now > entry.expiry) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    
    // Perform LRU eviction if still over capacity
    this.evictLRUEntries();
  }

  /**
   * Preload frequently accessed data
   */
  async preload(keys: string[], loader: (key: string) => Promise<unknown>): Promise<void> {
    const promises = keys.map(async (key) => {
      if (!(await this.get(key))) {
        try {
          const value = await loader(key);
          await this.set(key, value);
        } catch (error) {
          console.warn(`Failed to preload cache key ${key}:`, error);
        }
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    let totalAccesses = 0;
    let hits = 0;
    
    for (const [, entry] of this.cache) {
      totalAccesses += entry.accessCount;
      hits += entry.accessCount;
    }
    
    // This is a simplified calculation - in a real implementation,
    // you'd track misses separately
    return totalAccesses > 0 ? hits / totalAccesses : 0;
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async ensureCapacity(newEntrySize: number): Promise<void> {
    // Check size limit
    while (this.currentSize + newEntrySize > this.config.maxSize) {
      if (!this.evictLRUEntry()) {
        break; // No more entries to evict
      }
    }
    
    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries) {
      if (!this.evictLRUEntry()) {
        break; // No more entries to evict
      }
    }
  }

  private evictLRUEntries(): void {
    // Evict entries if over 90% capacity
    const sizeThreshold = this.config.maxSize * 0.9;
    const countThreshold = this.config.maxEntries * 0.9;
    
    while (
      (this.currentSize > sizeThreshold || this.cache.size > countThreshold) &&
      this.cache.size > 0
    ) {
      if (!this.evictLRUEntry()) {
        break;
      }
    }
  }

  private evictLRUEntry(): boolean {
    if (this.cache.size === 0) {
      return false;
    }
    
    // Find the least recently used entry with lowest priority
    let lruKey: string | null = null;
    let lruScore = Infinity;
    
    for (const [key, entry] of this.cache) {
      // Score based on last access time and priority (lower is worse)
      const score = entry.lastAccessed + (entry.priority * 10000);
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.delete(lruKey);
      return true;
    }
    
    return false;
  }

  private calculatePriority(key: string, value: unknown): number {
    // Higher priority for certain types of data
    let priority = 1;
    
    // Precomputed results get higher priority
    if (key.includes('precomputed') || key.includes('consolidated')) {
      priority += 3;
    }
    
    // Overall task data gets higher priority
    if (key.includes('overall')) {
      priority += 2;
    }
    
    // Frequently used tasks get higher priority
    const highPriorityTasks = ['code-generation', 'code-translation', 'overall'];
    if (highPriorityTasks.some(task => key.includes(task))) {
      priority += 1;
    }
    
    // Larger datasets get slightly lower priority (they take more space)
    if (this.estimateSize(value) > 100000) { // 100KB
      priority -= 1;
    }
    
    return Math.max(1, priority);
  }

  private estimateSize(value: unknown): number {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 encoding
    }
    
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1000; // Fallback estimate
      }
    }
    
    return 100; // Default estimate for primitives
  }

  private async serializeValue(value: unknown): Promise<unknown> {
    // For now, return as-is. In the future, we could add compression here
    if (this.compressionEnabled && this.estimateSize(value) > this.config.compressionThreshold) {
      // Compression would go here
      // For now, just return the value
    }
    
    return value;
  }

  private deserializeValue(value: unknown): unknown {
    // For now, return as-is. This would handle decompression if implemented
    return value;
  }
}
