import { FC } from 'react';

interface SkipLinkProps {
  targetId?: string;
  isDarkMode?: boolean;
  className?: string;
}

const SkipLink: FC<SkipLinkProps> = ({
  targetId = 'main-content',
  isDarkMode = false,
  className = ''
}) => {

  return (
    <a
      href={`#${targetId}`}
      className={`
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
        px-4 py-2 rounded-md font-medium text-sm z-[9999]
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
        ${isDarkMode
          ? 'bg-slate-800 text-slate-200 border border-slate-600 focus:ring-blue-500'
          : 'bg-white text-slate-900 border border-slate-300 focus:ring-blue-500 shadow-lg'
        }
        ${className}
      `}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const target = document.getElementById(targetId);
          if (target) {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }}
    >
      Skip to main content
    </a>
  );
};

export default SkipLink;
