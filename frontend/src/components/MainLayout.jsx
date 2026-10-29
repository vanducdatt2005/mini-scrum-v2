import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useSidebar } from "../context/SidebarContext";

function MainLayoutContent({ children, activePage, header, showHeader = true, projectId }) {
  const { isOpen, close, toggle } = useSidebar();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar - Mobile Drawer / Desktop Fixed */}
      <Sidebar
        activePage={activePage}
        isOpen={isOpen}
        onClose={close}
        projectId={projectId}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64 w-full transition-all duration-300">
        {showHeader && (header || <TopBar projectId={projectId} />)}

        <main className={`flex-1 p-4 md:p-8 ${!showHeader ? 'pt-4' : ''}`}>
          {children}
        </main>
      </div>

    </div>
  );
}

export default function MainLayout(props) {
  return <MainLayoutContent {...props} />;
}
