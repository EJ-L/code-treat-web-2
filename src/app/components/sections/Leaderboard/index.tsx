import React, { FC, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FilterOptions, TaskType, Ability, ProcessedResult } from '@/lib/types';
import { MODEL_PUBLISH_DATES, getBaseModelName } from '@/lib/constants';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';

import FilterPanel from './FilterPanel';
import ResultsTable from './ResultsTable';
import LeaderboardHeader from './LeaderboardHeader';
import MultiLeaderboardHeader from './MultiLeaderboardHeader';
import CompactMultiLeaderboardHeader from './CompactMultiLeaderboardHeader';
import { ScatterChartRef } from '@/app/components/ui/ModelScatterChart';
import { TimelineFilter, SecondaryFiltersBar } from './FilterComponents';
import ModelComparisonModal from '@/app/components/ui/ModelComparisonModal';
import { AnimatedResultsWrapper } from '@/app/components/ui/AnimatedResultsWrapper';
import { ProgressiveLoadingIndicator } from '@/app/components/ui/ProgressiveLoadingIndicator';
import { getAvailableLLMJudges as getSummarizationJudges } from '@/lib/tasks/codeSummarization';
import { getAvailableLLMJudges as getReviewJudges } from '@/lib/tasks/codeReview';

// Import new configuration system
import { 
  getMinColumnWidth, 
  isMultiLeaderboardTask,
  getMultiLeaderboardConfig
} from '@/lib/leaderboardConfig';
import {
  initializeColumnWidths,
  initializeMobileColumnWidths,
  getFilteredTableHeaders,
  updateColumnWidthsForFilteredHeaders,
  isColumnCentered,
  getColumnAlignment,
  getNumericStyles,
  getContentWidth,
  getStickyStyles,
  getStickyLeftPosition,
  getBackgroundColor,
  truncateText,
  getTaskSpecificColumnWidth,
  getDefaultSortConfig,
  sortResults,
  handleSortChange,
  getMaxColumnWidth
} from '@/lib/leaderboardHelpers';
import { debug } from '@/lib/debug';
import { filterConditions } from '@/lib/filterConfig';

