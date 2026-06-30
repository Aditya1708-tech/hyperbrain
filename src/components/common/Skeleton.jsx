import React from 'react';

export default function Skeleton({
  variant = 'text',
  width = '100%',
  height = '16px',
  className = ''
}) {
  const baseClass = "bg-slate-200 dark:bg-slate-800 animate-pulse rounded-md";
  const variants = {
    text: "h-4 w-full",
    circle: "rounded-full",
    card: "h-32 w-full",
    rect: ""
  };

  const style = {
    width: variant === 'circle' ? height : width,
    height: height
  };

  const variantClass = variants[variant] || '';

  return (
    <div 
      className={`${baseClass} ${variantClass} ${className}`}
      style={style}
    />
  );
}
