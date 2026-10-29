import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStoriesByProject } from "../services/api";

const timeAgo = (dateString) => {
  if (!dateString) return "Vừa xong";
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " năm trước";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " tháng trước";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " ngày trước";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " giờ trước";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " phút trước";
  return "Vừa xong";
};

export default function RecentActivity({ projectId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getStoriesByProject(projectId)
      .then((res) => {
        let acts = [];
        res.data.forEach((story) => {
          // Thêm story vào lịch sử hoạt động
          acts.push({
            id: `s-${story.id}`,
            name: story.assignee ? story.assignee.fullName : "User",
            action: "đã cập nhật story",
            highlight: story.title,
            time: timeAgo(story.updatedAt || story.createdAt),
            context: story.status,
            icon: "edit_document",
            iconBg: "bg-primary text-white",
            avatar: `https://ui-avatars.com/api/?name=${story.assignee ? story.assignee.fullName : "U"}&background=random`,
            timestamp: new Date(story.updatedAt || story.createdAt).getTime(),
          });

          // Thêm các task của story
          if (story.tasks) {
            story.tasks.forEach((task) => {
              acts.push({
                id: `t-${task.id}`,
                name: task.assignee ? task.assignee.fullName : "User",
                action: "đã cập nhật task",
                highlight: task.title,
                time: timeAgo(task.updatedAt || task.createdAt),
                context: task.status,
                icon: "task",
                iconBg: "bg-secondary-container text-on-secondary-container",
                avatar: `https://ui-avatars.com/api/?name=${task.assignee ? task.assignee.fullName : "U"}&background=random`,
                timestamp: new Date(task.updatedAt || task.createdAt).getTime(),
              });
            });
          }
        });

        // Sắp xếp theo thời gian mới nhất (timestamp giảm dần)
        acts.sort((a, b) => b.timestamp - a.timestamp);
        
        // Lấy 4 hoạt động gần nhất
        setActivities(acts.slice(0, 4));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi lấy Recent Activity:", err);
        setLoading(false);
      });
  }, [projectId]);

  return (
    <div className="col-span-12 bg-surface-container-lowest rounded-xl p-8 overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <h3 className="font-['Manrope'] font-bold text-lg">Hoạt động gần đây</h3>
        <span className="material-symbols-outlined text-outline">history</span>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32 opacity-50">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-on-surface-variant opacity-60 italic">
          <span className="material-symbols-outlined text-3xl mb-2 opacity-50">history_toggle_off</span>
          <p className="text-sm">Chưa có hoạt động nào</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          {activities.map((activity, idx) => (
            <div 
              key={activity.id} 
              className="flex-1 relative cursor-pointer"
              onClick={() => navigate(`/projects/${projectId}/backlog`)}
            >
              <div
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-surface-container-low transition-colors group h-full"
              >
                <div className="relative shrink-0">
                  <img
                    className="w-10 h-10 rounded-full object-cover shadow-sm"
                    src={activity.avatar}
                    alt={activity.name}
                  />
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${activity.iconBg} rounded-full flex items-center justify-center scale-90 shadow-sm border border-white`}>
                    <span
                      className="material-symbols-outlined text-[10px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {activity.icon}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium leading-tight">
                    <span className="font-bold">{activity.name}</span>{" "}
                    <span className="text-on-surface-variant text-xs">{activity.action}</span>{" "}
                    <span className={idx === 0 ? "text-primary font-bold line-clamp-1 mt-0.5" : "font-bold text-on-surface line-clamp-1 mt-0.5"}>
                      {activity.highlight}
                    </span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-outline mt-2">
                    {activity.time} • <span className="text-primary/70">{activity.context}</span>
                  </p>
                </div>
              </div>
              {idx < activities.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-[1px] h-12 bg-outline-variant/30 -translate-y-1/2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
