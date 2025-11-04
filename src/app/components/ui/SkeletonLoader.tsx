import { FC } from 'react';
import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
  type?: 'table' | 'card' | 'list' | 'chart' | 'filter' | 'text';
  rows?: number;
  columns?: number;
  isDarkMode?: boolean;
  className?: string;
  animated?: boolean;
}

const SkeletonLoader: FC<SkeletonLoaderProps> = ({
  type = 'text',
  rows = 3,
  columns = 4,
  isDarkMode = false,
  className = '',
  animated = true
}) => {
  const baseSkeletonClass = `rounded ${
    isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
  } ${animated ? 'animate-pulse' : ''}`;

  const shimmerAnimation = animated ? {
    initial: { opacity: 0.6 },
    animate: { opacity: 1 },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: "reverse" as const,
      ease: "easeInOut"
    }
  } : {};

  const SkeletonElement: FC<{ width?: string; height?: string; className?: string }> = ({ 
    width = 'w-full', 
    height = 'h-4', 
    className: elementClassName = '' 
  }) => (
    <motion.div
      className={`${baseSkeletonClass} ${width} ${height} ${elementClassName}`}
      {...shimmerAnimation}
    />
  );

  const renderTableSkeleton = () => (
    <div className={`space-y-4 ${className}`}>
      {/* Table Header */}
      <div className={`p-4 rounded-lg border ${
        isDarkMode ? 'border-slate-600 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonElement key={`header-${index}`} height="h-6" />
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div className={`rounded-lg border ${
        isDarkMode ? 'border-slate-600 bg-slate-800/30' : 'border-slate-200 bg-white'
      }`}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`} 
            className={`p-4 ${rowIndex !== rows - 1 ? 'border-b' : ''} ${
              isDarkMode ? 'border-slate-600' : 'border-slate-200'
            }`}
          >
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <SkeletonElement 
                  key={`cell-${rowIndex}-${colIndex}`} 
                  height="h-5"
                  width={colIndex === 0 ? 'w-3/4' : 'w-full'} // First column (model name) slightly shorter
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCardSkeleton = () => (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div 
          key={`card-${index}`}
          className={`p-6 rounded-lg border ${
            isDarkMode ? 'border-slate-600 bg-slate-800/30' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <SkeletonElement width="w-12" height="h-12" className="rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonElement width="w-1/3" height="h-5" />
                <SkeletonElement width="w-1/2" height="h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <SkeletonElement width="w-full" height="h-4" />
              <SkeletonElement width="w-5/6" height="h-4" />
              <SkeletonElement width="w-4/6" height="h-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderListSkeleton = () => (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div 
          key={`list-${index}`}
          className="flex items-center space-x-4 p-3 rounded-lg"
        >
          <SkeletonElement width="w-8" height="h-8" className="rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonElement width="w-1/4" height="h-4" />
            <SkeletonElement width="w-3/4" height="h-3" />
          </div>
          <SkeletonElement width="w-16" height="h-6" />
        </div>
      ))}
    </div>
  );

  const renderChartSkeleton = () => (
    <div className={`${className}`}>
      <div className={`p-6 rounded-lg border ${
        isDarkMode ? 'border-slate-600 bg-slate-800/30' : 'border-slate-200 bg-white'
      }`}>
        {/* Chart Title */}
        <div className="mb-6">
          <SkeletonElement width="w-1/3" height="h-6" />
        </div>
        
        {/* Chart Area */}
        <div className="relative h-64 mb-4">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonElement key={`y-${index}`} width="w-8" height="h-3" />
            ))}
          </div>
          
          {/* Chart bars/lines */}
          <div className="ml-12 h-full flex items-end justify-between space-x-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonElement 
                key={`bar-${index}`} 
                width="w-8" 
                height={`h-${Math.floor(Math.random() * 48) + 16}`} // Random heights
                className="flex-shrink-0"
              />
            ))}
          </div>
          
          {/* X-axis labels */}
          <div className="ml-12 mt-2 flex justify-between">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonElement key={`x-${index}`} width="w-8" height="h-3" />
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center space-x-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`legend-${index}`} className="flex items-center space-x-2">
              <SkeletonElement width="w-4" height="h-4" className="rounded-full" />
              <SkeletonElement width="w-16" height="h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFilterSkeleton = () => (
    <div className={`space-y-4 ${className}`}>
      <div className={`p-4 rounded-lg border ${
        isDarkMode ? 'border-slate-600 bg-slate-800/30' : 'border-slate-200 bg-white'
      }`}>
        {/* Filter Title */}
        <div className="mb-4">
          <SkeletonElement width="w-24" height="h-5" />
        </div>
        
        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`filter-${index}`} className="space-y-2">
              <SkeletonElement width="w-full" height="h-10" className="rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTextSkeleton = () => (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonElement 
          key={`text-${index}`} 
          width={index === rows - 1 ? 'w-3/4' : 'w-full'} 
          height="h-4" 
        />
      ))}
    </div>
  );

  switch (type) {
    case 'table':
      return renderTableSkeleton();
    case 'card':
      return renderCardSkeleton();
    case 'list':
      return renderListSkeleton();
    case 'chart':
      return renderChartSkeleton();
    case 'filter':
      return renderFilterSkeleton();
    case 'text':
    default:
      return renderTextSkeleton();
  }
};

export default SkeletonLoader;
