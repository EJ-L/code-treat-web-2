import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TaskType, Ability } from '@/lib/types';
import MultiSelectDropdown from './MultiSelectDropdown';
import { FilterConfig } from '@/lib/filterConfig';

interface CollapsibleFilterPanelProps {
  currentTask: TaskType;
  taskAbilities: Record<TaskType, Ability>;
  selectedAbilities: Partial<Ability>;
  handleAbilityChange: (key: keyof Ability, value: string) => void;
  availableLLMJudges: string[];
  isDarkMode: boolean;
  filters: FilterConfig[];
  isMobile?: boolean;
  showActiveFiltersCount?: boolean;
}

const CollapsibleFilterPanel: FC<CollapsibleFilterPanelProps> = ({
  currentTask,
  taskAbilities,
  selectedAbilities,
  handleAbilityChange,
  availableLLMJudges,
  isDarkMode,
  filters,
  isMobile = false,
  showActiveFiltersCount = true
}) => {
  const [isExpanded, setIsExpanded] = useState(!isMobile);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Calculate active filters count
  const activeFiltersCount = Object.values(selectedAbilities).reduce((count, values) => {
    if (Array.isArray(values)) {
      return count + values.length;
    }
    return count;
  }, 0);

  // Get dropdown options for a filter
  const getDropdownOptions = (filter: FilterConfig) => {
    const values = filter.getValues(currentTask, taskAbilities, availableLLMJudges);
    return values.map(value => ({
      value,
      label: value,
      disabled: false
    }));
  };

  // Get current selections for a filter
  const getCurrentSelections = (filterKey: string) => {
    const selections = selectedAbilities[filterKey as keyof Ability];
    return Array.isArray(selections) ? selections : [];
  };

  // Handle multi-select change
  const handleMultiSelectChange = (filterKey: string, values: string[]) => {
    handleAbilityChange(filterKey as keyof Ability, values.join(','));
  };

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionKey)) {
      newExpanded.delete(sectionKey);
    } else {
      newExpanded.add(sectionKey);
    }
    setExpandedSections(newExpanded);
  };

  // Clear all filters
  const clearAllFilters = () => {
    Object.keys(selectedAbilities).forEach(key => {
      handleAbilityChange(key as keyof Ability, '');
    });
  };

  // Group filters by category for better organization
  const groupedFilters = filters.reduce((groups, filter) => {
    const category = filter.key === 'dataset' ? 'Data' : 
                    filter.key === 'modality' ? 'Language' :
                    filter.key === 'knowledge' ? 'Domain' :
                    filter.key === 'llmJudges' ? 'Evaluation' :
                    'Other';
    
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(filter);
    return groups;
  }, {} as Record<string, FilterConfig[]>);

  return (
    <div className={`w-full ${
      isDarkMode ? 'bg-slate-800/30' : 'bg-white'
    } rounded-lg border ${
      isDarkMode ? 'border-slate-600' : 'border-slate-200'
    } shadow-sm`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-4 flex items-center justify-between text-left transition-colors ${
          isDarkMode 
            ? 'hover:bg-slate-700/50 text-slate-200' 
            : 'hover:bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center space-x-3">
          <FunnelIcon className="w-5 h-5" />
          <span className="font-semibold text-lg">
            Filters
            {showActiveFiltersCount && activeFiltersCount > 0 && (
              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                isDarkMode 
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {activeFiltersCount} active
              </span>
            )}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              className={`p-1 rounded-md transition-colors ${
                isDarkMode 
                  ? 'text-slate-400 hover:text-red-300 hover:bg-red-900/20' 
                  : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
              }`}
              title="Clear all filters"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <ChevronDownIcon 
            className={`w-5 h-5 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`} 
          />
        </div>
      </button>

      {/* Filter Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={`p-4 pt-0 border-t ${
              isDarkMode ? 'border-slate-600' : 'border-slate-200'
            }`}>
              {isMobile ? (
                // Mobile: Collapsible sections
                <div className="space-y-4">
                  {Object.entries(groupedFilters).map(([category, categoryFilters]) => (
                    <div key={category} className="space-y-2">
                      <button
                        onClick={() => toggleSection(category)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isDarkMode 
                            ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-200' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="font-medium">{category}</span>
                        <ChevronDownIcon 
                          className={`w-4 h-4 transition-transform duration-200 ${
                            expandedSections.has(category) ? 'rotate-180' : 'rotate-0'
                          }`} 
                        />
                      </button>
                      
                      <AnimatePresence>
                        {expandedSections.has(category) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-3 p-3">
                              {categoryFilters.map((filter) => {
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
                                    searchable={options.length > 5}
                                    placeholder={`Select ${filter.label.toLowerCase()}...`}
                                    showSelectAll={options.length > 2}
                                    className="w-full"
                                  />
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              ) : (
                // Desktop: Grid layout
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filters.map((filter) => {
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
                        searchable={options.length > 5}
                        placeholder={`Select ${filter.label.toLowerCase()}...`}
                        showSelectAll={options.length > 2}
                        className="w-full"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleFilterPanel;
