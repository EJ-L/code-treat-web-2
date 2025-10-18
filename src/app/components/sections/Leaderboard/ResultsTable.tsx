import { FC, useRef, useEffect, useState, useCallback, useMemo } from 'react';

import { TaskType, ProcessedResult, Ability } from '@/lib/types';
import { FilterConfig } from '@/lib/filterConfig';
import { HeaderConfig, getTaskHeaders } from '@/lib/leaderboardConfig';
import { getFilteredTableHeaders } from '@/lib/leaderboardHelpers';
import TableHeader from './TableHeader';
import TableCell from './TableCell';
import { getModelUrl } from '@/lib/constants';
import { AnimatedTableRow } from '@/app/components/ui/AnimatedTableRow';
import ModelScatterChart, { ScatterChartRef } from '@/app/components/ui/ModelScatterChart';

import MultiSelectDropdown from '@/app/components/ui/MultiSelectDropdown';
import { FilterState } from '@/lib/filterHelpers';

interface ResultsTableProps {
  currentTask: TaskType;
  results: ProcessedResult[];
  sortedResults: ProcessedResult[];
  isLoading: boolean;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  getTableHeaders: (task: TaskType) => { key: string; label: string; width: string; description: string }[];
  columnWidths: Record<string, number>;
  resizingColumn: string | null;
  handleSort: (key: string) => void;
  handleResizeStart: (e: React.MouseEvent, key: string) => void;
  handleTouchResizeStart: (e: React.TouchEvent, key: string) => void;
  getContentWidth: (columnWidth: number) => number;
  isColumnCentered: (key: string) => boolean;
  getStickyStyles: (key: string) => string;
  getStickyLeftPosition: (key: string) => string;
  getBackgroundColor: (key: string, isHeaderCell?: boolean) => string;
  getColumnAlignment: (key: string) => string;
  getNumericStyles: (key: string) => string;
  truncateText: (text: string, maxWidth: number) => string;
  getTaskSpecificColumnWidth: (task: TaskType, key: string) => string;
  isDarkMode: boolean;
  onColumnWidthChange?: () => void;
  timelineRange: { start: Date; end: Date } | null;
  onTimelineChange: (startDate: Date, endDate: Date) => void;
  // Filter-related props
  taskAbilities?: Record<TaskType, Ability>;
  selectedAbilities?: Partial<Ability>;
  handleAbilityChange?: (key: keyof Ability, value: string) => void;
  availableLLMJudges?: string[];
  // View mode props
  viewMode: 'table' | 'scatter' | 'code-questions';
  setViewMode: (mode: 'table' | 'scatter' | 'code-questions') => void;
  // Multi-leaderboard props
  isMultiLeaderboard?: boolean;
  selectedMultiTab?: string;
  // Chart export ref
  chartExportRef?: React.RefObject<ScatterChartRef>;
}

