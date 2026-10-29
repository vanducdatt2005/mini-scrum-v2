import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import UserStoryCard from './UserStoryCard';

export function SortableUserStoryCard(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: props.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'z-50 scale-[1.03]' : ''}`}
    >
      <UserStoryCard 
        {...props}
        dragProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        isSelected={props.isSelected}
        onToggleSelect={props.onToggleSelect}
      />
    </div>
  );
}