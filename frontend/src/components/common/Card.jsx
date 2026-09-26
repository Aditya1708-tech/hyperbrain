export default function Card({
  children,
  className = '',
  ...props
}) {
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`bg-card text-text border border-border rounded-2xl shadow-lg hover:border-border-hover hover:shadow-[0_0_30px_rgba(0,229,255,0.06)] hover:-translate-y-0.5 transition-all duration-300 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
