import { FC, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  isDarkMode: boolean;
  maxDisplayedTags?: number;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  placeholder?: string;
  showSelectAll?: boolean;
}

const MultiSelectDropdown: FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  isDarkMode,
  maxDisplayedTags = 3,
  className = "",
  disabled = false,
  searchable = true,
  placeholder,
  showSelectAll = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Measure available width for responsive truncation
  useEffect(() => {
    const measureWidth = () => {
      if (dropdownRef.current && labelRef.current) {
        const containerWidth = dropdownRef.current.offsetWidth;
        const labelWidth = labelRef.current.offsetWidth;
        // Account for padding (24px), margins (4px), clear/chevron buttons (40px)
        const reservedSpace = 70;
        const available = containerWidth - labelWidth - reservedSpace;
        setAvailableWidth(Math.max(80, available)); // Minimum 80px
      }
    };

    // Use setTimeout to ensure DOM measurements are accurate after layout
    const timer = setTimeout(measureWidth, 0);
    
    // Debounced resize handler for better performance
    let resizeTimer: NodeJS.Timeout;
    const debouncedMeasureWidth = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measureWidth, 100);
    };
    
    window.addEventListener('resize', debouncedMeasureWidth);
    return () => {
      clearTimeout(timer);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedMeasureWidth);
    };
  }, [label, selectedValues.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchable]);

  const handleToggleOption = (value: string) => {
    if (disabled) return;
    
    const newSelectedValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    onSelectionChange(newSelectedValues);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRemoveTag = (valueToRemove: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    
    const newSelectedValues = selectedValues.filter(v => v !== valueToRemove);
    onSelectionChange(newSelectedValues);
  };

  const clearAll = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    
    onSelectionChange([]);
  };

  // Filter options based on search term
  const filteredOptions = options.filter(option => {
    if (option.disabled) return false;
    if (!searchable || !searchTerm) return true;
    return option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
           option.value.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Check if option is available
  const availableOptions = options.filter(option => !option.disabled);
  const hasAvailableOptions = availableOptions.length > 0;

  // Select all functionality
  const handleSelectAll = () => {
    if (disabled) return;
    const allValues = filteredOptions.map(option => option.value);
    const allSelected = allValues.every(value => selectedValues.includes(value));
    
    if (allSelected) {
      // Deselect all filtered options
      const newSelectedValues = selectedValues.filter(value => 
        !allValues.includes(value)
      );
      onSelectionChange(newSelectedValues);
    } else {
      // Select all filtered options
      const newSelectedValues = [...new Set([...selectedValues, ...allValues])];
      onSelectionChange(newSelectedValues);
    }
  };

  const areAllFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(option => selectedValues.includes(option.value));

  // Helper function to create truncated available options display (when no selection)
  const getAvailableOptionsDisplay = () => {
    const availableLabels = availableOptions.map(option => option.label);
    const optionsText = availableLabels.join(', ');
    const fullText = `[${optionsText}]`;
    
    // If no width measured yet, use fallback logic
    if (availableWidth === 0) {
      // Use maxDisplayedTags as fallback - mobile vs desktop
      const fallbackMaxLength = maxDisplayedTags === 1 ? 25 : 45;
      if (fullText.length <= fallbackMaxLength) {
        return fullText;
      }
      const availableSpace = fallbackMaxLength - 5;
      const halfSpace = Math.floor(availableSpace / 2);
      const firstPart = optionsText.substring(0, halfSpace);
      const lastPart = optionsText.substring(optionsText.length - halfSpace);
      return `[${firstPart}...${lastPart}]`;
    }
    
    // Calculate max characters based on available pixel width
    // More conservative estimation: 7 pixels per character (accounting for spacing)
    const estimatedCharWidth = 7;
    const maxChars = Math.floor(availableWidth / estimatedCharWidth);
    
    // Responsive bounds based on screen size
    const minChars = window.innerWidth < 640 ? 15 : 20; // Smaller minimum on mobile
    const maxChars_capped = Math.min(maxChars, 120); // Cap at 120 chars max
    const maxLength = Math.max(minChars, maxChars_capped);
    
    if (fullText.length <= maxLength) {
      return fullText;
    }
    
    // Truncate in the middle, preserving start and end
    const availableSpace = maxLength - 5; // Account for "[...]"
    const halfSpace = Math.floor(availableSpace / 2);
    const firstPart = optionsText.substring(0, halfSpace);
    const lastPart = optionsText.substring(optionsText.length - halfSpace);
    
    return `[${firstPart}...${lastPart}]`;
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && hasAvailableOptions && setIsOpen(!isOpen)}
        disabled={disabled || !hasAvailableOptions}
        className={`
          w-full min-h-[44px] px-3 py-2 text-left rounded-lg border transition-all duration-200
          flex items-center justify-between gap-2
          ${disabled || !hasAvailableOptions
            ? isDarkMode 
              ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' 
              : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
            : isDarkMode
              ? 'bg-slate-800 border-slate-600 text-slate-200 hover:border-slate-500'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
          }
          ${isOpen && !disabled && hasAvailableOptions
            ? isDarkMode
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : 'border-blue-500 ring-1 ring-blue-500/20'
            : ''
          }
        `}
      >
        <div className="flex-1 min-w-0">
          {selectedValues.length === 0 ? (
            <div className="flex items-center min-w-0">
              <span 
                ref={labelRef}
                className={`font-bold flex-shrink-0 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {label}:
              </span>
              <span className={`ml-1 truncate font-bold ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {placeholder || getAvailableOptionsDisplay()}
              </span>
            </div>
          ) : (
            <div className="flex items-center">
              <span 
                ref={labelRef}
                className={`font-bold flex-shrink-0 mr-2 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {label}:
              </span>
              <div className="flex items-center min-w-0">
                <span className={`font-bold ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  {selectedValues.length === 1 ? (
                    // Show option name for single selection
                    (() => {
                      const option = options.find(opt => opt.value === selectedValues[0]);
                      return option?.label || selectedValues[0];
                    })()
                  ) : selectedValues.length === availableOptions.length ? (
                    // Show "All filters" when all options are selected
                    'All filters'
                  ) : (
                    // Show "Selected (X/Y) options" for multiple selections
                    `${selectedValues.length} selected`
                  )}
                </span>
                {selectedValues.length > 1 && (
                  <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                    isDarkMode 
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    {selectedValues.length}/{availableOptions.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedValues.length > 0 && !disabled && (
            <div
              onClick={clearAll}
              className={`
                p-1 rounded hover:bg-opacity-20 cursor-pointer
                ${isDarkMode 
                  ? 'text-slate-400 hover:bg-red-400 hover:text-red-300' 
                  : 'text-slate-500 hover:bg-red-500 hover:text-red-600'
                }
              `}
            >
              <XMarkIcon className="w-4 h-4" />
            </div>
          )}
          
          <ChevronDownIcon 
            className={`
              w-4 h-4 transition-transform duration-200
              ${isOpen ? 'rotate-180' : 'rotate-0'}
              ${disabled || !hasAvailableOptions
                ? isDarkMode ? 'text-slate-600' : 'text-slate-400'
                : isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }
            `} 
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && hasAvailableOptions && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`
              absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-80 overflow-hidden
              ${isDarkMode
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-slate-300'
              }
            `}
          >
            {/* Search Input */}
            {searchable && (
              <div className={`p-3 border-b ${
                isDarkMode ? 'border-slate-600' : 'border-slate-200'
              }`}>
                <div className="relative">
                  <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search options..."
                    className={`w-full pl-10 pr-3 py-2 text-sm rounded-md border transition-colors ${
                      isDarkMode
                        ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400 focus:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-700 placeholder-slate-500 focus:border-blue-500'
                    } focus:outline-none focus:ring-1 focus:ring-blue-500/20`}
                  />
                </div>
              </div>
            )}

            {/* Select All Button */}
            {showSelectAll && filteredOptions.length > 1 && (
              <div className={`p-2 border-b ${
                isDarkMode ? 'border-slate-600' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`w-full px-3 py-2 text-left text-sm font-medium rounded-md transition-colors flex items-center justify-between ${
                    areAllFilteredSelected
                      ? isDarkMode
                        ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : isDarkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    {areAllFilteredSelected ? 'Deselect All' : 'Select All'}
                    {searchTerm && ` (${filteredOptions.length} filtered)`}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {filteredOptions.filter(opt => selectedValues.includes(opt.value)).length}/{filteredOptions.length}
                  </span>
                </button>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-4 text-center text-sm ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {searchTerm ? 'No options match your search' : 'No options available'}
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleOption(option.value)}
                      className={`
                        w-full px-3 py-2 text-left text-sm font-medium transition-colors
                        flex items-center justify-between hover:scale-[1.01] transform
                        ${isSelected
                          ? isDarkMode
                            ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : isDarkMode
                            ? 'text-slate-300 hover:bg-slate-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <svg className="w-4 h-4 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiSelectDropdown;
