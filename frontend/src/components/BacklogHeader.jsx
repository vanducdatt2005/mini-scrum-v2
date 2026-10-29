import { useSidebar } from "../context/SidebarContext";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";

const contributors = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBjKL2ISrsCNns8o1KNta57CO8CEJ1XMRzuYwPe10xl4AfhRqOjlJxHphiFOnwPBbK-OvCqI01ZKDhkijPG8inIYpO1TPB5rHjd-PeKpH3xQ4qiyak89AmFlBz30ROkbEuc3foEzlUNkh-cI1AyMCumklnzqfkeKb2l0reslMgqDEm4ascvUsL8_FY-zrtroFodbBellAKHFsZf9i3wabuYYLEiW4fxYAIK6pHsYAhRS5_Qk5WnE4GMxOPE5Cu8rStLmOUaXrK7CN8",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB5KYjmcIxMJrebyNea1o23lYCubFaft7e-8aGxMCxCuZJEzDNnusyaOjxFZ6FH-mBN-cQzGeodLogn5bOAOeHmPYv3CKc_2LsNrc4xlrFmRUPNaQ080J-mjhpRJ15okcVzWBYf8TIYaUlMoj5L-lJanfNIzIvv9kkVTqz6n0q7p6UeIwHcHNp5opewpxti4YWftOtvKz9kqbGVbPQRmgJ-lwN2mdrgi-D7nQ3cx9kE6MnkzAAvwvG9RLg_6Z8EuZBRZ1S9JwV54oQ",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDWUv8ag8Ox6wV7LQsCZTxFF7M6HZZckWo2lB5eRcc-oVRqQAH8sjtJfok4ucJKXF7KbqM2YsQY2ZUsY6e7SEsuOf5YHdBher7ZzL5u1tkubJeBgh_Pdrjaw1s2sCQZHJ8Rqq5UMLMzDe2TxvcKQinrid75GK_QGdmOoXV93LXse9D0m1YxL-7ZelfC1JUwFK6bu_yRFgs8I-q2yVKEehXQOgB8Z-K9URExl7dR6oWy__qW5GRfX3dcNkIyqPRLyEH2STRC1LHWYLc",
];

export default function BacklogHeader({ contributorCount = 12, projectId, projectName }) {
  const { toggle } = useSidebar();
  const navigate = useNavigate();

  return (
    <header className="flex justify-between items-center w-full px-4 md:px-8 py-4 md:py-6 mb-4 md:mb-8 gap-3 safe-area-right">
      {/* Left: Menu + Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button 
          onClick={toggle}
          className="p-2 -ml-2 text-[#44474e] hover:bg-[#f1f3f8] rounded-full transition-colors md:hidden flex-shrink-0"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="flex flex-col min-w-0">
          <h2 className="font-['Manrope'] font-bold text-2xl md:text-3xl text-on-surface leading-tight truncate">
            {projectName || "Project Backlog"}
          </h2>
        </div>
      </div>

      {/* Right: Actions Container - Always visible, safe from scrollbar */}
      <div className="flex items-center gap-2.5 md:gap-3 flex-shrink-0 pr-2">
        {/* Nút Manage Team */}
        {projectId && (
          <button 
            onClick={() => navigate(`/projects/${projectId}/members`)}
            className="p-2.5 rounded-xl bg-primary text-on-primary hover:scale-[0.98] active:scale-95 shadow-md transition-all flex items-center justify-center flex-shrink-0"
            title="Quản lý thành viên"
          >
            <span className="material-symbols-outlined text-lg">group_add</span>
            <span className="hidden lg:inline ml-2 font-bold text-xs whitespace-nowrap">Quản lý Team</span>
          </button>
        )}

        {/* Notification Bell - Visible on all sizes */}
        <div className="flex-shrink-0">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
