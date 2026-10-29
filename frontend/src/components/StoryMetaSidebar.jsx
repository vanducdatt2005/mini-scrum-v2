const assigneeAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDjHo69J_OA-i4NLRQcnbxQ1Tt2uQA7NLf6c1GIDHZV5FAwCs-peO9QJkwFsI4oIDHZ6rtJY2pDcu8TSSadQiyesjhJOaQzGR_Sq8Dzz2_Qe4QR0-HzYVf24AcP0Fr1yth7YMbq4Z-AIUCCw10qmVccC4F_UIo1W1RHBK7a3eSSu2EEI_LAoa4OcipygTmJ0tu94Aw7s2W3VNuWUUDQgHJFatMBTH7ZN7xldHEeZkMIVRL3zsmIvcB6FhNVBqNW75fsL9pcevaDfo8";

export default function StoryMetaSidebar({
  status = "TODO",
  assignee = "Alex",
  storyPoints = 8,
  priority = "High",
  created = "Feb 14, 2024 · 09:12 AM",
  updated = "10 mins ago",
  sprintProgress = 65,
  onStatusChange, // Mới thêm
}) {
  return (
    <div className="w-full md:w-80 bg-surface-container-low/50 p-8 flex flex-col gap-8 border-l border-outline-variant/15 shrink-0">
      {/* Status */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-widest text-outline block">
          Trạng thái
        </label>
        <div className="relative">
          <select
            value={status} // Chuyển sang controlled component
            onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
            className="w-full appearance-none bg-surface-container-lowest border-none rounded-xl py-3 pl-4 pr-10 text-sm font-semibold text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="space-y-6">
        {/* Assignee */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">person</span>
            Assignee
          </span>
          <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-full shadow-sm">
            <img src={assigneeAvatar} alt={assignee} className="w-5 h-5 rounded-full object-cover" />
            <span className="text-xs font-bold text-on-surface">{assignee}</span>
          </div>
        </div>

        {/* Story Points */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">speed</span>
            Story Points
          </span>
          <div className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-lg text-xs font-extrabold shadow-sm">
            {storyPoints}
          </div>
        </div>

        {/* Priority */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">priority_high</span>
            Priority
          </span>
          <div className="flex items-center text-xs font-bold text-error bg-error-container/50 px-3 py-1 rounded-lg border border-error/10">
            {priority}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="pt-6 border-t border-outline-variant/20 space-y-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-outline">Created</span>
          <span className="text-xs text-on-surface font-medium">{created}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-outline">Updated</span>
          <span className="text-xs text-on-surface font-medium">{updated}</span>
        </div>
      </div>

      {/* Sprint Progress */}
      <div className="mt-auto pt-6 border-t border-outline-variant/20">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-bold uppercase text-outline">Sprint Progress</span>
          <span className="text-xs font-extrabold text-primary">{sprintProgress}%</span>
        </div>
        <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${sprintProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
