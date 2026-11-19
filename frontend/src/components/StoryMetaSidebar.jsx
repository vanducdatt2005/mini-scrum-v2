import React from 'react';

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
  onStatusChange,
  // US-033: Props cho Planning Poker
  onOpenPoker,
  isCreatingPoker = false,
  activePokerRoom = null,
  canOpenPoker = true
}) {
  return (
    <div className="w-full md:w-80 bg-surface-container-low/50 p-6 md:p-8 flex flex-col gap-6 border-l border-outline-variant/15 shrink-0">
      {/* NÚT MỞ PHÒNG POKER CHO USER STORY (US-033: AC1) */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-outline">
            Ước tính Story Points
          </span>
          {activePokerRoom && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Đang mở
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenPoker}
          disabled={isCreatingPoker}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
        >
          <span className="material-symbols-outlined text-base group-hover:rotate-12 transition-transform">
            style
          </span>
          <span>
            {isCreatingPoker 
              ? "Đang tạo phòng..." 
              : activePokerRoom 
              ? "Vào phòng Poker" 
              : "Mở Poker (Scrum Master)"}
          </span>
        </button>

        {activePokerRoom && (
          <div className="text-[11px] text-center text-on-surface-variant font-mono">
            Mã phòng: <span className="font-bold text-primary">{activePokerRoom.roomCode}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-outline block">
          Trạng thái
        </label>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
            className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-2.5 pl-4 pr-10 text-sm font-semibold text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
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
      <div className="space-y-4">
        {/* Assignee */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">person</span>
            Assignee
          </span>
          <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-full shadow-sm border border-outline-variant/10">
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
            {storyPoints !== null && storyPoints !== undefined ? `${storyPoints} SP` : 'Chưa gán'}
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
      <div className="pt-4 border-t border-outline-variant/20 space-y-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase text-outline">Created</span>
          <span className="text-xs text-on-surface font-medium">{created}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase text-outline">Updated</span>
          <span className="text-xs text-on-surface font-medium">{updated}</span>
        </div>
      </div>

      {/* Sprint Progress */}
      <div className="mt-auto pt-4 border-t border-outline-variant/20">
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