interface LeaderboardProps {
  taskAbilities: Record<TaskType, Ability>;
  isDarkMode: boolean;
  initialTask?: TaskType;
}

  const Leaderboard: FC<LeaderboardProps> = ({ taskAbilities, isDarkMode, initialTask }) => {
  const [currentTask, setCurrentTask] = useState<TaskType>('overall');
  const [timelineRange, setTimelineRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedAbilities, setSelectedAbilities] = useState<Partial<Ability>>({});
  // Use progressive loading hook instead of manual state management
  const progressiveLoadingEnabled = true; // Feature flag for progressive loading
  
  // Create filter options for progressive loading
  const filterOptions: FilterOptions = useMemo(() => {
    const options = {
      tasks: [currentTask],
      datasets: (selectedAbilities.dataset && selectedAbilities.dataset.length > 0) ? selectedAbilities.dataset : [],
      langs: [],
      modalities: (selectedAbilities.modality && selectedAbilities.modality.length > 0) ? selectedAbilities.modality : [],
      knowledge: (selectedAbilities.knowledge && selectedAbilities.knowledge.length > 0) ? selectedAbilities.knowledge : [],
      robustness: (selectedAbilities.robustness && selectedAbilities.robustness.length > 0) ? selectedAbilities.robustness : [],
      security: (selectedAbilities.privacy && selectedAbilities.privacy.length > 0) ? selectedAbilities.privacy : [],
      llmJudges: (selectedAbilities.llmJudges && selectedAbilities.llmJudges.length > 0) ? selectedAbilities.llmJudges : undefined,
      framework: (selectedAbilities.framework && selectedAbilities.framework.length > 0) ? selectedAbilities.framework : [],
      showByDifficulty: false
    };
    
    return options;
  }, [currentTask, selectedAbilities]);

  // Progressive loading hook
  const {
    results: progressiveResults,
    isLoading: progressiveIsLoading,
    // isDataComplete: progressiveIsDataComplete, // Unused
    loadingProgress,
    error: progressiveError
  } = useProgressiveLoading(currentTask, filterOptions, {
    batchSize: 15,
    delayBetweenBatches: 30,
    priorityModels: ['GPT-4', 'Claude', 'Gemini', 'Llama', 'DeepSeek', 'Qwen']
  });

  // Fallback state for non-progressive loading (backward compatibility)
  const [fallbackResults, setFallbackResults] = useState<ProcessedResult[]>([]);
  const [fallbackIsLoading, setFallbackIsLoading] = useState(true);
  // const [fallbackIsDataComplete, setFallbackIsDataComplete] = useState(false); // Unused

  // Use progressive or fallback results based on feature flag
  const results = progressiveLoadingEnabled ? progressiveResults : fallbackResults;
  const isLoading = progressiveLoadingEnabled ? progressiveIsLoading : fallbackIsLoading;

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    getDefaultSortConfig(initialTask || 'overall', 'All')
  );
  const [availableLLMJudges, setAvailableLLMJudges] = useState<string[]>([]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // Initialize with default values immediately to prevent layout shift
    return initializeColumnWidths(initialTask || 'overall');
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'scatter' | 'code-questions' | 'model-comparison'>('table');
  
  // Multi-leaderboard state
  const [selectedMultiTab, setSelectedMultiTab] = useState<string>('All');
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);
  
  // Chart export ref
  const chartExportRef = useRef<ScatterChartRef>(null);
  
  // Helper function to check if a task supports chart view
  const supportsChartView = useCallback((task: TaskType) => {
    return task !== 'overall';
  }, []);
  
  // Initialize with initialTask on component mount
  useEffect(() => {
    if (initialTask) {
      setCurrentTask(initialTask);
      
      // Reset multi-leaderboard tab when task changes
      const config = getMultiLeaderboardConfig(initialTask);
      const defaultTab = config ? config.overallTab : 'All';
      setSelectedMultiTab(defaultTab);
      
      // Set sort config with the default tab
      setSortConfig(getDefaultSortConfig(initialTask, defaultTab));
      
      if (config) {
        // Special case: For code-robustness "All" tab, apply specialized filter on initial load
        if (initialTask === 'code-robustness' && config.overallTab === 'All') {
          setSelectedAbilities({
            dataset: ['Merge-HR+GFG']
          });
        } else {
          setSelectedAbilities({});
        }
      } else {
        setSelectedAbilities({});
      }
      
      // Reset viewMode to table if switching to a task that doesn't support chart view
      if (!supportsChartView(initialTask)) {
        setViewMode('table');
      }
      
      // Close comparison modal when task changes
      setIsComparisonModalOpen(false);
    }
  }, [initialTask, supportsChartView]);

  
  // Callback for when column widths change to trigger scroll check
  const handleColumnWidthChange = useCallback(() => {
    // This will be handled by ResultsTable's internal effects
  }, []);
  


  const handleTaskChange = useCallback((task: TaskType) => {
    setCurrentTask(task);
    
    // Reset multi-leaderboard tab when task changes
    const config = getMultiLeaderboardConfig(task);
    const defaultTab = config ? config.overallTab : 'All';
    setSelectedMultiTab(defaultTab);
    
    // Set sort config with the default tab
    setSortConfig(getDefaultSortConfig(task, defaultTab));
    
    if (config) {
      // Special case: For code-robustness "All" tab, apply specialized filter
      if (task === 'code-robustness' && config.overallTab === 'All') {
        setSelectedAbilities({
          dataset: ['Merge-HR+GFG']
        });
      } else {
        // Clear abilities for other tasks
        setSelectedAbilities({});
      }
    } else {
      // Clear abilities for non-multi-leaderboard tasks
      setSelectedAbilities({});
    }
    
    // Reset viewMode to table if switching to a task that doesn't support chart view or switching away from overall task
    if (!supportsChartView(task) || (viewMode === 'model-comparison' && task !== 'overall' as TaskType)) {
      setViewMode('table');
    }
    
    // Close comparison modal when task changes
    setIsComparisonModalOpen(false);
  }, [supportsChartView, viewMode]);

  const handleAbilityChange = (key: keyof Ability, value: string) => {
    setSelectedAbilities(prev => {
      const currentValues = prev[key] || [];
      
      // Ensure currentValues is always an array
      const currentArray = Array.isArray(currentValues) ? currentValues : [];
      
      // Toggle behavior: if value exists, remove it; if not, add it
      const newValues = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)  // Remove if exists
        : [...currentArray, value];              // Add if doesn't exist
      
      return {
        ...prev,
        [key]: newValues
      };
    });
  };

  // Handle timeline range changes
  const handleTimelineChange = useCallback((startDate: Date, endDate: Date) => {
    debug.leaderboard('Timeline changed:', { startDate, endDate });
    setTimelineRange({ start: startDate, end: endDate });
  }, []);

  // Reset timeline when task changes
  useEffect(() => {
    setTimelineRange(null);
  }, [currentTask]);

  // Close comparison modal when task changes (additional safety net)
  useEffect(() => {
    setIsComparisonModalOpen(false);
  }, [currentTask]);

  // Load LLM judges for tasks that support them
  useEffect(() => {
    const loadLLMJudges = async () => {
        try {
          let judges: string[] = [];
        if ((currentTask === 'code summarization' || currentTask === 'code review') && results.length > 0) {
          if (currentTask === 'code summarization') {
            judges = getSummarizationJudges(results);
          } else if (currentTask === 'code review') {
            judges = getReviewJudges(results);
          }
        }
        setAvailableLLMJudges(judges);
        } catch (error) {
        debug.error('Error loading LLM judges:', error);
        setAvailableLLMJudges([]);
      }
    };
    
    loadLLMJudges();
  }, [currentTask, results]);

  // Memoize filtered and sorted results
  const sortedResults = useMemo(() => {
    if (!results.length) return [];
    
    // Apply baseline filtering first - remove "Code Summarization Human Baseline" from overall leaderboard
    let filtered = results;
    if (currentTask === 'overall') {
      filtered = results.filter(result => {
        const modelName = result.model || result.modelName || '';
        return !modelName.includes('Code Summarization Human Baseline');
      });
    }
    
    // Apply timeline filtering
    if (timelineRange) {
      filtered = filtered.filter(result => {
        if (!result.model) return true; // Include if no model name
        let modelReleaseDate = MODEL_PUBLISH_DATES[result.model];
        
        // If no date found and model is CoT variant, try base model name
        if (!modelReleaseDate && result.model.includes('(CoT)')) {
          const baseName = getBaseModelName(result.model);
          modelReleaseDate = MODEL_PUBLISH_DATES[baseName];
        }
        
        if (!modelReleaseDate) return true; // Include if no release date available
        
        const releaseDate = new Date(modelReleaseDate);
        return releaseDate >= timelineRange.start && releaseDate <= timelineRange.end;
      });
      debug.leaderboard(`Timeline filtered: ${filtered.length}/${results.length} results`);
    }
    
    // For overall task, preserve original ranking logic - never normalize ranks
    // For other tasks, only normalize if ranks are completely missing
    const hasValidRanks = filtered.every(result => result.rank && typeof result.rank === 'number');
    
    // Only normalize ranks if they are completely missing (not for overall task with timeline filtering)
    if (!hasValidRanks && currentTask !== 'overall') {
      filtered = filtered.map((result, index) => ({
        ...result,
        rank: index + 1
      }));
    }
    
    const sorted = sortResults(filtered, sortConfig);
    
    debug.leaderboard(`Sorted ${sorted.length} results. Sample sorted:`, sorted.slice(0, 3));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sorted as any;
  }, [results, sortConfig, timelineRange, currentTask]);

  // Handle sorting using new helper
  const handleSort = useCallback((key: string) => {
    // Special handling for rank column - reset to default sort config for the task
    // (except for overall task which uses rank as default)
    if (key === 'rank') {
      if (currentTask === 'overall') {
        // Overall task uses rank as default, so just sort by rank ascending
        setSortConfig({ key: 'rank', direction: 'asc' });
      } else {
        // For other tasks, reset to the default sort config (e.g., pass@1 descending for input prediction)
        // Pass selectedMultiTab to get tab-specific default sort config
        setSortConfig(getDefaultSortConfig(currentTask, selectedMultiTab));
      }
    } else {
      setSortConfig(prev => handleSortChange(prev, key));
    }
  }, [currentTask, selectedMultiTab]);

  // Handle multi-leaderboard tab change
  const handleMultiTabChange = useCallback((tab: string) => {
    setSelectedMultiTab(tab);
    
    // Reset sort config to default for the new tab to prevent sorting by metrics that don't exist in the new tab
    setSortConfig(getDefaultSortConfig(currentTask, tab));
    
    // Clear existing filters when switching tabs
    setSelectedAbilities({});
    
    // Apply tab-specific filtering
    if (tab !== 'All') {
      const config = getMultiLeaderboardConfig(currentTask);
      
      if (config) {
        const filterKey = config.extractedFilter;
        
        // Map the filter key to the correct ability field
        const abilityKey = filterKey as keyof Ability;
        
        // Special mapping for code-robustness: "Merge" tab should filter by "Merge-HR+GFG" dataset
        let filterValue = tab;
        if (currentTask === 'code-robustness' && tab === 'Merge') {
          filterValue = 'Merge-HR+GFG';
        }
        
        // No special mapping needed for multi-modality - tab names match dataset names exactly
        
        setSelectedAbilities({
          [abilityKey]: [filterValue]
        });
      }
    } else if (tab === 'All' && currentTask === 'code-robustness') {
      // Special case: For code-robustness "All" tab, show Merge-HR+GFG data
      setSelectedAbilities({
        dataset: ['Merge-HR+GFG']
      });
    }
  }, [currentTask]);



  // Fallback data loading (only when progressive loading is disabled)
  useEffect(() => {
    // Early return if progressive loading is enabled - no need to set up fallback loading
    if (progressiveLoadingEnabled) {
      debug.leaderboard('Skipping fallback loading - progressive loading is enabled');
      return;
    }

    const loadAndProcessData = async () => {
        setFallbackIsLoading(true);
      try {

        debug.leaderboard(`Loading data for task: ${currentTask}`, filterOptions);

        if (currentTask === 'overall') {
          // Use the restored overall.ts processing function
          const { processResults } = await import('@/lib/resultProcessor');
          const overallResults = await processResults(currentTask, filterOptions);
          setFallbackResults(overallResults);
          // setFallbackIsDataComplete(true); // Unused
          setFallbackIsLoading(false);
        } else {
          // Use precomputed results for specific tasks
          const { getPrecomputedResults } = await import('@/lib/dataLoader');
          const results = await getPrecomputedResults(currentTask, filterOptions);
          
          if (!results || results.length === 0) {
            debug.warn(`No precomputed results available for task: ${currentTask}`);
                setFallbackResults([]);
            // setFallbackIsDataComplete(false); // Unused
            setFallbackIsLoading(false);
            return;
          }

          debug.leaderboard(`Loaded ${results.length} results for ${currentTask}`, results.slice(0, 3));
          debug.leaderboard(`Sample result object keys:`, results.length > 0 ? Object.keys(results[0]) : 'No results');
          
          // Unit test generation task loaded
          
          setFallbackResults(results);
          // setFallbackIsDataComplete(true); // Unused
                  setFallbackIsLoading(false);
                }
      } catch (error) {
        debug.error('Error loading data:', error);
          setFallbackResults([]);
        // setFallbackIsDataComplete(false); // Unused
          setFallbackIsLoading(false);
      }
    };
    
    loadAndProcessData();
  }, [
    currentTask,
    filterOptions,
    progressiveLoadingEnabled,
    selectedAbilities.dataset, 
    selectedAbilities.modality, 
    selectedAbilities.knowledge, 
    selectedAbilities.robustness, 
    selectedAbilities.privacy, 
    selectedAbilities.llmJudges, 
    selectedAbilities.framework
  ]);

  // Get filtered table headers using new helper
  const getFilteredTableHeadersMemo = useCallback((task: TaskType) => {
    // Pass all relevant active filters to ensure proper metric filtering
    const activeFilters: { datasets?: string[] } = {};
    if (selectedAbilities.dataset) {
      activeFilters.datasets = selectedAbilities.dataset;
    }
    
    return getFilteredTableHeaders(task, false, sortedResults, activeFilters);
  }, [sortedResults, selectedAbilities.dataset]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize column widths when task changes or mobile state changes
  useEffect(() => {
    const newWidths = isMobile 
      ? initializeMobileColumnWidths(currentTask, false)
      : initializeColumnWidths(currentTask, false);
    setColumnWidths(newWidths);
  }, [currentTask, isMobile]);

  // Update column widths when filtered headers change
  useEffect(() => {
    if (sortedResults.length === 0) return;
    
    const filteredHeaders = getFilteredTableHeadersMemo(currentTask);
    const newWidths = updateColumnWidthsForFilteredHeaders(
      currentTask,
      filteredHeaders,
      columnWidths
    );
    
    // Only update if widths actually change
    const filteredHeaderKeys = new Set(filteredHeaders.map(h => h.key));
    if (Object.keys(newWidths).length !== Object.keys(columnWidths).length || 
        Object.keys(columnWidths).some(key => !filteredHeaderKeys.has(key))) {
      setColumnWidths(newWidths);
    }
  }, [currentTask, sortedResults, getFilteredTableHeadersMemo, columnWidths]);

  // Listen for task change events from PaperCitationModal
  useEffect(() => {
    const handleTaskChangeEvent = (event: CustomEvent) => {
      const { task } = event.detail;
      if (task && Object.keys(taskAbilities).includes(task)) {
        // Change to the specified task
        handleTaskChange(task as TaskType);
      }
    };

    window.addEventListener('changeLeaderboardTask', handleTaskChangeEvent as EventListener);
    
    return () => {
      window.removeEventListener('changeLeaderboardTask', handleTaskChangeEvent as EventListener);
    };
  }, [taskAbilities, handleTaskChange]);
  
  // Helper function to get minimum column width using new config system
  const getMinColumnWidthHelper = useCallback((key: string): number => {
    return getMinColumnWidth(currentTask, key) || 80;
  }, [currentTask]);

  // Helper function to get maximum column width
  const getMaxColumnWidthHelper = useCallback((key: string): number => {
    return getMaxColumnWidth(currentTask, key) || 800;
  }, [currentTask]);

  // Column resizing functionality
  const handleResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    setResizingColumn(key);
    
    let currentX = e.clientX;
    let currentWidth = columnWidths[key] || 100;
    const minWidth = getMinColumnWidthHelper(key);
    const maxWidth = getMaxColumnWidthHelper(key);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - currentX;
      const proposedWidth = currentWidth + deltaX;
      
      // Calculate the actual new width within bounds
      const newWidth = Math.min(maxWidth, Math.max(minWidth, proposedWidth));
      
      // Only update reference point if we're not at the boundary
      // This prevents the "dead zone" when dragging past min/max limits
      if (newWidth === proposedWidth) {
        // Width changed as expected, update reference points
        currentX = moveEvent.clientX;
        currentWidth = newWidth;
      }
      // If we hit a boundary (newWidth !== proposedWidth), keep current reference points
      // so that immediate reverse movement will be responsive
      
      setColumnWidths(prev => ({
          ...prev,
        [key]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch-based column resizing functionality for mobile
  const handleTouchResizeStart = (e: React.TouchEvent, key: string) => {
    e.preventDefault();
    setResizingColumn(key);
    
    const touch = e.touches[0];
    let currentX = touch.clientX;
    let currentWidth = columnWidths[key] || 100;
    const minWidth = getMinColumnWidthHelper(key);
    const maxWidth = getMaxColumnWidthHelper(key);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      
      const touch = moveEvent.touches[0];
      const deltaX = touch.clientX - currentX;
      const proposedWidth = currentWidth + deltaX;
      
      // Calculate the actual new width within bounds
      const newWidth = Math.min(maxWidth, Math.max(minWidth, proposedWidth));
      
      // Only update reference point if we're not at the boundary
      // This prevents the "dead zone" when dragging past min/max limits
      if (newWidth === proposedWidth) {
        // Width changed as expected, update reference points
        currentX = touch.clientX;
        currentWidth = newWidth;
      }
      // If we hit a boundary (newWidth !== proposedWidth), keep current reference points
      // so that immediate reverse movement will be responsive
      
      setColumnWidths(prev => ({
          ...prev,
        [key]: newWidth
      }));
    };

    const handleTouchEnd = () => {
      setResizingColumn(null);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Generate CSV data
  const csvData = useMemo(() => {
    const headers = getFilteredTableHeadersMemo(currentTask);
    const csvHeaders = headers.map(header => ({
      label: header.label,
      key: header.key
    }));
    
    const csvDataRows = sortedResults.map((result: ProcessedResult) => {
      const row: Record<string, string | number> = {};
      headers.forEach(header => {
        row[header.key] = result[header.key] || '';
      });
      return row;
    });
    
    return {
      headers: csvHeaders,
      data: csvDataRows
    };
  }, [currentTask, sortedResults, getFilteredTableHeadersMemo]);

  // Generate CSV filename
  const csvFilename = useMemo(() => {
    const timestamp = new Date().toISOString().split('T')[0];
    const taskName = currentTask.replace(/\s+/g, '_').toLowerCase();
    return `${taskName}_leaderboard_${timestamp}.csv`;
  }, [currentTask]);

  // Get available numeric metrics for scatter chart
  const availableMetrics = useMemo(() => {
    if (!results || !results.length) return [];
    
    const headers = getFilteredTableHeadersMemo(currentTask);
    return headers
      .filter(header => {
        // Skip non-numeric columns
        if (['rank', 'model', 'model_url', 'ability', 'task'].includes(header.key)) {
          return false;
        }
        
        // Check if this metric has numeric data in the results
        const hasNumericData = results.some(result => {
          const value = result[header.key];
          return value !== '-' && value !== undefined && !isNaN(Number(value));
        });
        
        return hasNumericData;
      })
      .map(header => header.key);
  }, [results, currentTask, getFilteredTableHeadersMemo]);

  // Check if chart view button should be shown
  const shouldShowChartButton = useMemo(() => {
    return supportsChartView(currentTask) && availableMetrics.length > 0 && results.length > 0;
  }, [currentTask, availableMetrics.length, results.length, supportsChartView]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#0f1729' : 'white', position: 'relative', zIndex: 1 }}>
        {/* Main Leaderboard Header - Always at top */}
        <LeaderboardHeader
          currentTask={currentTask}
          isDarkMode={isDarkMode}
          viewMode={viewMode}
          setViewMode={setViewMode}
          setIsComparisonModalOpen={setIsComparisonModalOpen}
          shouldShowChartButton={shouldShowChartButton}
          csvData={csvData}
          csvFilename={csvFilename}
          chartExportRef={chartExportRef}
        />

      <section>
        <div className="container mx-auto px-4">
          {/* Filter Panel with conditional spacing */}
          <div className={`${isMultiLeaderboardTask(currentTask) && viewMode === 'table' ? 'mt-8' : 'mt-8 mb-6'}`}>
            <FilterPanel 
              currentTask={currentTask}
              taskAbilities={taskAbilities}
              selectedAbilities={selectedAbilities}
              handleAbilityChange={handleAbilityChange}
              availableLLMJudges={availableLLMJudges}
              isDarkMode={isDarkMode}
              timelineRange={timelineRange}
              onTimelineChange={handleTimelineChange}
              isMultiLeaderboard={isMultiLeaderboardTask(currentTask) && viewMode === 'table'}
              selectedMultiTab={selectedMultiTab}
              results={results}
              viewMode={viewMode}
            />
          </div>


          {/* Timeline Filter - positioned between filter panel and table, hidden in chart view and code questions view */}
          {filterConditions.shouldShowTimeline(currentTask) && viewMode === 'table' && (
            <div className={`w-full max-w-7xl mx-auto mt-6 ${
              isMultiLeaderboardTask(currentTask) ? 'mb-0' : 'mb-4'
            }`}>
              <TimelineFilter 
                taskType={currentTask}
                isDarkMode={isDarkMode}
                timelineRange={timelineRange}
                onTimelineChange={handleTimelineChange}
                results={results}
              />
            </div>
          )}
          
          <AnimatedResultsWrapper
            timelineRange={timelineRange}
            currentTask={currentTask}
          >
            <div className={isMultiLeaderboardTask(currentTask) && viewMode === 'table' ? 'w-full max-w-7xl mx-auto' : ''}>
              {/* Multi-leaderboard header - moved inside wrapper to eliminate spacing */}
              {isMultiLeaderboardTask(currentTask) && viewMode === 'table' && (
                <MultiLeaderboardHeader
                  currentTask={currentTask}
                  selectedTab={selectedMultiTab}
                  onTabChange={handleMultiTabChange}
                  isDarkMode={isDarkMode}
                />
              )}
              
              {/* Compact Multi-leaderboard header for chart view and code questions view */}
              {isMultiLeaderboardTask(currentTask) && (viewMode === 'scatter' || viewMode === 'code-questions') && (
                <CompactMultiLeaderboardHeader
                  currentTask={currentTask}
                  selectedTab={selectedMultiTab}
                  onTabChange={handleMultiTabChange}
                  isDarkMode={isDarkMode}
                />
              )}
              
              {/* Secondary Filters Bar - positioned below header tabs, shown in both table and chart view */}
              <SecondaryFiltersBar
                currentTask={currentTask}
                taskAbilities={taskAbilities}
                selectedAbilities={selectedAbilities}
                availableLLMJudges={availableLLMJudges}
                handleAbilityChange={handleAbilityChange}
                isDarkMode={isDarkMode}
              />
              
              {/* Progressive Loading Indicator */}
              {progressiveLoadingEnabled && (progressiveIsLoading || loadingProgress < 100) && (
                <div className="mb-6">
                  <ProgressiveLoadingIndicator
                    progress={loadingProgress}
                    isLoading={progressiveIsLoading}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}
              
              {/* Show error message if progressive loading fails */}
              {progressiveLoadingEnabled && progressiveError && (
                <div className={`mb-4 p-4 rounded-lg ${isDarkMode ? 'bg-red-900/20 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Loading Error:</span>
                    <span className="ml-1">{progressiveError}</span>
                  </div>
                </div>
              )}
              
              <ResultsTable 
              currentTask={currentTask}
              results={results}
              sortedResults={sortedResults}
              isLoading={isLoading}
              sortConfig={sortConfig}
              getTableHeaders={getFilteredTableHeadersMemo}
              columnWidths={columnWidths}
              resizingColumn={resizingColumn}
              handleSort={handleSort}
              handleResizeStart={handleResizeStart}
              handleTouchResizeStart={handleTouchResizeStart}
              getContentWidth={getContentWidth}
              isColumnCentered={isColumnCentered}
              getStickyStyles={(key: string) => getStickyStyles(currentTask, key)}
              getStickyLeftPosition={(key: string) => getStickyLeftPosition(currentTask, key, columnWidths)}
              getBackgroundColor={(key: string, isHeaderCell?: boolean) => 
                getBackgroundColor(currentTask, key, isDarkMode, isHeaderCell)
              }
              getColumnAlignment={getColumnAlignment}
              getNumericStyles={getNumericStyles}
              truncateText={truncateText}
              getTaskSpecificColumnWidth={(task: TaskType, key: string) => 
                getTaskSpecificColumnWidth(task, key)
              }
              isDarkMode={isDarkMode}
              onColumnWidthChange={handleColumnWidthChange}
              timelineRange={timelineRange}
              onTimelineChange={handleTimelineChange}
              taskAbilities={taskAbilities}
              selectedAbilities={selectedAbilities}
              handleAbilityChange={handleAbilityChange}
              availableLLMJudges={availableLLMJudges}
              viewMode={viewMode}
              setViewMode={setViewMode}
              isMultiLeaderboard={isMultiLeaderboardTask(currentTask)}
              selectedMultiTab={selectedMultiTab}
              chartExportRef={chartExportRef}
            />
            </div>
          </AnimatedResultsWrapper>

          {/* Comparison Modal */}
          <ModelComparisonModal 
            isOpen={isComparisonModalOpen}
            onClose={() => setIsComparisonModalOpen(false)}
            results={sortedResults}
            isDarkMode={isDarkMode}
            currentTask={currentTask}
            selectedAbilities={selectedAbilities}
            availableMetrics={availableMetrics}
          />
        </div>
      </section>
    </div>
  );
};

export default Leaderboard; 