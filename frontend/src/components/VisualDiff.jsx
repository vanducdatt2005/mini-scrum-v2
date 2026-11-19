import React from 'react';
import { computeWordDiff } from '../utils/textDiff';

/**
 * Helper màu sắc Badge cho Status
 */
const getStatusBadgeStyle = (status) => {
  switch (status?.toUpperCase()) {
    case 'DONE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    case 'IN_PROGRESS':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    case 'TODO':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

/**
 * Helper màu sắc Badge cho Priority
 */
const getPriorityBadgeStyle = (priority) => {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
    case 'URGENT':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    case 'LOW':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

export default function VisualDiff({ actionType, changesPayload }) {
  if (!changesPayload) return null;

  // 1. Thay đổi Trạng thái (UPDATED_STATUS - AC3)
  if (actionType === 'UPDATED_STATUS') {
    const oldVal = changesPayload.old_value || 'None';
    const newVal = changesPayload.new_value || 'None';

    return (
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(oldVal)}`}>
          {oldVal}
        </span>
        <span className="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(newVal)}`}>
          {newVal}
        </span>
      </div>
    );
  }

  // 2. Thay đổi Mức độ ưu tiên (UPDATED_PRIORITY - AC3)
  if (actionType === 'UPDATED_PRIORITY') {
    const oldVal = changesPayload.old_value || 'None';
    const newVal = changesPayload.new_value || 'None';

    return (
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getPriorityBadgeStyle(oldVal)}`}>
          {oldVal}
        </span>
        <span className="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getPriorityBadgeStyle(newVal)}`}>
          {newVal}
        </span>
      </div>
    );
  }

  // 3. Thay đổi Người phụ trách (UPDATED_ASSIGNEE - AC3)
  if (actionType === 'UPDATED_ASSIGNEE') {
    const oldVal = changesPayload.old_value || 'Chưa gán';
    const newVal = changesPayload.new_value || 'Chưa gán';

    return (
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          {oldVal}
        </span>
        <span className="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
        <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20 dark:text-primary-light">
          {newVal}
        </span>
      </div>
    );
  }

  // 4. Thay đổi Tiêu đề hoặc Mô tả văn bản dài (UPDATED_TITLE, UPDATED_DESCRIPTION - AC3)
  if (actionType === 'UPDATED_TITLE' || actionType === 'UPDATED_DESCRIPTION') {
    const oldVal = changesPayload.old_value || '';
    const newVal = changesPayload.new_value || '';
    const diffTokens = computeWordDiff(oldVal, newVal);

    return (
      <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono leading-relaxed max-h-56 overflow-y-auto">
        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 mb-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
          <span className="material-symbols-outlined text-xs">difference</span>
          <span>So sánh nội dung ({actionType === 'UPDATED_TITLE' ? 'Tiêu đề' : 'Mô tả'})</span>
        </div>
        <div className="whitespace-pre-wrap break-words">
          {diffTokens.map((token, idx) => {
            if (token.type === 'removed') {
              return (
                <span 
                  key={idx} 
                  className="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 line-through px-1 py-0.5 rounded mx-0.5 border border-red-200 dark:border-red-900"
                >
                  {token.value}
                </span>
              );
            }
            if (token.type === 'added') {
              return (
                <span 
                  key={idx} 
                  className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold px-1 py-0.5 rounded mx-0.5 border border-emerald-200 dark:border-emerald-900"
                >
                  {token.value}
                </span>
              );
            }
            return <span key={idx} className="text-slate-700 dark:text-slate-300">{token.value}</span>;
          })}
        </div>
      </div>
    );
  }

  // 5. Tệp đính kèm (ATTACHMENT_ADDED, ATTACHMENT_REMOVED)
  if (actionType === 'ATTACHMENT_ADDED' || actionType === 'ATTACHMENT_REMOVED') {
    const isAdded = actionType === 'ATTACHMENT_ADDED';
    return (
      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
        <span className={`material-symbols-outlined text-sm ${isAdded ? 'text-primary' : 'text-rose-500'}`}>
          {isAdded ? 'attach_file' : 'delete_forever'}
        </span>
        <span className="font-semibold truncate max-w-xs">{changesPayload.fileName || 'Tệp tin'}</span>
      </div>
    );
  }

  // 6. Bình luận (COMMENT_ADDED, COMMENT_DELETED)
  if (actionType === 'COMMENT_ADDED' || actionType === 'COMMENT_DELETED') {
    const isAdded = actionType === 'COMMENT_ADDED';
    return (
      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 italic">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 not-italic uppercase mb-1">
          <span className="material-symbols-outlined text-xs">{isAdded ? 'add_comment' : 'speaker_notes_off'}</span>
          <span>{isAdded ? 'Nội dung bình luận' : 'Bình luận đã xóa'}</span>
        </div>
        <p className="line-clamp-2">"{changesPayload.content}"</p>
      </div>
    );
  }

  return null;
}

