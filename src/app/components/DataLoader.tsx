'use client';

import { useEffect, useRef } from 'react';
import { initializeDataLoader, loadAllData } from '@/lib/dataLoader';

export function DataLoader() {
  const hasLoaded = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      // Avoid duplicate loading
      if (hasLoaded.current) return;
      
      hasLoaded.current = true;
      console.log('Starting data loader initialization...');
      
      try {
        // Initialize the data loading system first
        await initializeDataLoader({
          strategy: 'precomputed-first',
          fallbackToMockData: true,
          enableCaching: true
        });
        
        console.log('Completed');
        
        // Get the data loader manager instance for enhanced caching
        const { DataLoaderManager } = await import('@/lib/dataSources/DataLoaderManager');
        const manager = DataLoaderManager.getInstance();
        
        // Preload important data into enhanced cache
        await manager.preloadCache();
        console.log('Completed');
        
        // Preload data for better performance (fallback)
        await loadAllData();
        
        console.log('Completed');
        
        // Setup periodic cache cleanup
        const cleanupInterval = setInterval(() => {
          manager.cleanupCaches();
        }, 10 * 60 * 1000); // Every 10 minutes
        
        // Cleanup on unmount
        return () => {
          clearInterval(cleanupInterval);
        };
        
      } catch (error) {
        console.error('Data preloading failed:', error);
        // Reset on error so we can try again
        hasLoaded.current = false;
      }
    };

    loadData();
  }, []); // Run only once on mount

  return null; // 这是一个纯功能组件，不需要渲染任何内容
} 