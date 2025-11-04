import { EnhancedCache } from '../dataSources/base/EnhancedCache';
import { MemoryCache } from '../dataSources/base/MemoryCache';
import { IDataCache } from '../dataSources/interfaces';

interface CacheManagerConfig {
  enableEnhancedCache?: boolean;
  enableBrowserCache?: boolean;
  enableSessionCache?: boolean;
  preloadKeys?: string[];
}

/**
 * Centralized cache manager that coordinates multiple caching strategies
 */
export class CacheManager {
  private static instance: CacheManager;
  private enhancedCache: EnhancedCache;
  private memoryCache: MemoryCache;
  private config: Required<CacheManagerConfig>;
  private preloadPromise: Promise<void> | null = null;

  private constructor(config: CacheManagerConfig = {}) {
    this.config = {
      enableEnhancedCache: config.enableEnhancedCache ?? true,
      enableBrowserCache: config.enableBrowserCache ?? true,
      enableSessionCache: config.enableSessionCache ?? true,
      preloadKeys: config.preloadKeys ?? []
    };

    this.enhancedCache = new EnhancedCache({
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 2000,
      defaultTTL: 60 * 60 * 1000, // 1 hour
      cleanupInterval: 10 * 60 * 1000 // 10 minutes
    });

    this.memoryCache = new MemoryCache();
  }

  static getInstance(config?: CacheManagerConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Get the appropriate cache instance based on configuration
   */
  getCache(): IDataCache {
    return this.config.enableEnhancedCache ? this.enhancedCache : this.memoryCache;
  }

  /**
   * Get data with multi-level caching
   */
  async get<T>(key: string): Promise<T | null> {
    // Try enhanced cache first
    if (this.config.enableEnhancedCache) {
      const result = await this.enhancedCache.get<T>(key);
      if (result !== null) {
        return result;
      }
    }

    // Try browser cache (localStorage) for persistent data
    if (this.config.enableBrowserCache && typeof window !== 'undefined') {
      try {
        const browserResult = this.getBrowserCache<T>(key);
        if (browserResult !== null) {
          // Store back in enhanced cache for faster access
          if (this.config.enableEnhancedCache) {
            await this.enhancedCache.set(key, browserResult);
          }
          return browserResult;
        }
      } catch (error) {
        console.warn('Browser cache access failed:', error);
      }
    }

    // Try session cache for temporary data
    if (this.config.enableSessionCache && typeof window !== 'undefined') {
      try {
        const sessionResult = this.getSessionCache<T>(key);
        if (sessionResult !== null) {
          // Store back in enhanced cache for faster access
          if (this.config.enableEnhancedCache) {
            await this.enhancedCache.set(key, sessionResult);
          }
          return sessionResult;
        }
      } catch (error) {
        console.warn('Session cache access failed:', error);
      }
    }

    return null;
  }

  /**
   * Set data with multi-level caching
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Store in enhanced cache
    if (this.config.enableEnhancedCache) {
      await this.enhancedCache.set(key, value, ttl);
    }

    // Store in browser cache for persistent data (only for certain keys)
    if (this.config.enableBrowserCache && this.shouldPersistToBrowser(key)) {
      try {
        this.setBrowserCache(key, value, ttl);
      } catch (error) {
        console.warn('Browser cache storage failed:', error);
      }
    }

    // Store in session cache for temporary data
    if (this.config.enableSessionCache && this.shouldPersistToSession(key)) {
      try {
        this.setSessionCache(key, value, ttl);
      } catch (error) {
        console.warn('Session cache storage failed:', error);
      }
    }
  }

  /**
   * Delete from all cache levels
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false;

    if (this.config.enableEnhancedCache) {
      deleted = await this.enhancedCache.delete(key) || deleted;
    }

    if (this.config.enableBrowserCache && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.getBrowserCacheKey(key));
        deleted = true;
      } catch (error) {
        console.warn('Browser cache deletion failed:', error);
      }
    }

    if (this.config.enableSessionCache && typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(this.getSessionCacheKey(key));
        deleted = true;
      } catch (error) {
        console.warn('Session cache deletion failed:', error);
      }
    }

    return deleted;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    if (this.config.enableEnhancedCache) {
      await this.enhancedCache.clear();
    }

    if (this.config.enableBrowserCache && typeof window !== 'undefined') {
      try {
        // Clear only our cache keys
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('code-treat-cache:')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Browser cache clear failed:', error);
      }
    }

    if (this.config.enableSessionCache && typeof window !== 'undefined') {
      try {
        // Clear only our cache keys
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('code-treat-session:')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Session cache clear failed:', error);
      }
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats() {
    const enhancedStats = this.config.enableEnhancedCache ? this.enhancedCache.getStats() : null;
    const memoryStats = this.memoryCache.getStats();

    let browserCacheSize = 0;
    let sessionCacheSize = 0;

    if (typeof window !== 'undefined') {
      try {
        // Estimate browser cache size
        const browserKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('code-treat-cache:')
        );
        browserCacheSize = browserKeys.length;

        // Estimate session cache size
        const sessionKeys = Object.keys(sessionStorage).filter(key => 
          key.startsWith('code-treat-session:')
        );
        sessionCacheSize = sessionKeys.length;
      } catch (error) {
        console.warn('Failed to get browser/session cache stats:', error);
      }
    }

    return {
      enhanced: enhancedStats,
      memory: memoryStats,
      browser: {
        enabled: this.config.enableBrowserCache,
        entries: browserCacheSize
      },
      session: {
        enabled: this.config.enableSessionCache,
        entries: sessionCacheSize
      }
    };
  }

  /**
   * Preload important data
   */
  async preload(loader: (key: string) => Promise<unknown>): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = this.doPreload(loader);
    return this.preloadPromise;
  }

