export default function Loading() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-5 w-56 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-3 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
      {/* step indicator skeleton */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
            {i < 3 && <div className="h-0.5 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse" />}
          </div>
        ))}
      </div>
      {/* drop zone skeleton */}
      <div className="card h-52 animate-pulse bg-gray-50 dark:bg-gray-900" />
      {/* action row skeleton */}
      <div className="flex justify-between">
        <div className="h-10 w-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-10 w-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    </div>
  );
}
