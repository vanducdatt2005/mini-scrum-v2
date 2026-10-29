//frontend/src/components/TaskCard.jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useRef } from 'react';
import CommentSection from './CommentSection';
import AttachmentSection from './AttachmentSection';

export function TaskCard({ 
  id, 
  title, 
  description, 
  status, 
  assignee, 
  assigneeId, 
  dueDate,
  members = [], 
  userRole = 'MEMBER',
  currentUser,
  onUpdate, 
  onDelete, 
  onAssign,
  projectId
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const [showComments, setShowComments] = useState(false);
  const dateInputRef = useRef(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cleanId = id.replace('task-', '');

  const handleAssigneeChange = (e) => {
    const newAssigneeId = e.target.value === 'unassigned' ? null : e.target.value;
    onUpdate({ assigneeId: newAssigneeId });
  };

  const handleDateChange = (e) => {
    onUpdate({ dueDate: e.target.value || null });
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date(new Date().setHours(0,0,0,0)) && status !== 'DONE';
  const canEditDeadline = true; // Cho phép tất cả thành viên đổi hạn chót (khớp với quyền tạo)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all group touch-none
        ${isDragging ? 'z-50 ring-2 ring-primary/30' : ''}`}
    >
      {/* Drag Handle */}
      <div 
        {...listeners}
        className="flex justify-center mb-1 cursor-grab active:cursor-grabbing text-outline-variant/30 hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[20px] leading-none">drag_indicator</span>
      </div>

      <div className="flex justify-between items-start gap-2 mb-1">
        <h5 className="text-xs font-bold text-on-surface line-clamp-2 leading-tight">
          {title}
        </h5>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(cleanId); }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 text-error rounded transition-opacity"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        )}
      </div>
      
      {description && (
        <p className="text-[10px] text-on-surface-variant/70 line-clamp-2 leading-normal">
          {description}
        </p>
      )}

      {/* Deadline display */}
      <div className="mt-2 flex items-center gap-1.5 px-0.5 min-h-[28px]">
        {(dueDate || canEditDeadline) && (
          <div 
            onClick={() => {
              if (canEditDeadline && dateInputRef.current) {
                try {
                  if (dateInputRef.current.showPicker) {
                    dateInputRef.current.showPicker();
                  } else {
                    dateInputRef.current.focus();
                    dateInputRef.current.click();
                  }
                } catch (err) {
                  // Fallback for browsers that don't support showPicker or have security restrictions
                  dateInputRef.current.focus();
                  dateInputRef.current.click();
                }
              }
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all relative group/deadline
              ${isOverdue 
                ? 'bg-error/10 text-error border-error/20' 
                : dueDate 
                  ? 'bg-primary/5 text-primary border-primary/10' 
                  : 'text-outline-variant border-dashed border-outline-variant/30 opacity-0 group-hover:opacity-100 hover:bg-primary/5 hover:text-primary hover:border-primary/30'
              } cursor-pointer hover:bg-primary/10`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isOverdue ? 'event_busy' : 'calendar_today'}
            </span>
            <span>{dueDate ? new Date(dueDate).toLocaleDateString('vi-VN') : 'Đặt hạn chót'}</span>
            
            {canEditDeadline && (
              <>
                <span className="material-symbols-outlined text-[12px] opacity-40 group-hover/deadline:opacity-100 transition-opacity ml-1">edit</span>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                  value={dueDate ? new Date(dueDate).toISOString().split('T')[0] : ''}
                  onChange={handleDateChange}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between items-center border-t border-outline-variant/10 pt-2">
        <div className="text-[9px] font-bold text-outline-variant uppercase tracking-wider">
           {status}
        </div>
        
        <div 
          className="relative group/assignee"
          onClick={(e) => e.stopPropagation()}
        >
          {assignee ? (
            <div 
              className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shadow-sm border border-primary/20"
              title={assignee.fullName || assignee.email}
            >
              { (assignee.fullName || assignee.email || '?').charAt(0).toUpperCase() }
            </div>
          ) : (
            <div 
              className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-outline border border-dashed border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Gán người phụ trách"
            >
               <span className="material-symbols-outlined text-[12px]">person_add</span>
            </div>
          )}

          {members.length > 0 && (
            <select
              value={assigneeId || 'unassigned'}
              onChange={handleAssigneeChange}
              onPointerDown={(e) => e.stopPropagation()}
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
            {/* ==================== COMMENT SECTION - US-046 ==================== */}
      <div className="mt-4 pt-4 border-t border-outline-variant/10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowComments(!showComments);
          }}
          className="flex w-full items-center justify-center gap-2 py-2 text-xs font-medium text-on-surface-variant hover:text-primary transition-colors rounded-xl hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-base">chat</span>
          {showComments ? 'Ẩn bình luận' : 'Xem bình luận'}
        </button>

       {showComments && (
          <>
            <CommentSection
              entityId={cleanId}
              entityType="task"
              projectId={projectId}
              currentUser={currentUser || { id: "temp-id", fullName: "Test User" }}
            />
            <AttachmentSection entityId={cleanId} entityType="task" />
          </>
        )}
      </div>
    </div>
  );
}
