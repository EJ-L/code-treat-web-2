import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { DropdownButtonProps } from './types';
import { getDropdownButtonStyles, getChevronStyles } from './styles';

/**
 * Dropdown button component for model selector
 */
export const DropdownButton: React.FC<DropdownButtonProps> = ({
  selectedModel,
  isOpen,
  isDarkMode,
  onClick,
  onKeyDown
}) => (
  <button
    onClick={onClick}
    onKeyDown={onKeyDown}
    className={getDropdownButtonStyles(isDarkMode)}
    aria-expanded={isOpen}
    aria-haspopup="listbox"
  >
    <span className="block truncate">
      {selectedModel || 'Select a model...'}
    </span>
    <ChevronDownIcon className={getChevronStyles(isOpen)} />
  </button>
);
