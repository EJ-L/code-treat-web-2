/**
 * Centralized styles for ModelSelector components
 */

import { APP_CONFIG } from '@/config/app.config';

export const getDropdownButtonStyles = (isDarkMode: boolean): string => {
  const baseStyles = `
    w-full px-4 py-3 text-left rounded-lg border transition-colors 
    focus:outline-none focus:ring-2 focus:ring-${APP_CONFIG.ui.colors.primary}
  `.replace(/\s+/g, ' ').trim();
  
  const themeStyles = isDarkMode 
    ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
    : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50';
    
  return `${baseStyles} ${themeStyles}`;
};

export const getChevronStyles = (isOpen: boolean): string => {
  const baseStyles = 'absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-transform';
  const rotationStyle = isOpen ? 'rotate-180' : '';
  return `${baseStyles} ${rotationStyle}`;
};

export const getDropdownOptionsStyles = (isDarkMode: boolean): string => {
  const baseStyles = 'absolute z-10 mt-1 w-full rounded-lg shadow-lg border max-h-60 overflow-auto';
  const themeStyles = isDarkMode 
    ? 'bg-slate-800 border-slate-600' 
    : 'bg-white border-gray-300';
  return `${baseStyles} ${themeStyles}`;
};

export const getModelOptionStyles = (isSelected: boolean, isDarkMode: boolean): string => {
  const baseStyles = 'w-full px-4 py-2 text-left transition-colors';
  const hoverStyles = isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100';
  const selectedStyles = isSelected 
    ? (isDarkMode ? 'bg-slate-700' : 'bg-gray-100')
    : '';
  return `${baseStyles} ${hoverStyles} ${selectedStyles}`;
};

export const getLabelStyles = (isDarkMode: boolean): string => {
  const baseStyles = 'block text-sm font-medium mb-2';
  const themeStyles = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  return `${baseStyles} ${themeStyles}`;
};

export const getModelNameStyles = (isDarkMode: boolean): string => {
  return isDarkMode ? 'text-white' : 'text-gray-900';
};

export const getRankStyles = (isDarkMode: boolean): string => {
  const baseStyles = 'text-sm';
  const themeStyles = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  return `${baseStyles} ${themeStyles}`;
};