const ResultsTable: FC<ResultsTableProps> = ({
  currentTask,
  results,
  sortedResults,
  isLoading,
  sortConfig,
  getTableHeaders,
  columnWidths,
  resizingColumn,
  handleSort,
  handleResizeStart,
  handleTouchResizeStart,
  getContentWidth,
  isColumnCentered,
  getStickyStyles,
  getStickyLeftPosition,
  getBackgroundColor,
  getColumnAlignment,
  getNumericStyles,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  truncateText,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getTaskSpecificColumnWidth,
  isDarkMode,
  onColumnWidthChange,
  timelineRange,
  taskAbilities = {},
  selectedAbilities = {},
  handleAbilityChange,
  availableLLMJudges = [],
  viewMode,
  setViewMode,
  isMultiLeaderboard = false,
  selectedMultiTab,
  chartExportRef
}) => {
  // Refs for measuring table dimensions
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  
  // State for scrollbar visibility
  const [needsHorizontalScroll, setNeedsHorizontalScroll] = useState(false);
  
  // State for current metric in scatter chart
  const [currentScatterMetric, setCurrentScatterMetric] = useState<string>('');
  
  // State for mouse drag scrolling
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });
  
  const availableFilters: FilterConfig[] = [];
  
  // Get available numeric metrics for scatter chart
  const availableMetrics = useMemo(() => {
    if (!results || !results.length) return [];
    
    // For chart view, we want to show all possible metrics for the task that have ANY data
    // This allows users to switch between metrics even if some don't have data in current filter
    // But we still hide metrics that have NO data at all
    const allHeaders = getTaskHeaders(currentTask);
    
    // However, we still need to apply specific dataset-based filtering rules
    let filteredHeaders = allHeaders;
    
    // Apply the same dataset-specific filtering as getFilteredTableHeaders
    if (currentTask === 'multi-modality' && selectedAbilities?.dataset) {
      const hasEditOrRepair = selectedAbilities.dataset.some(dataset => 
        dataset.includes('UI Code Edit') || dataset.includes('UI Code Repair')
      );
      
      if (hasEditOrRepair) {
        filteredHeaders = filteredHeaders.filter(header => header.key !== 'CLIP');
      }
    }
    
    return filteredHeaders
      .filter(header => {
        // Skip non-numeric columns
        if (['rank', 'model', 'model_url', 'ability', 'task'].includes(header.key)) {
          return false;
        }
        
        // For chart view, only include metrics that have at least SOME valid data
        // Check if this metric has numeric data in ANY of the results (not just current filter)
        const hasNumericData = results.some(result => {
          const value = result[header.key];
          return value != null && value !== undefined && String(value) !== '-' && String(value) !== '' && !isNaN(Number(value));
        });
        
        return hasNumericData;
      })
      .map(header => header.key);
  }, [results, currentTask, selectedAbilities]);
  
  // Set default metric when available metrics change
  useEffect(() => {
    if (availableMetrics.length > 0) {
      // Check if current metric is still available, if not reset to a valid one
      if (!currentScatterMetric || !availableMetrics.includes(currentScatterMetric)) {
        // For code-robustness with new datasets, prefer MPS as default
        if (currentTask === 'code-robustness' && selectedMultiTab && 
            ['HackerRank', 'GeeksforGeeks', 'Merge'].includes(selectedMultiTab)) {
          const hasMPS = availableMetrics.includes('MPS');
          setCurrentScatterMetric(hasMPS ? 'MPS' : availableMetrics[0]);
        } else if (currentTask === 'multi-modality') {
          // For multi-modality, prefer Compilation as default (especially for UI Code Generation)
          const hasCompilation = availableMetrics.includes('Compilation');
          setCurrentScatterMetric(hasCompilation ? 'Compilation' : availableMetrics[0]);
        } else if (currentTask === 'vulnerability detection') {
          // For vulnerability detection, choose appropriate default based on selected dataset
          if (selectedMultiTab === 'PrimeVulPairs') {
            // For PrimeVulPairs (PrimeVulPlus), prefer P-C as default since it has the highest values
            const hasPC = availableMetrics.includes('P-C');
            setCurrentScatterMetric(hasPC ? 'P-C' : availableMetrics[0]);
          } else {
            // For PrimeVul or All, prefer Accuracy as default
            const hasAccuracy = availableMetrics.includes('Accuracy');
            setCurrentScatterMetric(hasAccuracy ? 'Accuracy' : availableMetrics[0]);
          }
        } else {
          setCurrentScatterMetric(availableMetrics[0]);
        }
      }
    }
  }, [availableMetrics, currentScatterMetric, currentTask, selectedMultiTab]);

  // Reset metric when switching to new datasets in code-robustness, multi-modality, or vulnerability detection
  useEffect(() => {
    if (availableMetrics.length > 0) {
      // Always validate that the current metric is available in the new tab's data
      const hasValidData = results.some(result => {
        const value = result[currentScatterMetric];
        return value !== '-' && value !== undefined && !isNaN(Number(value));
      });
      
      // If current metric has no valid data in this tab, switch to appropriate default
      if (!hasValidData && currentScatterMetric && availableMetrics.includes(currentScatterMetric)) {
        if (currentTask === 'code-robustness' && selectedMultiTab && 
            ['HackerRank', 'GeeksforGeeks', 'Merge'].includes(selectedMultiTab)) {
          // Switch to MPS for new datasets if available
          const hasMPS = availableMetrics.includes('MPS');
          const mpsHasData = hasMPS && results.some(result => {
            const value = result['MPS'];
            return value != null && value !== undefined && String(value) !== '-' && !isNaN(Number(value));
          });
          if (mpsHasData) {
            setCurrentScatterMetric('MPS');
          } else {
            // Find first metric with actual data
            const firstMetricWithData = availableMetrics.find(metric => 
              results.some(result => {
                const value = result[metric];
                return value !== '-' && value !== undefined && !isNaN(Number(value));
              })
            );
            if (firstMetricWithData) {
              setCurrentScatterMetric(firstMetricWithData);
            }
          }
        } else if (currentTask === 'multi-modality' && selectedMultiTab) {
          // For multi-modality, prefer Compilation when switching datasets
          const hasCompilation = availableMetrics.includes('Compilation');
          const compilationHasData = hasCompilation && results.some(result => {
            const value = result['Compilation'];
            return value != null && value !== undefined && String(value) !== '-' && !isNaN(Number(value));
          });
          if (compilationHasData) {
            setCurrentScatterMetric('Compilation');
          } else {
            // Find first metric with actual data
            const firstMetricWithData = availableMetrics.find(metric => 
              results.some(result => {
                const value = result[metric];
                return value !== '-' && value !== undefined && !isNaN(Number(value));
              })
            );
            if (firstMetricWithData) {
              setCurrentScatterMetric(firstMetricWithData);
            }
          }
        } else if (currentTask === 'vulnerability detection' && selectedMultiTab) {
          // For vulnerability detection, switch default metric based on selected dataset
          if (selectedMultiTab === 'PrimeVulPairs') {
            const hasPC = availableMetrics.includes('P-C');
            const pcHasData = hasPC && results.some(result => {
              const value = result['P-C'];
              return value != null && value !== undefined && String(value) !== '-' && !isNaN(Number(value));
            });
            if (pcHasData) {
              setCurrentScatterMetric('P-C');
            } else {
              // Find first metric with actual data
              const firstMetricWithData = availableMetrics.find(metric => 
                results.some(result => {
                  const value = result[metric];
                  return value !== '-' && value !== undefined && !isNaN(Number(value));
                })
              );
              if (firstMetricWithData) {
                setCurrentScatterMetric(firstMetricWithData);
              }
            }
          } else if (selectedMultiTab === 'PrimeVul' || selectedMultiTab === 'All') {
            const hasAccuracy = availableMetrics.includes('Accuracy');
            const accuracyHasData = hasAccuracy && results.some(result => {
              const value = result['Accuracy'];
              return value != null && value !== undefined && String(value) !== '-' && !isNaN(Number(value));
            });
            if (accuracyHasData) {
              setCurrentScatterMetric('Accuracy');
            } else {
              // Find first metric with actual data
              const firstMetricWithData = availableMetrics.find(metric => 
                results.some(result => {
                  const value = result[metric];
                  return value !== '-' && value !== undefined && !isNaN(Number(value));
                })
              );
              if (firstMetricWithData) {
                setCurrentScatterMetric(firstMetricWithData);
              }
            }
          }
        }
      }
    }
  }, [selectedMultiTab, currentTask, availableMetrics, currentScatterMetric, results]);

  // Reset to table view only when the original results are empty (not just timeline filtered)
  // This ensures users can stay in chart view to adjust timeline filters
  useEffect(() => {
    if (results.length === 0 && viewMode === 'scatter') {
      setViewMode('table');
    }
  }, [results.length, viewMode, setViewMode]);
  
  // Calculate total table width based on column widths
  const calculateTableWidth = useCallback(() => {
    const headers = getTableHeaders(currentTask);
    return headers.reduce((total, header) => {
      return total + (columnWidths[header.key] || 100);
    }, 0);
  }, [currentTask, columnWidths, getTableHeaders]);
  
  // Check if horizontal scrolling is needed
  const checkScrollNeed = useCallback(() => {
    if (!tableContainerRef.current) return;
    
    const containerWidth = tableContainerRef.current.clientWidth;
    const tableWidth = calculateTableWidth();
    
    // Tasks that should always have horizontal scroll by default
    const alwaysScrollTasks = ['vulnerability detection'];
    const forceScroll = alwaysScrollTasks.includes(currentTask);
    
    // Add some buffer for padding and borders (48px for padding, potential scrollbar, etc.)
    const needsScroll = forceScroll || tableWidth > containerWidth - 48;
    
    // Only update state if the value has changed to avoid unnecessary re-renders
    setNeedsHorizontalScroll(prev => prev !== needsScroll ? needsScroll : prev);
  }, [calculateTableWidth, currentTask]);
  
  // Effect to check scroll need when dimensions change
  useEffect(() => {
    checkScrollNeed();
    // Notify parent component about column width changes
    if (onColumnWidthChange) {
      onColumnWidthChange();
    }
  }, [checkScrollNeed, columnWidths, currentTask, sortedResults.length, onColumnWidthChange]);
  
  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      checkScrollNeed();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScrollNeed]);
  
  // Effect to check scroll need after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      checkScrollNeed();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [checkScrollNeed]);

  // Mouse drag scroll handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!tableContainerRef.current || !needsHorizontalScroll) return;
    
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    // Don't interfere with text selection or other interactions
    if ((e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'BUTTON' ||
        (e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('.resize-handle')) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({
      x: e.pageX,
      scrollLeft: tableContainerRef.current.scrollLeft
    });
    
    // Prevent text selection during drag
    e.preventDefault();
  }, [needsHorizontalScroll]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    
    e.preventDefault();
    
    const deltaX = e.pageX - dragStart.x;
    tableContainerRef.current.scrollLeft = dragStart.scrollLeft - deltaX;
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseUp);
      
      // Change cursor to grabbing
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderResultsTable = () => {
    // Show results (this function is only called when we have data)
    
    // Add specific debug for unit test generation
    if (currentTask === 'unit test generation') {
      console.log(`🔍 RENDER DEBUG: Rendering ${sortedResults.length} sorted results for unit test generation`);
      console.log(`🔍 RENDER DEBUG: Sample sorted results:`, sortedResults.slice(0, 5));
    }
    
    return sortedResults.map((result, index) => {
      // Get model name for passing to cells (but don't change row background)
      const modelName = result.model || result.modelName || '';
      
      return (
      <AnimatedTableRow 
        key={index} 
        className={`
          ${isDarkMode 
            ? index % 2 === 0 ? 'bg-[#0f1729]' : 'bg-[#182338]' 
            : index % 2 === 0 ? 'bg-white' : 'bg-slate-100'
          }
          ${isDarkMode ? 'hover:bg-opacity-90' : 'hover:bg-opacity-80'}
          transition-colors
          ${isDarkMode ? 'border-b border-white/10' : 'border-b border-black/10'}
        `}
      >
        {getTableHeaders(currentTask).map(header => {
          const value = result[header.key];
          const modelUrl = header.key === 'model' ? getModelUrl(String(value)) : undefined;
          
          return (
            <TableCell 
              key={header.key}
              header={header}
              value={value ?? undefined}
              rowIndex={index}
              currentTask={currentTask}
              columnWidths={columnWidths}
              resizingColumn={resizingColumn}
              getContentWidth={getContentWidth}
              isColumnCentered={isColumnCentered}
              getStickyStyles={getStickyStyles}
              getStickyLeftPosition={getStickyLeftPosition}
              getBackgroundColor={getBackgroundColor}
              getColumnAlignment={getColumnAlignment}
              getNumericStyles={getNumericStyles}
              modelName={modelName}
              modelUrl={modelUrl}
              isDarkMode={isDarkMode}
              dataset={result.dataset} // Pass dataset for data leakage detection
              selectedDatasets={selectedAbilities.dataset} // Pass selected datasets for data leakage detection control
            />
          );
        })}
      </AnimatedTableRow>
      );
    });
  };
  
  return (
    <div 
      className={`RESULTS-TABLE-COMPONENT w-full ${isMultiLeaderboard && viewMode === 'table' ? '' : 'max-w-7xl mx-auto'} ${isDarkMode ? 'dark' : ''}`}
    >
      {/* Header section moved to parent component */}
      
      {/* Timeline Filter moved to parent component */}
      
      {/* Enhanced Filter Bar - right under timeline, shown in both table and chart view - Responsive */}
      {(() => {
        // Check if we should show filter section at all
        
        // Hide entire filter section if no filters
        if (availableFilters.length === 0) {
          return null;
        }
        
        // Transform filter data into dropdown options
        const getDropdownOptions = (filter: FilterConfig) => {
          const values = filter.getValues(currentTask, taskAbilities as Record<TaskType, Ability>, availableLLMJudges);
          const filterState = new FilterState(filter, selectedAbilities, currentTask, false, taskAbilities as Record<TaskType, Ability>);
          
          return values.map((value: string) => ({
            value,
            label: filterState.getDisplayText(value),
            disabled: filterState.isDisabled(value) || filterState.isRestricted(value)
          }));
        };

        // Handle multi-select changes
        const handleMultiSelectChange = (filterKey: keyof Ability | 'llmJudges', selectedValues: string[]) => {
          if (!handleAbilityChange) return;
          
          const currentSelections = selectedAbilities[filterKey as keyof Ability] || [];
          
          // Find values to remove (in current but not in new selection)
          const valuesToRemove = currentSelections.filter(value => !selectedValues.includes(value));
          
          // Find values to add (in new selection but not in current)
          const valuesToAdd = selectedValues.filter(value => !currentSelections.includes(value));
          
          // Remove deselected values
          valuesToRemove.forEach(value => {
            handleAbilityChange(filterKey as keyof Ability, value);
          });
          
          // Add newly selected values
          valuesToAdd.forEach(value => {
            handleAbilityChange(filterKey as keyof Ability, value);
          });
        };

        // Get current selections for a filter
        const getCurrentSelections = (filterKey: keyof Ability | 'llmJudges'): string[] => {
          if (filterKey === 'llmJudges') {
            return selectedAbilities.llmJudges || [];
          }
          return selectedAbilities[filterKey as keyof Ability] || [];
        };

        // Count the number of filters that will actually be rendered
        const renderableFilters = availableFilters.filter(filter => {
          const options = getDropdownOptions(filter);
          return options.length > 0;
        });
        
        // Determine if we should use inline layout
        // Use inline layout for:
        // 1. 1-3 filters in any view mode (including chart view)
        // 2. Multi-leaderboard mode in table view (any number of filters)
        const shouldUseInlineLayout = (renderableFilters.length >= 1 && renderableFilters.length <= 3 && availableFilters.length > 0) ||
                                     (isMultiLeaderboard && viewMode === 'table' && renderableFilters.length > 0);

        return (
        <div className="w-full">
          <div className={`w-full p-3 sm:p-6 border ${
            isMultiLeaderboard && viewMode === 'table'
              ? isDarkMode 
                ? 'bg-slate-800/30 border-slate-700 border-t-0'
                : 'bg-slate-50 border-slate-200 border-t-0'
              : isDarkMode 
                ? 'bg-slate-800/50 border-slate-700/50 rounded-lg'
                : 'bg-slate-50 border-slate-200 rounded-lg'
          }`}>
            {/* Conditional Layout Based on Number of Filters */}
            {shouldUseInlineLayout ? (
              /* Inline layout for 2-3 filters */
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 lg:gap-4 flex-shrink-0">
                  <h3 className={`text-lg sm:text-xl font-bold ${
                    isDarkMode ? 'text-slate-100' : 'text-slate-800'
                  }`}>
                    Filters:
                  </h3>
                </div>
                
                {/* Filter Dropdowns in same line */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1 min-w-0">
                  {renderableFilters.map((filter) => {
                    const options = getDropdownOptions(filter);
                    const currentSelections = getCurrentSelections(filter.key);
                    
                    return (
                      <MultiSelectDropdown
                        key={filter.key}
                        label={filter.label}
                        options={options}
                        selectedValues={currentSelections}
                        onSelectionChange={(values) => handleMultiSelectChange(filter.key, values)}
                        isDarkMode={isDarkMode}
                        maxDisplayedTags={1} // Reduce tags on mobile
                        className="min-w-0 flex-1"
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Original layout for 1 or 4+ filters */
              <>
                {/* Header with Filters title */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <h3 className={`text-lg sm:text-xl font-bold ${
                    isDarkMode ? 'text-slate-100' : 'text-slate-800'
                  }`}>
                    Filters:
                  </h3>
                </div>

                {/* Functional Filter Dropdowns Section */}
                {renderableFilters.length > 0 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {renderableFilters.map((filter) => {
                        const options = getDropdownOptions(filter);
                        const currentSelections = getCurrentSelections(filter.key);
                        
                        return (
                          <MultiSelectDropdown
                            key={filter.key}
                            label={filter.label}
                            options={options}
                            selectedValues={currentSelections}
                            onSelectionChange={(values) => handleMultiSelectChange(filter.key, values)}
                            isDarkMode={isDarkMode}
                            maxDisplayedTags={1} // Reduce tags on mobile
                            className="min-w-0"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        );
      })()}
      
      {/* Table section */}
      <div 
        ref={tableContainerRef}
        className={
          isMultiLeaderboard && viewMode === 'table'
            ? `w-full border ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50'} ${availableFilters.length === 0 ? 'rounded-b-lg' : ''} border-t-0`
            : ''
        }
        style={{ 
          overflowX: needsHorizontalScroll ? 'auto' : 'hidden',
          position: 'relative',
          width: '100%',
          cursor: needsHorizontalScroll && !isDragging ? 'grab' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        {isLoading ? (
          // Show loading state only when actually loading
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #3b82f6',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <span style={{
              color: isDarkMode ? '#cbd5e1' : '#475569',
              fontSize: '18px',
              fontWeight: '500'
            }}>Loading results...</span>
          </div>
        ) : sortedResults.length === 0 ? (
          // Show no results message when not loading but no data
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px'
          }}>
            <svg style={{ width: '48px', height: '48px', marginBottom: '16px', color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{
              color: isDarkMode ? '#cbd5e1' : '#475569',
              fontSize: '18px',
              fontWeight: '500'
            }}>No results found</span>
            <span style={{
              color: isDarkMode ? '#94a3b8' : '#64748b',
              fontSize: '14px',
              marginTop: '8px'
            }}>Try adjusting your filters</span>
          </div>
        ) : viewMode === 'table' ? (
          // Show complete table when loaded and has data
          <div 
            style={{ width: '100%' }}
            className={isMultiLeaderboard && viewMode === 'table' ? 'rounded-b-lg' : ''}
          >
            <table 
              ref={tableRef}
              style={{ 
                width: '100%', 
                tableLayout: 'fixed',
                borderCollapse: 'separate',
                borderSpacing: '0',
                minWidth: needsHorizontalScroll ? `${calculateTableWidth()}px` : '100%'
              }}
            >
              <thead style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                <tr>
                  {getTableHeaders(currentTask).map((header: HeaderConfig) => (
                    <TableHeader 
                      key={header.key}
                      header={header}
                      currentTask={currentTask}
                      sortConfig={sortConfig}
                      columnWidths={columnWidths}
                      resizingColumn={resizingColumn}
                      handleSort={handleSort}
                      handleResizeStart={handleResizeStart}
                      handleTouchResizeStart={handleTouchResizeStart}
                      getContentWidth={getContentWidth}
                      isColumnCentered={isColumnCentered}
                      getStickyStyles={getStickyStyles}
                      getStickyLeftPosition={getStickyLeftPosition}
                      getBackgroundColor={getBackgroundColor}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderResultsTable()}
              </tbody>
            </table>
          </div>
        ) : (
          // Show scatter chart view
          <div style={{ width: '100%', paddingTop: '32px', paddingLeft: '20px', paddingRight: '20px' }}>
            <ModelScatterChart
              ref={chartExportRef}
              data={results}
              currentMetric={currentScatterMetric}
              availableMetrics={availableMetrics}
              onMetricChange={setCurrentScatterMetric}
              isDarkMode={isDarkMode}
              currentTask={currentTask}
              leaderboardTimelineRange={timelineRange}
              selectedMultiTab={selectedMultiTab}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsTable;