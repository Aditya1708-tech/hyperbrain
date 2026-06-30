export default function Card({
  children,
  className = '',
  ...props
}) {
  return (
    <div
      className={`bg-card text-primary border border-border-theme rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
