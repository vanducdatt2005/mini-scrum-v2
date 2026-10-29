import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStoriesByProject } from "../services/api";

const priorityConfig = {
  HIGH: {
    badge: "bg-error-container text-on-error-container border-error/10",
    bar: "bg-primary opacity-20",
  },
  MEDIUM: {
    badge: "bg-tertiary-container text-on-tertiary-container border-tertiary/10",
    bar: "bg-tertiary-container opacity-40",
  },
  LOW: {
    badge: "bg-secondary-fixed-dim text-on-secondary-fixed-variant border-secondary/10",
    bar: "bg-secondary-fixed-dim",
  },
};

export default function MyTasks({ projectId }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    setLoading(true);
    getStoriesByProject(projectId)
      .then((res) => {
        let myTasks = [];
        res.data.forEach((story) => {
          if (story.tasks) {
            story.tasks.forEach((task) => {
              if (task.assigneeId === currentUser.id && task.status !== "DONE") {
                myTasks.push({
                  id: task.id,
                  title: task.title,
                  priority: story.priority || "MEDIUM",
                  dueDate: task.dueDate,
                  avatar: `https://ui-avatars.com/api/?name=${currentUser.fullName}&background=random`
                });
              }
            });
          }
        });
        setTasks(myTasks.slice(0, 5));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi lấy My Tasks:", err);
        setLoading(false);
      });
  }, [projectId]);

  return (
    <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-xl p-8">
      <div className="flex justify-between items-end mb-6">
        <h3 className="font-['Manrope'] font-bold text-lg">My Tasks</h3>
        <button onClick={() => navigate(`/projects/${projectId}/backlog`)} className="text-sm font-semibold text-primary hover:underline transition-all">View all</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32 opacity-50">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-on-surface-variant opacity-60 italic">
          <span className="material-symbols-outlined text-3xl mb-2 opacity-50">task</span>
          <p className="text-sm">Bạn không có công việc nào đang chờ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const cfg = priorityConfig[task.priority] || priorityConfig.MEDIUM;
            return (
              <div
                key={task.id}
                onClick={() => navigate(`/projects/${projectId}/board`)}
                className="group cursor-pointer bg-surface-container-lowest p-5 rounded-xl transition-all hover:bg-white hover:translate-x-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-10 rounded-full ${cfg.bar}`} />
                    <div>
                      <h4 className="font-semibold text-on-surface line-clamp-1">{task.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        {task.dueDate && (
                          <span className="text-xs font-medium text-outline flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {!task.dueDate && (
                          <span className="text-xs font-medium text-outline flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">more_horiz</span>
                            No Due Date
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border-[0.1rem] ${cfg.badge}`}>
                      {task.priority}
                    </span>
                    <img alt="Assignee" className="w-8 h-8 rounded-full object-cover" src={task.avatar} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
