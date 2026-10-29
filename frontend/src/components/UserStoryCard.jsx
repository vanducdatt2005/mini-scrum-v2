//frontend/src/components/UserStoryCard.jsx
import React, { useState } from 'react';
import { getAvatarUrl } from '../services/api';

const priorityConfig = {
  HIGH: "bg-error text-on-error",
  MEDIUM: "bg-tertiary text-on-tertiary",
  LOW: "bg-secondary text-on-secondary",
};

const bgConfig = {
  HIGH: "bg-error/10 border-error/50 text-error",
  MEDIUM: "bg-tertiary/10 border-tertiary/50 text-tertiary",
  LOW: "bg-secondary-fixed-dim/20 border-secondary/50 text-secondary-fixed-variant",
};

export default function UserStoryCard({
  id,
  title,
  priority,
  description,
  storyPoints,
  assignee,
  tags = [],
  variant = "sprint", // "sprint" or "backlog"
  onAssign,
  onAssignId,
  onEdit,
  onDelete,
  onMove,
  userRole,
  moveIcon = "arrow_upward",
  moveTitle = "Đưa vào Sprint",
  isSelected = false,
  onToggleSelect,
  onAddTask,
  comments = [],
  dragProps = {},
  members = []
}) {
  const isSprint = variant === "sprint";
  const isManagement = userRole === "PO" || userRole === "SM";
  const [showDetails, setShowDetails] = useState(false);

  const tagList = Array.isArray(tags) 
    ? tags 
    : (typeof tags === 'string' ? JSON.parse(tags || '[]') : []);

  if (!isSprint) {
    // Siêu gọn cho Backlog (Dạng Row bảng - Đã tối ưu cho Mobile)
    return (
      <div className="flex flex-col">
        <div 
          className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3 md:py-2 border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-high transition-colors group cursor-pointer text-sm ${
            isSelected ? "bg-primary/5" : "bg-transparent"
          }`}
          onClick={() => setShowDetails(!showDetails)}
        >
          {/* --- Moble Top / Desktop Left Side --- */}
          <div className="flex items-center gap-3 flex-1 overflow-hidden">
            {/* Checkbox */}
            {onToggleSelect && (
              <input 
                type="checkbox"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); onToggleSelect(id); }}
                className="w-4 h-4 cursor-pointer accent-primary shrink-0"
              />
            )}

            {/* ID - Ẩn trên mobile rất nhỏ hoặc rút gọn - Dùng làm DRAG HANDLE */}
            <span 
              {...dragProps}
              className="text-[10px] md:text-[11px] font-mono font-bold bg-surface-container-high px-1.5 md:px-2 py-0.5 rounded text-on-surface-variant uppercase shrink-0 tracking-widest cursor-grab active:cursor-grabbing hover:bg-primary/20 hover:text-primary transition-colors touch-none"
            >
              {id?.slice(-5) || "NEW"}
            </span>

            {/* Priority Badge - Hiển thị tốt trên cả mobile/desktop */}
            <span className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded text-center w-14 md:w-16 shrink-0 uppercase tracking-widest ${priorityConfig[priority] || priorityConfig.MEDIUM}`}>
              {priority}
            </span>

            {/* Title */}
            <div className="flex-1 font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
              {title}
            </div>

            {/* Icon Expand trên mobile */}
            <span className={`material-symbols-outlined text-on-surface-variant transition-transform md:hidden ${showDetails ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </div>

          {/* --- Mobile Bottom / Desktop Right Side --- */}
          <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0 pl-7 md:pl-0">
            {/* Tags & Story Points Group */}
            <div className="flex items-center gap-3">
              {/* Tags - Giới hạn tags trên mobile */}
              <div className="flex gap-1 shrink-0">
                {tagList.slice(0, 1).map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded font-medium">
                    #{tag}
                  </span>
                ))}
                {tagList.length > 1 && <span className="text-[10px] px-1 text-on-surface-variant">+{tagList.length - 1}</span>}
              </div>

              {/* Story Points */}
              <div className="flex items-center gap-1 text-primary font-bold text-xs md:text-sm min-w-[30px] justify-end" title="Story Points">
                <span className="material-symbols-outlined text-base">star</span>
                <span>{storyPoints || 0}</span>
              </div>
            </div>

            {/* Right Side Icons (Comments + Actions + Avatar) */}
            <div className="flex items-center gap-2">
              {/* Comments */}
              {comments.length > 0 && (
                <div 
                  className="flex items-center gap-1 text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/20 hover:bg-primary/10 transition-colors"
                  title={`${comments.length} bình luận`}
                  onClick={(e) => { e.stopPropagation(); onEdit?.({ id, title, description, priority, storyPoints, assignee, tags, comments }); }}
                >
                  <span className="material-symbols-outlined text-[14px]">forum</span>
                  <span className="text-[10px] font-bold">{comments.length}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {isManagement && (
                  <>
                    {onEdit && (
                      <button onClick={(e) => { e.stopPropagation(); onEdit({ id, title, description, priority, storyPoints, assignee, tags }); }} className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-highest text-on-surface-variant transition-all">
                        <span className="material-symbols-outlined text-[18px] md:text-[16px]">edit</span>
                      </button>
                    )}
                    {onMove && (
                      <button onClick={(e) => { e.stopPropagation(); onMove(id); }} className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-all" title={moveTitle}>
                        <span className="material-symbols-outlined text-[20px] md:text-[18px]">{moveIcon}</span>
                      </button>
                    )}
                  </>
                )}
                {onAddTask && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAddTask(id, title); }} 
                    className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all border border-primary/20" 
                    title="Tạo Task mới"
                  >
                    <span className="material-symbols-outlined text-[18px] md:text-[16px]">add_task</span>
                  </button>
                )}
              </div>

              {/* Assignee Avatar */}
              <div className="shrink-0 w-7 flex justify-center relative" onClick={(e) => e.stopPropagation()}>
                {assignee?.fullName ? (
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shadow-sm" title={assignee.fullName}>
                    {assignee.avatar ? (
                      <img 
                        src={getAvatarUrl(assignee.avatar)} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      assignee.fullName.charAt(0).toUpperCase()
                    )}
                  </div>
                ) : isManagement ? (
                  <div 
                    className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors text-outline border border-dashed border-outline-variant/30"
                    title="Gán thành viên"
                  >
                    <span className="material-symbols-outlined text-[12px]">person_add</span>
                  </div>
                ) : null}

                {isManagement && members && members.length > 0 && (
                  <select
                    value={assignee?.id || 'unassigned'}
                    onChange={(e) => {
                      const val = e.target.value === 'unassigned' ? null : e.target.value;
                      onAssignId?.(id, val);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    title="Đổi người phụ trách"
                  >
                    <option value="unassigned">Chưa gán</option>
                    {members.map(m => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.fullName || m.user.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown Chi tiết */}
        {showDetails && (
          <div className="text-sm bg-surface-container-lowest p-4 md:p-3 border-b border-outline-variant/10 shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="text-on-surface-variant ml-0 md:ml-8 flex-1">{description || "Không có mô tả chi tiết."}</p>
              
              {/* Nút Delete chỉ hiển thị trong chi tiết trên mobile để đỡ chật */}
              {isManagement && onDelete && (
                <div className="flex md:hidden justify-end">
                   <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(id); }} 
                    className="px-4 py-2 bg-error/10 text-error rounded-xl flex items-center gap-2 font-bold text-xs"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span> Xóa User Story
                  </button>
                </div>
              )}
              {/* Nút delete Desktop vẫn giữ như cũ hoặc dời vào đây */}
              {isManagement && onDelete && (
                 <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(id); }} 
                  className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-error-container text-error transition-all" 
                  title="Xóa"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Chế độ thẻ (Cards dành cho Sprint Board)
  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3 group transition-all border border-transparent cursor-grab active:cursor-grabbing bg-surface-container-lowest hover:shadow-lg hover:border-outline-variant/20"
    >
      {/* Header: ID + Title + Move Button */}
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <input 
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(id);
            }}
            className="mt-1 w-4 h-4 cursor-pointer accent-primary shrink-0"
          />
        )}

        {isManagement && onMove && (
          <button 
            onClick={(e) => { e.stopPropagation(); onMove(id); }}
            className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-all opacity-0 group-hover:opacity-100 mt-0.5"
            title={moveTitle}
          >
            <span className="material-symbols-outlined text-lg font-black">{moveIcon}</span>
          </button>
        )}

        <span 
          {...dragProps}
          className="material-symbols-outlined text-outline-variant hover:text-primary transition-colors mt-0.5 cursor-grab active:cursor-grabbing touch-none"
        >
          drag_indicator
        </span>

        <span className="text-[10px] font-black text-on-surface-variant font-mono w-16 truncate bg-surface-container px-2 py-0.5 rounded uppercase tracking-tighter mt-0.5" title={id}>
          {id?.slice(-6) || "NEW"}
        </span>

        <p className="flex-1 font-bold text-on-surface text-sm leading-tight mt-0.5">
          {title}
        </p>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
          {isManagement && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit?.({ id, title, description, priority, storyPoints, assignee, tags }); }}
                className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-all"
                title="Sửa Story"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
                className="p-1.5 hover:bg-error/10 rounded-lg text-error transition-all"
                title="Xóa Story"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </>
          )}
          {onAddTask && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAddTask(id, title); }}
              className="p-1.5 bg-primary/10 hover:bg-primary rounded-lg text-primary hover:text-on-primary transition-all border border-primary/20"
              title="Tạo Task mới"
            >
              <span className="material-symbols-outlined text-sm font-bold">add_task</span>
            </button>
          )}
        </div>
      </div>

      {description && (
        <p className="text-xs text-on-surface-variant/70 leading-relaxed line-clamp-2 pl-1 border-l-2 border-outline-variant/20">
          {description}
        </p>
      )}

      {tagList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagList.map((tag, index) => (
            <span
              key={index}
              className="inline-block px-2.5 py-0.5 text-[10px] font-medium bg-surface-container-high text-on-surface-variant rounded-md border border-outline-variant/40"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          <div
            className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border ${priorityConfig[priority] || priorityConfig.MEDIUM}`}
          >
            {priority}
          </div>

          <div
            className={`px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 ${
              storyPoints && storyPoints > 0
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-surface-container text-on-surface-variant"
            }`}
            title="Story Points"
          >
            <span className="material-symbols-outlined text-base">star</span>
            {storyPoints || 0}
          </div>

          {/* US-045: Comments */}
          {comments.length > 0 && (
            <div 
              className="flex items-center gap-1 text-primary bg-primary/5 px-3 py-1 rounded-lg border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
              title={`${comments.length} bình luận`}
              onClick={(e) => { e.stopPropagation(); onEdit?.({ id, title, description, priority, storyPoints, assignee, tags, comments }); }}
            >
              <span className="material-symbols-outlined text-base">forum</span>
              <span className="text-sm font-bold">{comments.length}</span>
            </div>
          )}
        </div>

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          {assignee?.fullName ? (
            <div 
              className="w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center text-on-primary font-bold text-sm shadow-sm"
              title={assignee.fullName}
            >
              {assignee.avatar ? (
                <img 
                  src={getAvatarUrl(assignee.avatar)} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                assignee.fullName.charAt(0).toUpperCase()
              )}
            </div>
          ) : isManagement ? (
            <div 
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors text-outline border border-dashed border-outline-variant/30"
              title="Gán thành viên"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-outline opacity-50 border border-outline-variant/10">
              <span className="material-symbols-outlined text-sm">person</span>
            </div>
          )}

          {isManagement && members && members.length > 0 && (
            <select
              value={assignee?.id || 'unassigned'}
              onChange={(e) => {
                const val = e.target.value === 'unassigned' ? null : e.target.value;
                onAssignId?.(id, val);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              title="Đổi người phụ trách"
            >
              <option value="unassigned">Chưa gán</option>
              {members.map(m => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.fullName || m.user.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}