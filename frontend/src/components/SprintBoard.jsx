// frontend/src/components/SprintBoard.jsx
import React from 'react';
import KanbanColumn from './KanbanColumn';

export default function SprintBoard({ sprint, stories = [], members = [], onUpdateStory, onEditStory, onUpdateTask, onAssignTask, onDeleteTask, onAddTask, userRole, currentUser }) {
  // STORIES ARE THE SWIMLANES
  // TASKS ARE THE ITEMS IN THE COLUMNS

  return (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-primary">
        <span className="material-symbols-outlined">rocket_launch</span>
        {sprint.name}
        <span className="text-sm font-normal text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
          {stories.length} User Stories
        </span>
      </h3>

      {/* Header for Columns */}
      <div className="hidden md:grid grid-cols-[300px_1fr_1fr_1fr] gap-4 mb-2 px-4 sticky top-0 bg-surface z-10 py-2 border-b border-outline-variant/30">
        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">User Story</div>
        <div className="text-xs font-bold text-primary uppercase tracking-wider text-center">To Do</div>
        <div className="text-xs font-bold text-tertiary uppercase tracking-wider text-center">In Progress</div>
        <div className="text-xs font-bold text-success uppercase tracking-wider text-center">Done</div>
      </div>

      <div className="space-y-6">
        {stories.map(story => (
          <div key={story.id} className="grid grid-cols-1 md:grid-cols-[300px_1fr_1fr_1fr] gap-4 bg-surface-container-lowest/50 rounded-3xl p-4 border border-outline-variant/10 hover:border-primary/20 transition-all">
            
            {/* Story Swimlane Side */}
            <div className="pr-4 md:border-r border-outline-variant/10 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">
                  {story.id?.slice(-5)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  story.priority === 'HIGH' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                }`}>
                  {story.priority}
                </span>
                {story.comments?.length > 0 && (
                  <button 
                    onClick={() => onEditStory && onEditStory(story)}
                    className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded hover:bg-primary/10 transition-colors"
                    title="Xem thảo luận"
                  >
                    <span className="material-symbols-outlined text-[12px]">forum</span>
                    {story.comments.length}
                  </button>
                )}
              </div>
              
              <div 
                className="cursor-pointer group/story"
                onClick={() => onEditStory && onEditStory(story)}
              >
                <h4 className="font-bold text-sm text-on-surface leading-tight mb-1 group-hover/story:text-primary transition-colors">
                  {story.title}
                </h4>
                <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed opacity-70">
                  {story.description}
                </p>
              </div>
              
              <button 
                onClick={() => onAddTask && onAddTask(story.id, story.title)}
                className="flex items-center gap-2 text-[10px] font-bold text-primary hover:bg-primary/10 w-fit px-3 py-1.5 rounded-lg border border-primary/20 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add_task</span>
                THÊM TASK NHANH
              </button>
            </div>

            {/* Task Columns (Cells in the Swimlane) */}
            <KanbanColumn
              columnId={`taskcolumn-${story.id}-TODO`}
              status="TODO"
              items={(story.tasks || []).filter(t => t.status === 'TODO')}
              itemType="task"
              members={members}
              onUpdateItem={onUpdateTask}
              onAssignTask={onAssignTask}
              onDeleteTask={onDeleteTask}
              userRole={userRole}
              currentUser={currentUser}
            />
            <KanbanColumn
              columnId={`taskcolumn-${story.id}-IN_PROGRESS`}
              status="IN_PROGRESS"
              items={(story.tasks || []).filter(t => t.status === 'IN_PROGRESS')}
              itemType="task"
              members={members}
              onUpdateItem={onUpdateTask}
              onAssignTask={onAssignTask}
              onDeleteTask={onDeleteTask}
              userRole={userRole}
              currentUser={currentUser}
            />
            <KanbanColumn
              columnId={`taskcolumn-${story.id}-DONE`}
              status="DONE"
              items={(story.tasks || []).filter(t => t.status === 'DONE')}
              itemType="task"
              members={members}
              onUpdateItem={onUpdateTask}
              onAssignTask={onAssignTask}
              onDeleteTask={onDeleteTask}
              userRole={userRole}
              currentUser={currentUser}
            />
          </div>
        ))}

        {stories.length === 0 && (
          <div className="p-20 text-center border-2 border-dashed border-outline-variant/20 rounded-3xl text-on-surface-variant/50 italic bg-surface-container-low/30">
            Chưa có User Story nào trong Sprint này.
          </div>
        )}
      </div>
    </div>
  );
}