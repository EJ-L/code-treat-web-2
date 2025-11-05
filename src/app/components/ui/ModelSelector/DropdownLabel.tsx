import React from 'react';
import { DropdownLabelProps } from './types';
import { getLabelStyles } from './styles';

/**
 * Dropdown label component for model selector
 */
export const DropdownLabel: React.FC<DropdownLabelProps> = ({ label, isDarkMode }) => (
  <label className={getLabelStyles(isDarkMode)}>
    {label}
  </label>
);
