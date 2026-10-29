//frontend/src/components/KanbanCard.jsx
const priorityConfig = {
  HIGH: "bg-error-container text-on-error-container",
  MEDIUM: "bg-tertiary-container text-on-tertiary-container",
  LOW: "bg-secondary-fixed-dim text-on-secondary-fixed-variant",
};

/**
 * @param {Object}   props
 * @param {string}   props.id          - "US-001"
 * @param {string}   props.title
 * @param {"HIGH"|"MEDIUM"|"LOW"} props.priority
 * @param {number}   props.attachments
 * @param {string[]} [props.avatars]   - array of avatar URLs
 * @param {number}   [props.progress]  - 0-100, show progress bar if set
 * @param {boolean}  [props.done]      - done column styling
 */
export default function KanbanCard({
  id,
  title,
  priority,
  attachments,
  avatars = [],
  progress,
  done = false,
  status,
  onStatusUpdate,
  onAssign,
  onEdit,
  onDelete,
  userRole
}) {
  const isManagement = userRole === "PO" || userRole === "SM";
  return (
    <div
      className={`group bg-surface-container-lowest p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
        done ? "border-l-4 border-emerald-500/20 opacity-80" : ""
      } ${!done && priority === "HIGH" && progress !== undefined ? "ring-1 ring-primary/10" : ""}`}
    >
      {/* Header row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-black font-mono uppercase tracking-widest ${
              done ? "text-outline line-through" : progress !== undefined ? "text-primary" : "text-outline"
            }`}
          >
            {id?.slice(-6) || "STORY"}
          </span>

          {/* Edit/Delete Actions for Management */}
          {isManagement && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit?.({ id, title, priority, status }); }}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
                title="Sửa Story"
              >
                <span className="material-symbols-outlined text-xs">edit</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
                className="p-1 hover:bg-error/10 rounded text-error transition-colors"
                title="Xóa Story"
              >
                <span className="material-symbols-outlined text-xs">delete</span>
              </button>
            </div>
          )}
        </div>

        {done ? (
          <span
            className="material-symbols-outlined text-emerald-500 text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        ) : (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${priorityConfig[priority] || priorityConfig.MEDIUM}`}
            style={{ borderColor: "rgba(0,0,0,0.06)" }}
          >
            {priority}
          </span>
        )}
      </div>

      {/* Title */}
      <h4
        className={`font-['Inter'] font-semibold text-sm mb-4 leading-relaxed ${
          done ? "text-on-surface/60" : "text-on-surface"
        }`}
      >
        {title}
      </h4>

      {/* Progress bar (in-progress cards only) */}
      {progress !== undefined && !done && (
        <div className="mb-4">
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] font-bold text-on-surface-variant">PROGRESS</span>
            <span className="text-[9px] font-bold text-primary">{progress}%</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">attachment</span>
          <span className="text-[11px] font-medium">{attachments}</span>
        </div>

        <div className="flex items-center gap-2">
          {avatars.length > 0 && !done && (
            <div className="flex -space-x-2 mr-2">
              {avatars.map((name, i) => (
                <div key={i} title={name} className="w-6 h-6 rounded-full ring-2 ring-white bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                  {name.charAt(0)}
                </div>
              ))}
            </div>
          )}
          
          {avatars.length === 0 && !done && isManagement && (
            <div onClick={(e) => { e.stopPropagation(); onAssign?.(id); }} className="w-6 h-6 mr-2 rounded-full bg-surface-container flex items-center justify-center cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors text-outline" title="Gán thành viên">
              <span className="material-symbols-outlined text-[13px]">person_add</span>
            </div>
          )}
          
          {done ? (
            <div className="flex gap-3 items-center">
              <div className="text-[10px] font-bold text-emerald-600/70">COMPLETED</div>
              {isManagement && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onStatusUpdate("TODO"); }} 
                  className="text-[10px] font-bold px-2 py-1 bg-surface rounded hover:bg-surface-dim hover:text-primary transition-colors text-outline"
                >
                  REOPEN
                </button>
              )}
            </div>
          ) : status === 'TODO' ? (
            isManagement ? (
              <button 
                onClick={(e) => { e.stopPropagation(); onStatusUpdate("IN_PROGRESS"); }} 
                className="text-[10px] font-bold px-3 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                START
              </button>
            ) : (
              <div className="text-[10px] font-bold text-outline">TO DO</div>
            )
          ) : (
            isManagement ? (
              <button 
                onClick={(e) => { e.stopPropagation(); onStatusUpdate("DONE"); }} 
                className="text-[10px] font-bold px-3 py-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
              >
                COMPLETE
              </button>
            ) : (
              <div className="text-[10px] font-bold text-primary">IN PROGRESS</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
