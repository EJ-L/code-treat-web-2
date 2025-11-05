import React from 'react';

/**
 * Crown icon component for indicating the better performing model
 */
interface CrownIconProps {
  className?: string;
}

export const CrownIcon: React.FC<CrownIconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l.9-5.4-2.1 1.8L12 8l-3.1 2.4-2.1-1.8L7.7 14z"/>
  </svg>
);
