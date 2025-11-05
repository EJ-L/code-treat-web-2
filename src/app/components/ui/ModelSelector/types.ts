/**
 * Type definitions for ModelSelector components
 */

export interface ModelData {
  name: string;
  rank: number | string;
  scores: Record<string, number>;
}

export interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  label: string;
  modelData: ModelData[];
  isDarkMode: boolean;
}

export interface DropdownButtonProps {
  selectedModel: string;
  isOpen: boolean;
  isDarkMode: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export interface DropdownOptionsProps {
  modelData: ModelData[];
  selectedModel: string;
  isDarkMode: boolean;
  onSelect: (modelName: string) => void;
}

export interface ModelOptionProps {
  model: ModelData;
  isSelected: boolean;
  isDarkMode: boolean;
  onSelect: (modelName: string) => void;
}

export interface DropdownLabelProps {
  label: string;
  isDarkMode: boolean;
}
