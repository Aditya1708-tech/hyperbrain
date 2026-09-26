import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

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
    primary: "btn-premium-primary disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "btn-premium-secondary disabled:opacity-50 disabled:cursor-not-allowed",
    danger: "btn-premium-secondary border-red-500/20 text-red-500 hover:border-red-500/40 hover:bg-red-500/5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "text-text-muted hover:bg-white/5 hover:text-text"
  };

  const selectedVariant = variants[variant] || variants.primary;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      whileHover={{ scale: 1.02, translateY: -0.5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 450, damping: 14 }}
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
    </motion.button>
  );
}
