import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import StoryContent from "../components/StoryContent";
import StoryMetaSidebar from "../components/StoryMetaSidebar";
import { getUserStory, updateUserStory } from "../services/api"; // Thêm updateUserStory

export default function UserStoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [story, setStory] = useState(null);

  useEffect(() => {
    if (id) {
      getUserStory(id).then(res => setStory(res.data)).catch(() => navigate('/dashboard'));
    }
  }, [id, navigate]);

  const handleClose = () => navigate(-1);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await updateUserStory(id, { status: newStatus });
      setStory(res.data.story || res.data); // Backend có thể trả về { story: ... } hoặc trực tiếp story
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
      alert(err.response?.data?.error || "Không thể cập nhật trạng thái");
    }
  };

  if (!story) return null;

  return (
    <div className="flex overflow-hidden h-screen bg-surface font-['Inter'] text-on-surface antialiased">
      {/* Sidebar */}
      <Sidebar activePage="Dashboard" />

      {/* Blurred board background */}
      <main className="ml-64 flex-1 p-8 min-h-screen bg-surface relative">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="font-['Manrope'] font-bold text-3xl tracking-tight text-on-surface">
              Sprint Backlog
            </h2>
            <div className="flex items-center mt-2 gap-4">
              <span className="text-sm font-medium text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
                Sprint 1
              </span>
              <span className="text-xs text-outline">Feb 14 – Feb 28</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors">
              <span className="material-symbols-outlined">timer</span>
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <img
              alt="User"
              className="w-10 h-10 rounded-full border-2 border-surface-container-highest object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDohk8y9ObcWjPpP8YVkeU93LAN5GG5O4MvLIvkjNSFfjX77b_ciAcFxn4CwjDNoTzofoDswJLouaU2AaeCXJsWBvlT8KYXx-caSGWvOPXsyKe2gB0b0PWlJzU5W75RJZ-7BqE6w5qHevV_TTNw0KnSitSS_YfuqK_fWkRRuIqjwGl5ytuiFRYJ7d7DO-doYDzrFr2_nRxxhvnGk_3BNi9KrO7hTvny_HMVQ3XehAXzlwkD-Hq52r3EdSru44XCuEXKjk54MdGZn8Q"
            />
          </div>
        </header>

        {/* Modal backdrop + modal */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-on-surface/20 backdrop-blur-sm">
          <div className="bg-white/80 backdrop-blur-xl w-full max-w-5xl h-full max-h-[850px] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-outline-variant/15">
            <StoryContent story={story} onClose={handleClose} />
            <StoryMetaSidebar
              status={story.status}
              assignee={story.assignee?.fullName || "Unassigned"}
              storyPoints={story.storyPoints || 0}
              priority={story.priority}
              created="Mới tạo"
              updated="Mới nhất"
              sprintProgress={story.status === 'DONE' ? 100 : story.status === 'IN_PROGRESS' ? 50 : 0}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
