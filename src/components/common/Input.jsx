export default function Input({
  label = '',
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  required = false,
  className = '',
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider transition-colors duration-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center">
            <Icon className="w-5 h-5 text-muted transition-colors duration-300" />
          </span>
        )}
        <input
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full ${
            Icon ? 'pl-11' : 'px-4'
          } pr-4 py-3 theme-input rounded-2xl text-sm ${className}`}
          {...props}
        />
      </div>
    </div>
  );
}
