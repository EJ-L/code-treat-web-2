import { FC } from 'react';
import { motion } from 'framer-motion';

interface EnhancedLoadingProps {
  type?: 'spinner' | 'dots' | 'pulse' | 'skeleton' | 'progress' | 'wave';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  isDarkMode?: boolean;
  progress?: number; // For progress type
  showPercentage?: boolean;
}

const EnhancedLoading: FC<EnhancedLoadingProps> = ({
  type = 'spinner',
  size = 'md',
  text,
  isDarkMode = false,
  progress = 0,
  showPercentage = false
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-8 h-8';
      case 'md':
      default:
        return 'w-6 h-6';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return 'text-sm';
      case 'lg':
        return 'text-lg';
      case 'md':
      default:
        return 'text-base';
    }
  };

  const renderSpinner = () => (
    <motion.div
      className={`${getSizeClasses()} border-2 border-transparent border-t-blue-500 border-r-blue-500 rounded-full`}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );

  const renderDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`${size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} bg-blue-500 rounded-full`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <motion.div
      className={`${getSizeClasses()} bg-blue-500 rounded-full`}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.7, 1, 0.7]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );

  const renderSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} rounded w-3/4`}></div>
      <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} rounded w-1/2`}></div>
      <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} rounded w-5/6`}></div>
    </div>
  );

  const renderProgress = () => (
    <div className="w-full max-w-md">
      <div className={`w-full bg-gray-200 rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
        <motion.div
          className="bg-blue-600 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {showPercentage && (
        <div className={`text-center mt-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );

  const renderWave = () => (
    <div className="flex space-x-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className={`${size === 'sm' ? 'w-1 h-6' : size === 'lg' ? 'w-2 h-12' : 'w-1.5 h-8'} bg-blue-500 rounded-full`}
          animate={{
            scaleY: [1, 2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );

  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'skeleton':
        return renderSkeleton();
      case 'progress':
        return renderProgress();
      case 'wave':
        return renderWave();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {renderLoader()}
      {text && (
        <motion.p
          className={`${getTextSize()} ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} font-medium`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </motion.div>
  );
};

export default EnhancedLoading;
