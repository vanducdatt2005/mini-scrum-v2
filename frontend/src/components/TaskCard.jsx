//frontend/src/components/TaskCard.jsx
import React, { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CommentSection from './CommentSection';
import AttachmentSection from './AttachmentSection';
import ActivityLog from './ActivityLog';
import { useAuth } from '../context/AuthContext';
import { getAvatarUrl } from '../services/api';
import EditTaskModal from './EditTaskModal';

export function TaskCard({ 
  id, 
  title, 
  description, 
  status, 
  assignee, 
  assigneeId, 
  dueDate,
  version = 1,
  members = [], 
  userRole = 'MEMBER',
  currentUser: propCurrentUser,
  onUpdate, 
  onDelete, 
  onAssign,
  projectId
}) {
  const { user: authUser } = useAuth();
  const currentUser = propCurrentUser || authUser || (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const [activeTab, setActiveTab] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const dateInputRef = useRef(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cleanId = id.replace('task-', '');

  const isManagement = userRole === 'PO' || userRole === 'SM';

  const handleAssigneeChange = (e) => {
    if (!isManagement) return;
    const newAssigneeId = e.target.value === 'unassigned' ? null : e.target.value;
    onUpdate({ assigneeId: newAssigneeId, version: version ?? 1 });
  };

  const handleDateChange = (e) => {
    onUpdate({ dueDate: e.target.value || null, version: version ?? 1 });
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
        <h5 
          className="text-xs font-bold text-on-surface line-clamp-2 leading-tight cursor-pointer hover:text-primary transition-colors"
          onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }}
          title="Nhấp để chỉnh sửa task"
        >
          {title}
        </h5>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/10 text-primary rounded transition-opacity"
            title="Chỉnh sửa task"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(cleanId); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 text-error rounded transition-opacity"
              title="Xóa task"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          )}
        </div>
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
              className="w-6 h-6 rounded-full overflow-hidden bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shadow-sm border border-primary/20"
              title={assignee.fullName || assignee.email}
            >
              {assignee.avatar ? (
                <img 
                  src={getAvatarUrl(assignee.avatar)} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                (assignee.fullName || assignee.email || '?').charAt(0).toUpperCase()
              )}
            </div>
          ) : (
            <div 
              className={`w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-outline border border-dashed border-outline-variant/30 ${
                isManagement ? 'hover:bg-primary/10 hover:text-primary cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } transition-colors`}
              title={isManagement ? "Gán người phụ trách" : "Chỉ PO/SM mới có quyền gán Task"}
            >
               <span className="material-symbols-outlined text-[12px]">person_add</span>
            </div>
          )}

          {isManagement && members.length > 0 && (
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

      {/* ==================== COMMENTS & ACTIVITY LOG ==================== */}
      <div className="mt-3 pt-3 border-t border-outline-variant/10">
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(activeTab === 'comments' ? null : 'comments');
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold transition-all rounded-xl border ${
              activeTab === 'comments'
                ? 'bg-primary/10 text-primary border-primary/20 shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            <span>{activeTab === 'comments' ? 'Ẩn' : 'Bình luận'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(activeTab === 'activity' ? null : 'activity');
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold transition-all rounded-xl border ${
              activeTab === 'activity'
                ? 'bg-primary/10 text-primary border-primary/20 shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-sm">manage_history</span>
            <span>{activeTab === 'activity' ? 'Ẩn' : 'Lịch sử'}</span>
          </button>
        </div>

        {activeTab === 'comments' && (
          <div className="animate-in fade-in duration-200 mt-2">
            <CommentSection
              entityId={cleanId}
              entityType="task"
              projectId={projectId}
              currentUser={currentUser}
            />
            <AttachmentSection entityId={cleanId} entityType="task" />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="animate-in fade-in duration-200 mt-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <ActivityLog entityType="TASK" entityId={cleanId} />
          </div>
        )}
      </div>

      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        task={{
          id: cleanId,
          title,
          description,
          status,
          assignee,
          assigneeId,
          dueDate,
          version: version ?? 1
        }}
        members={members}
        onSaveSuccess={(updated) => {
          if (onUpdate) onUpdate(updated);
        }}
      />
    </div>
  );
}
