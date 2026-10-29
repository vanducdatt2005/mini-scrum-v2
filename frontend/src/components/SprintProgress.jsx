export default function SprintProgress({ sprintName = "Sprint", completed = 65, done = 12, left = 8 }) {
  // Circle params: r=88, circumference = 2π*88 ≈ 553
  const circumference = 553;
  const offset = circumference - (completed / 100) * circumference;

  return (
    <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 ambient-shadow flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Icon */}
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <span className="material-symbols-outlined text-8xl">analytics</span>
      </div>

      <h3 className="font-['Manrope'] font-bold text-lg mb-8 self-start">{sprintName} Progress</h3>

      {/* Circular Progress */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="text-surface-container-high"
            cx="96" cy="96" r="88"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
          />
          <circle
            className="text-primary"
            cx="96" cy="96" r="88"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-extrabold text-on-surface">{completed}%</span>
          <span className="text-xs font-bold text-outline uppercase tracking-widest">Completed</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 w-full">
        <div className="bg-surface-container-low p-3 rounded-lg text-center">
          <p className="text-[10px] font-bold text-outline uppercase">Done</p>
          <p className="text-xl font-bold text-primary">{done}</p>
        </div>
        <div className="bg-surface-container-low p-3 rounded-lg text-center">
          <p className="text-[10px] font-bold text-outline uppercase">Left</p>
          <p className="text-xl font-bold text-on-surface-variant">{left}</p>
        </div>
      </div>
    </div>
  );
}
