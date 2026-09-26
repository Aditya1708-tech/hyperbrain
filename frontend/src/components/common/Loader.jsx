import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loader({
  size = 'md',
  message = '',
  className = ''
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const selectedSize = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <Loader2 className={`${selectedSize} animate-spin text-blue-600 dark:text-blue-400`} />
      {message && (
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          {message}
        </span>
      )}
    </div>
  );
}
