export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm">Loading dashboard...</span>
      </div>
    </div>
  );
}
