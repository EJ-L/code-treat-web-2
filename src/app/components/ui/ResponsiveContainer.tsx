import { FC, ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  isDarkMode?: boolean;
  enableTouchOptimization?: boolean;
}

interface BreakpointInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  orientation: 'portrait' | 'landscape';
}

const ResponsiveContainer: FC<ResponsiveContainerProps> = ({
  children,
  className = '',
  maxWidth = 'full',
  padding = 'md',
  isDarkMode = false,
  enableTouchOptimization = true
}) => {
  const [breakpointInfo, setBreakpointInfo] = useState<BreakpointInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 1024,
    orientation: 'landscape'
  });

  // Detect screen size and orientation
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setBreakpointInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        screenWidth: width,
        orientation: width > height ? 'landscape' : 'portrait'
      });
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    window.addEventListener('orientationchange', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
      window.removeEventListener('orientationchange', updateBreakpoint);
    };
  }, []);

  // Get max width classes
  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case '2xl': return 'max-w-2xl';
      case 'full': return 'max-w-full';
      default: return 'max-w-full';
    }
  };

  // Get padding classes
  const getPaddingClass = () => {
    switch (padding) {
      case 'none': return 'p-0';
      case 'sm': return 'p-2 sm:p-3';
      case 'md': return 'p-4 sm:p-6';
      case 'lg': return 'p-6 sm:p-8';
      default: return 'p-4 sm:p-6';
    }
  };

  // Touch optimization styles
  const touchOptimizationClass = enableTouchOptimization && breakpointInfo.isMobile 
    ? 'touch-manipulation select-none' 
    : '';

  // Container variants for animations
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
        staggerChildren: 0.1
      }
    }
  };

  const childVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`
        w-full mx-auto
        ${getMaxWidthClass()}
        ${getPaddingClass()}
        ${touchOptimizationClass}
        ${className}
      `}
    >
      {/* Responsive Grid Context Provider */}
      <div 
        className="responsive-grid-context"
        data-mobile={breakpointInfo.isMobile}
        data-tablet={breakpointInfo.isTablet}
        data-desktop={breakpointInfo.isDesktop}
        data-orientation={breakpointInfo.orientation}
      >
        <motion.div variants={childVariants}>
          {children}
        </motion.div>
      </div>

      {/* Mobile-specific optimizations */}
      {breakpointInfo.isMobile && (
        <style jsx>{`
          .responsive-grid-context {
            /* Improve touch scrolling */
            -webkit-overflow-scrolling: touch;
            
            /* Prevent zoom on input focus */
            -webkit-text-size-adjust: 100%;
            
            /* Optimize for mobile performance */
            transform: translateZ(0);
            backface-visibility: hidden;
          }
          
          /* Larger touch targets on mobile */
          .responsive-grid-context button,
          .responsive-grid-context [role="button"] {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Better spacing for mobile */
          .responsive-grid-context .grid {
            gap: 0.75rem;
          }
          
          /* Improved text readability */
          .responsive-grid-context {
            font-size: 16px;
            line-height: 1.5;
          }
        `}</style>
      )}
    </motion.div>
  );
};

// Hook to use breakpoint information in child components
export const useBreakpoint = () => {
  const [breakpointInfo, setBreakpointInfo] = useState<BreakpointInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 1024,
    orientation: 'landscape'
  });

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setBreakpointInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        screenWidth: width,
        orientation: width > height ? 'landscape' : 'portrait'
      });
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    window.addEventListener('orientationchange', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
      window.removeEventListener('orientationchange', updateBreakpoint);
    };
  }, []);

  return breakpointInfo;
};

export default ResponsiveContainer;
