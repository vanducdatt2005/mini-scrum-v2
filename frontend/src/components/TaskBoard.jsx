// frontend/src/components/TaskBoard.jsx
import React, { useState, useMemo } from 'react';
import SprintBoard from './SprintBoard';

export default function TaskBoard({ 
  sprints = [], 
  stories = [], 
  members = [], 
  onUpdateStory, 
  onEditStory, 
  onUpdateTask, 
  onAssignTask, 
  onDeleteTask, 
  onAddTask, 
  userRole,
  currentUser   // ← THÊM DÒNG NÀY
}) {
  const [selectedSprintId, setSelectedSprintId] = useState(null);

  const defaultSprint = sprints.find(s => s.status === 'ACTIVE') || sprints[0];
  const currentSprintId = selectedSprintId || defaultSprint?.id;
  const currentSprint = sprints.find(s => s.id === currentSprintId);

  const sprintStories = useMemo(() => 
    stories.filter(s => s.sprintId === currentSprintId),
    [stories, currentSprintId]
  );

  if (!currentSprint) {
    return (
      <div className="text-center py-20 text-on-surface-variant bg-surface-container-low rounded-3xl">
        <p className="text-xl mb-2">Chưa có Sprint nào</p>
        <p>Hãy tạo ít nhất một Sprint trong phần Sprint Planning bên dưới.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sprint Selector */}
      {sprints.length > 0 && (
        <div className="flex gap-2 border-b border-outline-variant pb-3 overflow-x-auto">
          {sprints.map(sprint => {
            const count = stories.filter(s => s.sprintId === sprint.id).length;
            return (
              <button
                key={sprint.id}
                onClick={() => setSelectedSprintId(sprint.id)}
                className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2
                  ${currentSprintId === sprint.id 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'hover:bg-surface-container-high text-on-surface'}`}
              >
                {sprint.name}
                <span className="text-xs opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Kanban Board */}
      <SprintBoard
        sprint={currentSprint}
        stories={sprintStories}
        members={members}
        onUpdateStory={onUpdateStory}
        onEditStory={onEditStory}
        onUpdateTask={onUpdateTask}
        onAssignTask={onAssignTask}
        onDeleteTask={onDeleteTask}
        onAddTask={onAddTask}
        userRole={userRole}
        currentUser={currentUser}     // ← THÊM DÒNG NÀY
      />
    </div>
  );
}