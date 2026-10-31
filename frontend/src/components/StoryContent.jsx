import React from 'react';
import CommentSection from './CommentSection';
import AttachmentSection from './AttachmentSection';
import { useAuth } from '../context/AuthContext';

export default function StoryContent({ story, onClose }) {
  const { user: currentUser } = useAuth();

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 shrink-0">
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
      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
        {/* Title & Description */}
        <section>
          <h2 className="font-['Manrope'] font-extrabold text-2xl md:text-3xl text-on-surface leading-tight mb-4">
            {story.title}
          </h2>
          <div className="text-on-surface-variant font-['Inter'] leading-relaxed space-y-4 text-sm">
            <p className="whitespace-pre-wrap">
              {story.description || "Không có mô tả chi tiết."}
            </p>
          </div>
        </section>

        {/* Attachments */}
        <section className="pt-2">
          <AttachmentSection entityId={story.id} entityType="userStory" />
        </section>

        {/* Discussion / Realtime Comments */}
        <section className="pt-2">
          <CommentSection 
            entityId={story.id} 
            entityType="story" 
            projectId={story.projectId}
            currentUser={currentUser}
          />
        </section>
      </div>
    </div>
  );
}
