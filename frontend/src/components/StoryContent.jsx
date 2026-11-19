import React, { useState } from 'react';
import CommentSection from './CommentSection';
import AttachmentSection from './AttachmentSection';
import ActivityLog from './ActivityLog';
import { useAuth } from '../context/AuthContext';

export default function StoryContent({ story, onClose }) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('comments'); // 'comments' | 'activity'

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 shrink-0 border-b border-outline-variant/10">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
          <span className="material-symbols-outlined text-sm">task_alt</span>
          <span>User Story — {story.id?.slice(-6) || story.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-error-container hover:text-error rounded-full transition-colors text-outline ml-2"
            title="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
        {/* Title & Description */}
        <section className="pt-4">
          <h2 className="font-['Manrope'] font-extrabold text-2xl md:text-3xl text-on-surface leading-tight mb-4">
            {story.title}
          </h2>
          <div className="text-on-surface-variant font-['Inter'] leading-relaxed space-y-4 text-sm bg-surface-container-low/40 p-4 rounded-2xl border border-outline-variant/10">
            <p className="whitespace-pre-wrap">
              {story.description || "Không có mô tả chi tiết."}
            </p>
          </div>
        </section>

        {/* Attachments */}
        <section>
          <AttachmentSection entityId={story.id} entityType="userStory" />
        </section>

        {/* Tab Switcher: Comments vs Activity Log */}
        <section className="pt-2">
          <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-3 mb-4">
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'comments'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-sm">forum</span>
              <span>Thảo luận & Bình luận</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'activity'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-sm">manage_history</span>
              <span>Lịch sử thay đổi (Activity Log)</span>
            </button>
          </div>

          {activeTab === 'comments' ? (
            <CommentSection 
              entityId={story.id} 
              entityType="story" 
              projectId={story.projectId}
              currentUser={currentUser}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <ActivityLog entityType="USER_STORY" entityId={story.id} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
