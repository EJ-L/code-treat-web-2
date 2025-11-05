import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { 
  vscDarkPlus, 
  vs 
} from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeHighlighterProps {
  code: string;
  language?: string;
  isDarkMode: boolean;
  customStyle?: React.CSSProperties;
  className?: string;
  showLineNumbers?: boolean;
}

/**
 * Modern code highlighter component using react-syntax-highlighter
 * Replaces the deprecated react-highlight package
 */
export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
  code,
  language = 'text',
  isDarkMode,
  customStyle = {},
  className = '',
  showLineNumbers = false
}) => {
  // Language mapping for better compatibility
  const normalizeLanguage = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cpp': 'cpp',
      'c++': 'cpp',
      'c#': 'csharp',
      'cs': 'csharp',
      'rb': 'ruby',
      'sh': 'bash',
      'shell': 'bash',
      'yml': 'yaml',
      'md': 'markdown'
    };
    
    return languageMap[lang.toLowerCase()] || lang.toLowerCase();
  };

  const normalizedLanguage = normalizeLanguage(language);
  
  // Default styles
  const defaultStyle: React.CSSProperties = {
    margin: 0,
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    ...customStyle
  };

  // Choose theme based on dark mode
  const theme = isDarkMode ? vscDarkPlus : vs;

  return (
    <div className={`code-highlighter ${className}`}>
      <SyntaxHighlighter
        language={normalizedLanguage}
        style={theme}
        customStyle={defaultStyle}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        wrapLongLines={true}
        PreTag="div"
        CodeTag="code"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};
