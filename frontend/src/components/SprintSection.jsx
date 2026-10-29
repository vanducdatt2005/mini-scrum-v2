import { useDroppable } from '@dnd-kit/core';
import UserStoryCard from "./UserStoryCard";
import { toast } from 'react-hot-toast';

export default function SprintSection({ sprint, stories = [], onMoveToBacklog, onAssign, onAssignId, onEdit, onDelete, onStatusChange, onStartClick, onCompleteClick, onCeremonyClick, userRole, selectedStories = [], onToggleSelect, onSelectAll, onAddTask, members = [] }) {
  const isManagement = userRole === "PO" || userRole === "SM";
  const { setNodeRef, isOver } = useDroppable({
    id: `sprint-${sprint.id}`,
  });

  const progress = stories.length > 0
    ? Math.round((stories.filter(s => s.status === 'DONE').length / stories.length) * 100)
    : 0;

  const handleStartSprint = () => {
    if (stories.length === 0) {
      toast.error('Không thể bắt đầu Sprint khi chưa có User Story/Task nào!');
      return;
    }
    if (onStartClick) {
      onStartClick(sprint, stories);
    } else {
      if (window.confirm(`Bạn có chắc muốn bắt đầu ${sprint.name}?`)) {
        onStatusChange(sprint.id, 'ACTIVE');
      }
    }
  };

  const handleCompleteSprint = () => {
    if (onCompleteClick) {
      onCompleteClick(sprint, stories);
    } else {
      if (window.confirm(`Bạn có chắc muốn kết thúc ${sprint.name}?`)) {
        onStatusChange(sprint.id, 'COMPLETED');
      }
    }
  };

  return (
    <section className="mb-8 last:mb-0 transition-all duration-300">
      {/* Section header */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Row 1: Checkbox, Sprint name, Status, Dates */}
        <div className="flex items-center gap-3 flex-wrap">
          {onSelectAll && (
            <input
              type="checkbox"
              className="w-5 h-5 cursor-pointer accent-primary shrink-0"
              checked={stories.length > 0 && stories.every(s => selectedStories.includes(s.id))}
              onChange={(e) => onSelectAll(e.target.checked, stories)}
              title="Chọn tất cả trong Sprint"
            />
          )}
          <h3 className="font-['Manrope'] font-bold text-lg text-on-surface shrink-0">{sprint.name}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest shrink-0 ${sprint.status === 'ACTIVE'
              ? 'bg-primary-container text-on-primary-container shadow-sm shadow-primary/20'
              : sprint.status === 'COMPLETED'
                ? 'bg-surface-variant text-on-surface-variant opacity-60'
                : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
            {sprint.status}
          </span>
          {sprint.startDate && (
            <span className="text-xs text-on-surface-variant opacity-60 whitespace-nowrap flex-shrink-0">
              {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Row 2: Goal text, Progress, Buttons - Responsive layout */}
        <div className="flex items-center gap-4 flex-wrap justify-between">
          {/* Goal text - với ellipsis khi text dài */}
          {sprint.goal && (
            <p className="text-xs text-on-surface-variant italic px-3 py-1 border-l-2 border-primary/20 min-w-[150px] flex-1 max-w-md line-clamp-2">
              Mục tiêu: {(() => {
                try {
                  const parsed = JSON.parse(sprint.goal);
                  if (parsed && typeof parsed === 'object' && 'text' in parsed) {
                    return parsed.text || "Chưa có mục tiêu";
                  }
                  return sprint.goal;
                } catch (e) {
                  return sprint.goal;
                }
              })()}
            </p>
          )}

          {/* Progress bar - flex shrink để không tràn */}
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              Progress
            </span>
            <div className="w-32 h-1.5 bg-surface-container-highest rounded-full mt-1 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ${sprint.status === 'COMPLETED' ? 'bg-outline' : 'bg-gradient-to-r from-primary to-primary-container'
                  }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Buttons - Responsive với flex wrap */}
          <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
            {/* Nút Start Sprint: Chỉ dành cho PLANNED và Quản lý */}
            {sprint.status === 'PLANNED' && isManagement && (
              <button
                onClick={handleStartSprint}
                className="px-4 py-1.5 bg-primary text-on-primary text-xs font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all shadow-md shadow-primary/20 flex items-center gap-1 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                Start Sprint
              </button>
            )}

            {/* Nút Sprint Ceremony và Complete Sprint: Dành cho ACTIVE */}
            {sprint.status === 'ACTIVE' && (
              <>
                <button
                  onClick={() => onCeremonyClick && onCeremonyClick(sprint)}
                  className="text-primary text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity border border-primary/20 px-3 py-1.5 rounded-full whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">celebration</span>
                  <span className="hidden sm:inline">Sprint Ceremony</span>
                  <span className="sm:hidden">Ceremony</span>
                </button>

                {isManagement && (
                  <button
                    onClick={handleCompleteSprint}
                    className="text-primary text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity border border-primary/20 px-3 py-1.5 rounded-full whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm">done_all</span>
                    <span className="hidden sm:inline">Complete Sprint</span>
                    <span className="sm:hidden">Complete</span>
                  </button>
                )}
              </>
            )}

            {/* Nút Xem Ceremony: Khi đã kết thúc */}
            {sprint.status === 'COMPLETED' && (
              <button
                onClick={() => onCeremonyClick && onCeremonyClick(sprint)}
                className="text-on-surface-variant text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity border border-outline-variant/20 px-3 py-1.5 rounded-full opacity-70 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">celebration</span>
                <span className="hidden sm:inline">Xem Ceremony</span>
                <span className="sm:hidden">Ceremony</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Story cards with Droppable Area */}
      <div
        ref={setNodeRef}
        className={`space-y-3 p-4 rounded-3xl min-h-[100px] border-2 transition-all duration-300 ${isOver
            ? 'bg-primary/5 border-primary border-dashed shadow-inner scale-[1.01]'
            : 'bg-surface-container-low border-outline-variant/10'
          }`}
      >
        {stories.length > 0 ? (
          stories.map((story) => (
            <UserStoryCard
              key={story.id}
              {...story}
              variant="sprint"
              onMove={onMoveToBacklog}
              onAssign={onAssign}
              onAssignId={onAssignId}
              onEdit={onEdit}
              onDelete={onDelete}
              userRole={userRole}
              moveIcon="arrow_downward"
              moveTitle="Đẩy về Backlog"
              isSelected={selectedStories.includes(story.id)}
              onToggleSelect={onToggleSelect}
              onAddTask={onAddTask}
              members={members}
            />
          ))
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-on-surface-variant/40 border-2 border-dashed border-outline-variant/10 rounded-2xl italic text-xs">
            <span className="material-symbols-outlined text-3xl mb-1 opacity-20">inventory_2</span>
            {isOver ? "Thả tại đây để thêm vào Sprint" : "Chưa có Story nào trong Sprint này."}
          </div>
        )}
      </div>
    </section>
  );
}

