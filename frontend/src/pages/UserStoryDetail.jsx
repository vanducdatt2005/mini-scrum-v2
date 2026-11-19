import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import StoryContent from "../components/StoryContent";
import StoryMetaSidebar from "../components/StoryMetaSidebar";
import PokerInviteModal from "../components/PokerInviteModal";
import { getUserStory, updateUserStory, createPokerRoom, getStoryPokerRoom } from "../services/api";
import { toast } from "react-hot-toast";

export default function UserStoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [story, setStory] = useState(null);

  // States cho Planning Poker (US-033)
  const [activePokerRoom, setActivePokerRoom] = useState(null);
  const [isCreatingPoker, setIsCreatingPoker] = useState(false);
  const [isPokerModalOpen, setIsPokerModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      getUserStory(id)
        .then(res => setStory(res.data))
        .catch(() => navigate('/dashboard'));

      // Kiểm tra xem User Story này đã có phòng Poker nào đang mở không
      getStoryPokerRoom(id)
        .then(res => {
          if (res.data?.activeRoom) {
            setActivePokerRoom(res.data.activeRoom);
          }
        })
        .catch(() => {});
    }
  }, [id, navigate]);

  const handleClose = () => navigate(-1);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await updateUserStory(id, { status: newStatus });
      setStory(res.data.story || res.data);
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
      alert(err.response?.data?.error || "Không thể cập nhật trạng thái");
    }
  };

  // Xử lý khi nhấn nút "Mở Poker" (US-033: AC1)
  const handleOpenPoker = async () => {
    if (activePokerRoom) {
      // Nếu phòng đã active, mở modal mời hoặc vào thẳng phòng
      setIsPokerModalOpen(true);
      return;
    }

    setIsCreatingPoker(true);
    try {
      const res = await createPokerRoom(id);
      const room = res.data.room;
      setActivePokerRoom(room);
      setIsPokerModalOpen(true);
      toast.success('Đã mở phòng Planning Poker cho User Story này!');
    } catch (err) {
      console.error("Lỗi mở phòng Poker:", err);
      toast.error(err.response?.data?.error || "Không thể mở phòng Poker. Bạn cần là Scrum Master hoặc PO.");
    } finally {
      setIsCreatingPoker(false);
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
              Chi tiết User Story
            </h2>
            <div className="flex items-center mt-2 gap-4">
              <span className="text-sm font-medium text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
                {story.project?.name || "Dự án"}
              </span>
            </div>
          </div>
        </header>

        {/* Modal backdrop + modal */}
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-8 bg-on-surface/20 backdrop-blur-sm">
          <div className="bg-white/90 dark:bg-surface-container-lowest/90 backdrop-blur-xl w-full max-w-5xl h-full max-h-[850px] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-outline-variant/15">
            <StoryContent story={story} onClose={handleClose} />
            <StoryMetaSidebar
              status={story.status}
              assignee={story.assignee?.fullName || "Chưa gán"}
              storyPoints={story.storyPoints}
              priority={story.priority}
              created={story.createdAt ? new Date(story.createdAt).toLocaleDateString() : "Mới tạo"}
              updated={story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : "Mới nhất"}
              sprintProgress={story.status === 'DONE' ? 100 : story.status === 'IN_PROGRESS' ? 50 : 0}
              onStatusChange={handleStatusChange}
              onOpenPoker={handleOpenPoker}
              isCreatingPoker={isCreatingPoker}
              activePokerRoom={activePokerRoom}
            />
          </div>
        </div>

        {/* Modal Mời & Sao chép mã/link phòng Poker (AC1) */}
        <PokerInviteModal
          isOpen={isPokerModalOpen}
          onClose={() => setIsPokerModalOpen(false)}
          room={activePokerRoom}
          storyTitle={story.title}
        />
      </main>
    </div>
  );
}
