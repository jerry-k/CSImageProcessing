/**
 * Cache service for shoreline approval statuses
 * Prevents redundant API calls and enables targeted updates
 */

interface ApprovalCache {
  statuses: Map<number, boolean>;
  lastFetch: number | null;
  isLoading: boolean;
}

class ApprovalCacheService {
  private cache: ApprovalCache = {
    statuses: new Map(),
    lastFetch: null,
    isLoading: false
  };

  private listeners: Set<(statuses: Map<number, boolean>) => void> = new Set();

  /**
   * Subscribe to cache updates
   */
  subscribe(listener: (statuses: Map<number, boolean>) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of cache updates
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.cache.statuses));
  }

  /**
   * Get cached approval status for a single image
   */
  getStatus(imageIndex: number): boolean | undefined {
    return this.cache.statuses.get(imageIndex);
  }

  /**
   * Get all cached statuses
   */
  getAllStatuses(): Map<number, boolean> {
    return new Map(this.cache.statuses);
  }

  /**
   * Update a single approval status (targeted update)
   */
  updateStatus(imageIndex: number, approved: boolean): void {
    this.cache.statuses.set(imageIndex, approved);
    this.notifyListeners();
  }

  /**
   * Bulk update all statuses (used for initial load)
   */
  setAllStatuses(statuses: Record<number, boolean>): void {
    this.cache.statuses.clear();
    Object.entries(statuses).forEach(([index, approved]) => {
      this.cache.statuses.set(Number(index), approved);
    });
    this.cache.lastFetch = Date.now();
    this.notifyListeners();
  }

  /**
   * Check if cache needs refresh (e.g., stale after 5 minutes)
   */
  needsRefresh(): boolean {
    if (!this.cache.lastFetch) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - this.cache.lastFetch > fiveMinutes;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.statuses.clear();
    this.cache.lastFetch = null;
    this.notifyListeners();
  }

  /**
   * Get loading state
   */
  isLoading(): boolean {
    return this.cache.isLoading;
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    this.cache.isLoading = loading;
  }

  /**
   * Get statuses for a range of indices (for lazy loading)
   */
  getStatusRange(startIndex: number, endIndex: number): Map<number, boolean> {
    const result = new Map<number, boolean>();
    for (let i = startIndex; i <= endIndex; i++) {
      const status = this.cache.statuses.get(i);
      if (status !== undefined) {
        result.set(i, status);
      }
    }
    return result;
  }

  /**
   * Check if we have cached data for a range
   */
  hasStatusRange(startIndex: number, endIndex: number): boolean {
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.cache.statuses.has(i)) {
        return false;
      }
    }
    return true;
  }
}

// Export singleton instance
export const approvalCache = new ApprovalCacheService();