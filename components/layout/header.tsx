export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/90 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Campus Life OS</h1>
          <p className="text-sm text-slate-500">Your daily university dashboard</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-indigo-100" />
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">Alex Chen</p>
            <p className="text-xs text-slate-500">Profile</p>
          </div>
        </div>
      </div>
    </header>
  );
}
