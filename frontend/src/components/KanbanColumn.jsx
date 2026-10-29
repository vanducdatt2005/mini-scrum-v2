// frontend/src/components/KanbanColumn.jsx
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableUserStoryCard } from './SortableUserStoryCard';
import { TaskCard } from './TaskCard';

export default function KanbanColumn({
  title,
  status,
  items = [],
  sprintId,
  onUpdateItem,
  projectId,
  itemType = 'story', // 'story' or 'task'
  columnId,           // Optional custom ID for swimlanes
  onAssign,
  onAssignId,
  onEdit,
  onDelete,
  userRole = 'MEMBER',
  members = [],
  onAssignTask,
  onDeleteTask,
  currentUser,        // ← THÊM DÒNG NÀY (bắt buộc cho CommentSection)
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId || `column-${status}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-surface-container-low rounded-2xl p-4 min-h-[500px] border border-outline-variant/30 flex flex-col transition-colors
        ${isOver ? 'ring-2 ring-primary/50 bg-surface-container' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h4 className="font-semibold text-on-surface">{title}</h4>
        <span className="text-xs bg-surface px-3 py-1 rounded-full text-on-surface-variant font-medium">
          {items.length}
        </span>
      </div>

      {/* Vùng sortable */}
      <SortableContext
        items={items.map(item => itemType === 'task' ? `task-${item.id}` : item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 flex-1">
          {items.map((item) => (
            itemType === 'story' ? (
              <SortableUserStoryCard
                key={item.id}
                id={item.id}
                {...item}
                variant="sprint"
                userRole={userRole}
                onAssign={onAssign}
                onAssignId={onAssignId}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onUpdateItem}
                members={members}
              />
            ) : (
              <TaskCard
                key={item.id}
                {...item}
                id={`task-${item.id}`}
                members={members}
                userRole={userRole}
                projectId={projectId}
                currentUser={currentUser}          // ← THÊM DÒNG NÀY (quan trọng nhất)
                onUpdate={(data) => onUpdateItem(item.id, data)}
                onDelete={() => onDeleteTask && onDeleteTask(item.id)}
                onAssign={() => onAssignTask && onAssignTask(item.id)}
              />
            )
          ))}

          {items.length === 0 && (
            <div className="h-16 flex items-center justify-center border-2 border-dashed border-outline-variant/20 rounded-xl text-on-surface-variant/50 text-[10px] italic">
              Trống
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}