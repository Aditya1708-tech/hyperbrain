import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  className = '',
  disabled = false,
  isLoading = false,
  ...props
}) {
  const baseStyle = "flex items-center justify-center space-x-2 rounded-2xl transition-all duration-300 font-semibold focus-ring";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-card text-primary border border-border-theme hover:bg-bg-secondary active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300",
    danger: "bg-card border border-border-theme text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300",
    ghost: "text-muted hover:bg-bg-secondary hover:text-primary transition-colors duration-300"
  };

  const selectedVariant = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyle} ${selectedVariant} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Please wait...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
