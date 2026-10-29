export default function FAB({ onClick, icon = "add_task", title = "Add Task" }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50"
      title={title}
    >
      <span className="material-symbols-outlined text-3xl">{icon}</span>
    </button>
  );
}
