import { ReactNode, forwardRef } from 'react';
import { motion, MotionProps } from 'framer-motion';

interface AccessibleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isDarkMode?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  // Accessibility props
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaPressed?: boolean;
  role?: string;
  // Animation props
  animate?: boolean;
  motionProps?: MotionProps;
}

const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isDarkMode = false,
  isLoading = false,
  loadingText = 'Loading...',
  leftIcon,
  rightIcon,
  fullWidth = false,
  ariaLabel,
  ariaDescribedBy,
  ariaExpanded,
  ariaPressed,
  role = 'button',
  animate = true,
  motionProps = {},
  className = '',
  disabled,
  ...props
}, ref) => {
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[52px]'
  };

  // Variant classes
  const getVariantClasses = () => {
    const baseClasses = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    switch (variant) {
      case 'primary':
        return `${baseClasses} ${
          isDarkMode
            ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 disabled:bg-blue-800 disabled:text-blue-300'
            : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 disabled:bg-blue-300 disabled:text-blue-500'
        }`;
      case 'secondary':
        return `${baseClasses} ${
          isDarkMode
            ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 focus:ring-slate-500 disabled:bg-slate-800 disabled:text-slate-500'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-slate-500 disabled:bg-slate-100 disabled:text-slate-400'
        }`;
      case 'ghost':
        return `${baseClasses} ${
          isDarkMode
            ? 'text-slate-300 hover:bg-slate-700 focus:ring-slate-500 disabled:text-slate-600'
            : 'text-slate-600 hover:bg-slate-100 focus:ring-slate-500 disabled:text-slate-400'
        }`;
      case 'danger':
        return `${baseClasses} ${
          isDarkMode
            ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:bg-red-800 disabled:text-red-300'
            : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:bg-red-300 disabled:text-red-500'
        }`;
      default:
        return baseClasses;
    }
  };

  // Animation variants
  const buttonVariants = {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
    disabled: { scale: 1, opacity: 0.6 }
  };

  const isDisabled = disabled || isLoading;

  const buttonContent = (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-current" />
        </div>
      )}
      
      <div className={`flex items-center justify-center space-x-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {leftIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        
        <span className="truncate">
          {isLoading ? loadingText : children}
        </span>
        
        {rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>
    </>
  );

  const buttonClasses = `
    ${getVariantClasses()}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${isLoading ? 'relative' : ''}
    ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
    ${className}
  `;

  // Separate motion-conflicting props from regular button props
  const {
    onAnimationStart,
    onAnimationEnd,
    onAnimationIteration,
    onDragStart,
    onDragEnd,
    onDrag,
    onDragEnter,
    onDragExit,
    onDragLeave,
    onDragOver,
    onDrop,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    onMouseOut,
    onMouseOver,
    onMouseUp,
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onTouchCancel,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    onPointerMove,
    onPointerOut,
    onPointerOver,
    onPointerUp,
    onPointerCancel,
    ...buttonProps
  } = props;

  const accessibilityProps = {
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-expanded': ariaExpanded,
    'aria-pressed': ariaPressed,
    'aria-disabled': isDisabled,
    role,
    disabled: isDisabled,
    ...buttonProps
  };

  if (animate) {
    return (
      <motion.button
        ref={ref}
        className={buttonClasses}
        variants={buttonVariants}
        initial="initial"
        whileHover={!isDisabled ? "hover" : "disabled"}
        whileTap={!isDisabled ? "tap" : "disabled"}
        animate={isDisabled ? "disabled" : "initial"}
        {...motionProps}
        {...accessibilityProps}
      >
        {buttonContent}
      </motion.button>
    );
  }

  return (
    <button
      ref={ref}
      className={buttonClasses}
      onAnimationStart={onAnimationStart}
      onAnimationEnd={onAnimationEnd}
      onAnimationIteration={onAnimationIteration}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDrag={onDrag}
      onDragEnter={onDragEnter}
      onDragExit={onDragExit}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onMouseOut={onMouseOut}
      onMouseOver={onMouseOver}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      onPointerOver={onPointerOver}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      {...accessibilityProps}
    >
      {buttonContent}
    </button>
  );
});

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;
