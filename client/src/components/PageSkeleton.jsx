export default function PageSkeleton() {
  return (
    <div className="min-h-[60vh] p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto animate-pulse">
        {/* Title skeleton */}
        <div className="h-8 w-48 rounded-lg mb-2" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
        <div className="h-4 w-72 rounded-lg mb-8" style={{ backgroundColor: 'var(--bg-tertiary)' }} />

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }} />
          ))}
        </div>

        {/* Main area skeleton */}
        <div className="h-80 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }} />
      </div>
    </div>
  );
}
