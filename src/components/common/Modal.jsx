import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title = '',
  children,
  className = '',
  ...props
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className={`bg-card text-primary border border-border-theme w-full max-w-lg rounded-2xl shadow-xl transform transition-all duration-300 p-6 relative flex flex-col max-h-[90vh] ${className}`}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-border-theme pb-4">
          <h3 className="text-lg font-bold tracking-tight text-primary">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-bg-secondary rounded-lg text-muted hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto mt-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
