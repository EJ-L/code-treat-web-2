import { FC, ReactNode, createContext, useContext, useRef, useCallback } from 'react';

interface AccessibilityContextType {
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  focusElement: (elementId: string) => void;
  trapFocus: (containerId: string) => void;
  releaseFocus: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: FC<AccessibilityProviderProps> = ({ children }) => {
  const announcementRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useRef<{
    container: HTMLElement | null;
    previousFocus: HTMLElement | null;
  }>({ container: null, previousFocus: null });

  // Announce messages to screen readers
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcementRef.current) return;

    // Clear previous announcement
    announcementRef.current.textContent = '';
    
    // Set new announcement
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = message;
        announcementRef.current.setAttribute('aria-live', priority);
      }
    }, 100);

    // Clear announcement after a delay
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 5000);
  }, []);

  // Focus specific element
  const focusElement = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      // Make element focusable if it's not already
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
      }
      element.focus();
    }
  }, []);

  // Trap focus within a container
  const trapFocus = useCallback((containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Store current focus and container
    focusTrapRef.current = {
      container,
      previousFocus: document.activeElement as HTMLElement
    };

    // Get all focusable elements within the container
    const getFocusableElements = (element: HTMLElement): HTMLElement[] => {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ].join(', ');

      return Array.from(element.querySelectorAll(focusableSelectors)) as HTMLElement[];
    };

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    // Handle tab navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Call releaseFocus directly without dependency
        const { container: currentContainer, previousFocus } = focusTrapRef.current;
        
        const typedContainer = currentContainer as HTMLElement & { _focusTrapCleanup?: () => void };
        if (currentContainer && typedContainer._focusTrapCleanup) {
          typedContainer._focusTrapCleanup();
          delete typedContainer._focusTrapCleanup;
        }

        if (previousFocus) {
          previousFocus.focus();
        }

        focusTrapRef.current = { container: null, previousFocus: null };
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    // Store cleanup function
    (container as HTMLElement & { _focusTrapCleanup?: () => void })._focusTrapCleanup = () => {
      container.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Release focus trap
  const releaseFocus = useCallback(() => {
    const { container, previousFocus } = focusTrapRef.current;
    
    const typedContainer = container as HTMLElement & { _focusTrapCleanup?: () => void };
    if (container && typedContainer._focusTrapCleanup) {
      typedContainer._focusTrapCleanup();
      delete typedContainer._focusTrapCleanup;
    }

    if (previousFocus) {
      previousFocus.focus();
    }

    focusTrapRef.current = { container: null, previousFocus: null };
  }, []);

  const contextValue: AccessibilityContextType = {
    announceToScreenReader,
    focusElement,
    trapFocus,
    releaseFocus
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* Screen reader announcement area */}
      <div
        ref={announcementRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      />
    </AccessibilityContext.Provider>
  );
};

// Hook to use accessibility context
export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export default AccessibilityProvider;