  /**
   * Cleanup expired entries across all caches
   */
  cleanup(): void {
    if (this.config.enableEnhancedCache) {
      this.enhancedCache.cleanup();
    }

    this.memoryCache.cleanup();

    // Cleanup browser cache
    if (this.config.enableBrowserCache && typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('code-treat-cache:')) {
            try {
              const item = localStorage.getItem(key);
              if (item) {
                const parsed = JSON.parse(item);
                if (parsed.expiry && Date.now() > parsed.expiry) {
                  localStorage.removeItem(key);
                }
              }
            } catch (error) {
              // Remove invalid entries
              localStorage.removeItem(key);
            }
          }
        });
      } catch (error) {
        console.warn('Browser cache cleanup failed:', error);
      }
    }
  }

  /**
   * Destroy all caches and cleanup resources
   */
  destroy(): void {
    if (this.config.enableEnhancedCache) {
      this.enhancedCache.destroy();
    }

    this.clear();
    CacheManager.instance = null as any;
  }

  private async doPreload(loader: (key: string) => Promise<unknown>): Promise<void> {
    if (this.config.preloadKeys.length === 0) {
      return;
    }

    try {
      const promises = this.config.preloadKeys.map(async (key) => {
        try {
          const cached = await this.get(key);
          if (!cached) {
            const value = await loader(key);
            await this.set(key, value);
          }
        } catch (error) {
          console.warn(`Failed to preload key ${key}:`, error);
        }
      });

      await Promise.all(promises);
    } finally {
      this.preloadPromise = null;
    }
  }

  private shouldPersistToBrowser(key: string): boolean {
    // Persist precomputed results and overall data
    return key.includes('precomputed') || 
           key.includes('overall') || 
           key.includes('consolidated');
  }

  private shouldPersistToSession(key: string): boolean {
    // Persist filter combinations and temporary results
    return key.includes('filter') || 
           key.includes('combination') || 
           key.includes('temp');
  }

  private getBrowserCacheKey(key: string): string {
    return `code-treat-cache:${key}`;
  }

  private getSessionCacheKey(key: string): string {
    return `code-treat-session:${key}`;
  }

  private getBrowserCache<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.getBrowserCacheKey(key));
      if (!item) return null;

      const parsed = JSON.parse(item);
      if (parsed.expiry && Date.now() > parsed.expiry) {
        localStorage.removeItem(this.getBrowserCacheKey(key));
        return null;
      }

      return parsed.value;
    } catch (error) {
      return null;
    }
  }

  private setBrowserCache<T>(key: string, value: T, ttl?: number): void {
    try {
      const expiry = ttl ? Date.now() + ttl : null;
      const item = {
        value,
        expiry,
        timestamp: Date.now()
      };

      localStorage.setItem(this.getBrowserCacheKey(key), JSON.stringify(item));
    } catch (error) {
      // Handle quota exceeded or other localStorage errors
      console.warn('Failed to set browser cache:', error);
    }
  }

  private getSessionCache<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(this.getSessionCacheKey(key));
      if (!item) return null;

      const parsed = JSON.parse(item);
      if (parsed.expiry && Date.now() > parsed.expiry) {
        sessionStorage.removeItem(this.getSessionCacheKey(key));
        return null;
      }

      return parsed.value;
    } catch (error) {
      return null;
    }
  }

  private setSessionCache<T>(key: string, value: T, ttl?: number): void {
    try {
      const expiry = ttl ? Date.now() + ttl : null;
      const item = {
        value,
        expiry,
        timestamp: Date.now()
      };

      sessionStorage.setItem(this.getSessionCacheKey(key), JSON.stringify(item));
    } catch (error) {
      // Handle quota exceeded or other sessionStorage errors
      console.warn('Failed to set session cache:', error);
    }
  }
}
