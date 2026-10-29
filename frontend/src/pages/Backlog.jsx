//frontend/src/pages/Backlog.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import useSocket from "../hooks/useSocket";
// === Thêm thư viện Drag & Drop ===
import { 
  DndContext, 
  closestCenter, 
  rectIntersection,
  PointerSensor, 
  MouseSensor,
  TouchSensor,
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import MainLayout from "../components/MainLayout";
import BacklogHeader from "../components/BacklogHeader";
import SprintSection from "../components/SprintSection";
import ProductBacklog from "../components/ProductBacklog";
import TaskBoard from "../components/TaskBoard";
import CreateStoryModal from "../components/CreateStoryModal";
import CreateSprintModal from "../components/CreateSprintModal";
import CreateTaskModal from "../components/CreateTaskModal";
import StartSprintModal from "../components/StartSprintModal";
import CompleteSprintModal from "../components/CompleteSprintModal";
import SprintCeremonyModal from "../components/SprintCeremonyModal";
import api, { 
  getStoriesByProject, 
  getSprintsByProject, 
  updateUserStory, 
  createUserStory, 
  reorderStories,
  createStoryTask, 
  updateTask,
  getProjectMembers,
  assignTaskByEmail
} from "../services/api";

export default function Backlog() {
  const { projectId } = useParams();
  const { user: currentUser } = useAuth();
  // === State cũ giữ nguyên (US-007 & US-008) ===
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterTag, setFilterTag] = useState("ALL");

  const [stories, setStories] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [project, setProject] = useState(null);
  const [userRole, setUserRole] = useState("MEMBER");
  const [members, setMembers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [isStartSprintModalOpen, setIsStartSprintModalOpen] = useState(false);
  const [isCompleteSprintModalOpen, setIsCompleteSprintModalOpen] = useState(false);
  const [isCeremonyModalOpen, setIsCeremonyModalOpen] = useState(false);
  const [sprintToStart, setSprintToStart] = useState(null);
  const [sprintToComplete, setSprintToComplete] = useState(null);
  const [ceremonySprint, setCeremonySprint] = useState(null);
  const [editingStory, setEditingStory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStories, setSelectedStories] = useState([]);

  const [activeTab, setActiveTab] = useState("backlog");   // "backlog" hoặc "taskboard"

  // Task states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskStory, setTaskStory] = useState(null); // { id, title }
  const [showCompletedSprints, setShowCompletedSprints] = useState(false);



  const navigate = useNavigate();

  // Cấu hình Drag & Drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 10 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  // Load data
  useEffect(() => {
    if (!projectId) {
      api.get("/project").then((res) => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          navigate(`/projects/${res.data[0].id}/backlog`, { replace: true });
        } else {
          navigate("/dashboard");
        }
      }).catch(() => navigate("/login"));
      return;
    }

    setIsLoading(true);
    Promise.all([
      getStoriesByProject(projectId),
      getSprintsByProject(projectId),
      api.get(`/project/${projectId}`),
      api.get(`/project/${projectId}/role`),
      getProjectMembers(projectId)
    ]).then(([storiesRes, sprintsRes, projectRes, roleRes, membersRes]) => {
      setStories(Array.isArray(storiesRes.data) ? storiesRes.data : []);
      setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
      setProject(projectRes.data);
      setUserRole(roleRes.data.role);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    }).catch(err => {
      console.error("Lỗi tải dữ liệu:", err);
      if (err.response?.status === 401) {
        navigate("/login");
      }
    }).finally(() => setIsLoading(false));
  }, [projectId, navigate]);

  const loadData = async () => {
    try {
      const [storiesRes, sprintsRes, membersRes] = await Promise.all([
        getStoriesByProject(projectId),
        getSprintsByProject(projectId),
        getProjectMembers(projectId)
      ]);
      setStories(Array.isArray(storiesRes.data) ? storiesRes.data : []);
      setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
    }
  };

  useSocket(projectId, loadData);

  // === Lọc stories cho Product Backlog ===
  // Stories trong backlog là những cái không có sprintId (chưa được gán vào Sprint nào)
  const backlogStories = stories.filter(s => s.sprintId === null || s.sprintId === undefined);

  const filteredBacklogStories = backlogStories
    .filter(story =>
      story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (story.description && story.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(story => filterPriority === "ALL" || story.priority === filterPriority)
    .filter(story => filterStatus === "ALL" || story.status === filterStatus)
    .filter(story => {
      if (filterTag === "ALL") return true;

      const storyTags = Array.isArray(story.tags)
        ? story.tags
        : (typeof story.tags === 'string'
          ? JSON.parse(story.tags || '[]')
          : []);

      return storyTags.includes(filterTag);
    });

  // ====================== DRAG & DROP (US-009) ======================

  // ====================== DRAG & DROP ======================
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    
    // DEBUG: Xem giá trị thực tế của IDs
    console.log("🎯 DragEnd - activeId:", activeId);
    console.log("🎯 DragEnd - overId:", overId);
    
    if (activeId === overId) return;

    // ==================== 6. CHUYỂN TRẠNG THÁI TASK (US-021) ====================
    if (activeId.startsWith("task-")) {
      const taskId = activeId.replace("task-", "");
      let newStatus = null;
      let targetStoryId = null;

      // Tìm mục tiêu (vùng thả)
      if (overId.startsWith("taskcolumn-")) {
        // Format: taskcolumn-{storyId}-{STATUS}
        // STATUS có thể là: TODO, IN_PROGRESS, DONE
        const STATUSES = ["IN_PROGRESS", "DONE", "TODO"];
        for (const s of STATUSES) {
          if (overId.endsWith(`-${s}`)) {
            newStatus = s;
            // storyId là phần giữa, bỏ "taskcolumn-" đầu và "-{STATUS}" cuối
            targetStoryId = overId.slice("taskcolumn-".length, overId.length - s.length - 1);
            break;
          }
        }
      } else if (overId.startsWith("task-")) {
        const overTaskId = overId.replace("task-", "");
        for (const story of stories) {
          const t = story.tasks?.find(task => task.id === overTaskId);
          if (t) {
            newStatus = t.status;
            targetStoryId = story.id;
            break;
          }
        }
      }

      // Xử lý cập nhật nếu tìm thấy target
      if (taskId && newStatus && targetStoryId) {
        // Optimistic UI Update
        setStories(prevStories => prevStories.map(story => {
          // Xóa task khỏi story cũ (nếu chuyển story) hoặc cập nhật status (nếu cùng story)
          const hasTask = story.tasks?.some(t => t.id === taskId);
          if (hasTask) {
            if (story.id === targetStoryId) {
              // Cùng story: chỉ cập nhật status
              return {
                ...story,
                tasks: story.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
              };
            } else {
              // Chuyển story: xóa khỏi story cũ
              return {
                ...story,
                tasks: story.tasks.filter(t => t.id !== taskId)
              };
            }
          }
          if (story.id === targetStoryId) {
            // Thêm task vào story mới (tìm task từ stories cũ)
            const movedTask = stories.flatMap(s => s.tasks || []).find(t => t.id === taskId);
            if (movedTask) {
              return {
                ...story,
                tasks: [...(story.tasks || []), { ...movedTask, status: newStatus }]
              };
            }
          }
          return story;
        }));

        try {
          await updateTask(taskId, { status: newStatus, storyId: targetStoryId });
          // loadData() sẽ fetch lại để đảm bảo đồng bộ hoàn toàn
          await loadData();
        } catch (err) {
          console.error("Lỗi cập nhật task:", err);
          alert("Không thể cập nhật trạng thái Task");
          await loadData(); // Rollback
        }
      }
      return;
    }

    const activeStory = stories.find(s => s.id === activeId);
    if (!activeStory) return;

    // Xác định vùng thả (quan trọng: thêm nhận diện column-)
    let targetZone = null;
    let targetSprintId = null;

    if (overId === "backlog-droppable-area") {
      targetZone = "BACKLOG";
    } else if (overId.startsWith("sprint-")) {
      targetZone = "SPRINT";
      targetSprintId = overId.replace("sprint-", "");
    } else if (overId.startsWith("column-")) {
      targetZone = "SPRINT";           // drop vào cột TODO / IN_PROGRESS / DONE
    } else {
      // drop lên một card cụ thể
      const overStory = stories.find(s => s.id === overId);
      if (overStory) {
        targetZone = overStory.sprintId ? "SPRINT" : "BACKLOG";
        targetSprintId = overStory.sprintId || null;
      }
    }

    if (!targetZone) return;

    const isCurrentlyInBacklog = activeStory.sprintId == null;

    // ==================== 5. CHUYỂN GIỮA CÁC CỘT TRONG TASK BOARD ====================
    if (!isCurrentlyInBacklog && targetZone === "SPRINT" && overId.startsWith("column-")) {
      const newStatus = overId.replace("column-", "");
      if (activeStory.status !== newStatus) {
        try {
          await updateUserStory(activeId, { status: newStatus });
          await loadData();
          return;
        } catch (err) {
          console.error("Lỗi chuyển cột:", err);
          alert("Không thể chuyển trạng thái task");
        }
      }
      return;
    }

    // 1. KÉO-THẢ TRONG CÙNG PRODUCT BACKLOG
    if (isCurrentlyInBacklog && targetZone === "BACKLOG") {
      const activeIndex = backlogStories.findIndex(s => s.id === activeId);
      let finalOverIndex = backlogStories.findIndex(s => s.id === overId);

      if (overId === "backlog-droppable-area" || finalOverIndex === -1) {
        finalOverIndex = backlogStories.length - 1;
      }

      if (activeIndex !== -1 && finalOverIndex !== -1) {
        const newOrderedBacklog = arrayMove(backlogStories, activeIndex, finalOverIndex);
        const sprintStoriesList = stories.filter(s => s.sprintId != null);

        setStories([...sprintStoriesList, ...newOrderedBacklog]); // optimistic

        try {
          const updates = newOrderedBacklog.map((story, index) => ({
            id: story.id,
            backlogOrder: index,
          }));
          await reorderStories(updates);
          await loadData();
        } catch (err) {
          console.error("Lỗi khi lưu thứ tự:", err);
          await loadData();
        }
      }
      return;
    }

    // 2. TỪ BACKLOG → SPRINT
    if (isCurrentlyInBacklog && targetZone === "SPRINT") {
      try {
        await updateUserStory(activeId, { sprintId: targetSprintId, status: "TODO" });
        await loadData();
      } catch (err) {
        console.error(err);
        alert("Không thể đưa vào Sprint");
      }
      return;
    }

    // 3. TỪ SPRINT → BACKLOG
    if (!isCurrentlyInBacklog && targetZone === "BACKLOG") {
      try {
        await updateUserStory(activeId, { sprintId: null, status: "BACKLOG" });
        await loadData();
      } catch (err) {
        console.error(err);
        alert("Không thể rút về Backlog");
      }
      return;
    }

    // 4. CHUYỂN GIỮA CÁC SPRINT
    if (!isCurrentlyInBacklog && targetZone === "SPRINT" && activeStory.sprintId !== targetSprintId) {
      try {
        await updateUserStory(activeId, { sprintId: targetSprintId });
        await loadData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateTask = async (taskData) => {
    if (!taskStory) return;
    setIsSubmitting(true);
    try {
      await createStoryTask(taskStory.id, taskData);
      await loadData();
      setIsTaskModalOpen(false);
      setTaskStory(null);
    } catch (err) {
      alert("Lỗi khi tạo Task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ====================== Các hàm cũ giữ nguyên ======================
  const handleModalSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      if (editingStory) {
        await updateUserStory(editingStory.id, formData);
      } else {
        await createUserStory({
          ...formData,
          projectId,
          status: "BACKLOG"
        });
      }
      await loadData();
      setIsModalOpen(false);
      setEditingStory(null);
    } catch (error) {
      console.error("Lỗi khi lưu User Story:", error);
      window.alert(error.response?.data?.message || error.response?.data?.error || "Lỗi khi lưu User Story!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStory = async (storyId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa User Story này?")) return;
    try {
      await api.delete(`/userstory/${storyId}`);
      await loadData();
    } catch (e) {
      window.alert(e.response?.data?.error || "Lỗi khi xóa!");
    }
  };

  const handleEditStory = (story) => {
    setEditingStory(story);
    setIsModalOpen(true);
  };

  const handleAddStory = () => {
    setEditingStory(null);
    setIsModalOpen(true);
  };

  const handleAssignStory = async (storyId) => {
    const email = window.prompt("Nhập Email của người phụ trách:");
    if (!email) return;
    try {
      await api.patch(`/userstory/${storyId}/assign`, { email });
      await loadData();
    } catch (e) {
      window.alert(e.response?.data?.error || "Lỗi assign!");
    }
  };

  const handleAssignStoryById = async (storyId, assigneeId) => {
    try {
      await updateUserStory(storyId, { assigneeId });
      await loadData();
    } catch (e) {
      window.alert(e.response?.data?.error || "Lỗi gán thành viên!");
    }
  };

  const handleAssignTask = async (taskId) => {
    const email = window.prompt("Nhập Email của người phụ trách Task:");
    if (!email) return;
    try {
      await assignTaskByEmail(taskId, email);
      await loadData();
    } catch (e) {
      window.alert(e.response?.data?.error || "Lỗi gán Task!");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa Task này?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      await loadData();
    } catch (e) {
      window.alert(e.response?.data?.error || "Lỗi khi xóa Task!");
    }
  };

  const handleSprintStatusChange = async (sprintId, newStatus) => {
    try {
      await api.patch(`/sprint/${sprintId}`, { status: newStatus });
      await loadData();
    } catch (err) {
      console.error("Lỗi cập nhật status Sprint:", err);
      alert(err.response?.data?.error || "Không thể cập nhật trạng thái Sprint.");
    }
  };

  const toggleStorySelection = (storyId) => {
    setSelectedStories(prev =>
      prev.includes(storyId) ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  const handleSelectAll = (isChecked, storyList) => {
    if (isChecked) {
      const newIds = storyList.map(s => s.id).filter(id => !selectedStories.includes(id));
      setSelectedStories(prev => [...prev, ...newIds]);
    } else {
      const idsToRemove = storyList.map(s => s.id);
      setSelectedStories(prev => prev.filter(id => !idsToRemove.includes(id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedStories.length} User Story này?`)) return;
    try {
      setIsSubmitting(true);
      await Promise.all(selectedStories.map(id => api.delete(`/userstory/${id}`)));
      setSelectedStories([]);
      await loadData();
    } catch (e) {
      window.alert("Lỗi khi xóa một số User Story!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkMoveToSprint = async (sprintId) => {
    try {
      setIsSubmitting(true);
      await Promise.all(selectedStories.map(id => updateUserStory(id, { sprintId, status: "TODO" })));
      setSelectedStories([]);
      await loadData();
    } catch (err) {
      window.alert("Có lỗi khi đưa các User Story vào Sprint");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkMoveToBacklog = async () => {
    try {
      setIsSubmitting(true);
      await Promise.all(selectedStories.map(id => updateUserStory(id, { sprintId: null, status: "BACKLOG" })));
      setSelectedStories([]);
      await loadData();
    } catch (err) {
      window.alert("Có lỗi khi rút các User Story về Backlog");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeSprints = sprints.filter(s => s.status === "ACTIVE");
  const plannedSprints = sprints.filter(s => s.status === "PLANNED");
  const completedSprints = sprints.filter(s => s.status === "COMPLETED");

  // ====================== RENDER ======================
  return (
    <MainLayout
      activePage="Backlog"
      header={<BacklogHeader projectId={projectId} projectName={project?.name} />}
      projectId={projectId}
    >
      <div className="space-y-6 md:space-y-10 pb-20 w-full max-w-full overflow-x-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* TAB CHUYỂN ĐỔI - Giống Jira */}
          <div className="flex border-b border-outline-variant mb-6">
            <button
              onClick={() => setActiveTab("backlog")}
              className={`px-6 py-3 font-medium text-sm transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "backlog"
                  ? "border-primary text-primary"
                  : "border-transparent hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined">inventory_2</span>
              Product Backlog
            </button>

            <button
              onClick={() => setActiveTab("taskboard")}
              className={`px-6 py-3 font-medium text-sm transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "taskboard"
                  ? "border-primary text-primary"
                  : "border-transparent hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined">view_kanban</span>
              Task Board
            </button>
          </div>

          {/* MIDDLE: Product Backlog */}
          {activeTab === "backlog" ? (
            <ProductBacklog
              projectId={projectId}
              stories={filteredBacklogStories}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filterPriority={filterPriority}
              onFilterPriorityChange={setFilterPriority}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              filterTag={filterTag}
              onFilterTagChange={setFilterTag}
              onAddStory={handleAddStory}
              onAssignStory={handleAssignStory}
              onEdit={handleEditStory}
              onDelete={handleDeleteStory}
              userRole={userRole}
              selectedStories={selectedStories}
              onToggleSelect={toggleStorySelection}
              onSelectAll={handleSelectAll}
              members={members}
              onAssignId={handleAssignStoryById}
              onMoveToSprint={async (id) => {
                const latestSprint = sprints.find((s) => s.status === "PLANNED") || sprints[0];
                if (!latestSprint) {
                  alert("Vui lòng tạo một Sprint trước.");
                  return;
                }
                if (window.confirm(`Đưa User Story này vào ${latestSprint.name}?`)) {
                  try {
                    await updateUserStory(id, { sprintId: latestSprint.id, status: "TODO" });
                    await loadData();
                  } catch (err) {}
                }
              }}
              onAddTask={(id, title) => {
                setTaskStory({ id, title });
                setIsTaskModalOpen(true);
              }}
            />
          ) : (
            <TaskBoard
              sprints={sprints}
              stories={stories}
              members={members}
              onUpdateStory={async (storyId, data) => {
                await updateUserStory(storyId, data);
                await loadData();
              }}
              onEditStory={handleEditStory}
              onUpdateTask={async (taskId, data) => {
                await updateTask(taskId, data);
                await loadData();
              }}
              onAssignTask={handleAssignTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={(id, title) => {
                setTaskStory({ id, title });
                setIsTaskModalOpen(true);
              }}
              userRole={userRole}
              currentUser={currentUser}
            />
          )}

          {/* BOTTOM: Planned Sprints (Sprint Planning Area) */}
          <div className="space-y-4 pt-4 border-t border-outline-variant/10">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-bold text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined">event_note</span>
                Sprint Planning
              </h3>
              {userRole !== "MEMBER" && (
                <button
                  onClick={() => setIsSprintModalOpen(true)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-primary rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-outline-variant/10"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  New Sprint
                </button>
              )}
            </div>

            <div className="space-y-4">
              {activeSprints.map((sprint) => (
                <div key={sprint.id} className="relative">
                  <div className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] z-10"></div>
                  <SprintSection
                    sprint={sprint}
                    stories={stories.filter((s) => s.sprintId === sprint.id)}
                    onAssign={handleAssignStory}
                    onAssignId={handleAssignStoryById}
                    onEdit={handleEditStory}
                    onDelete={handleDeleteStory}
                    onStatusChange={handleSprintStatusChange}
                    onStartClick={(sprint, stories) => {
                      setSprintToStart({ sprint, stories });
                      setIsStartSprintModalOpen(true);
                    }}
                    onCompleteClick={(sprint, stories) => {
                      setSprintToComplete({ sprint, stories });
                      setIsCompleteSprintModalOpen(true);
                    }}
                    onCeremonyClick={(sprint) => {
                      setCeremonySprint(sprint);
                      setIsCeremonyModalOpen(true);
                    }}
                    userRole={userRole}
                    selectedStories={selectedStories}
                    onToggleSelect={toggleStorySelection}
                    onSelectAll={handleSelectAll}
                    onMoveToBacklog={async (id) => {
                      try {
                        await updateUserStory(id, { sprintId: null, status: "BACKLOG" });
                        await loadData();
                      } catch (err) {
                        console.error(err);
                        alert("Không thể rút về Backlog");
                      }
                    }}
                    onAddTask={(id, title) => {
                      setTaskStory({ id, title });
                      setIsTaskModalOpen(true);
                    }}
                    members={members}
                  />
                </div>
              ))}

              {plannedSprints.length > 0 ? (
                plannedSprints.map((sprint) => (
                  <SprintSection
                    key={sprint.id}
                    sprint={sprint}
                    stories={stories.filter((s) => s.sprintId === sprint.id)}
                    projectId={projectId}
                    onAssign={handleAssignStory}
                    onAssignId={handleAssignStoryById}
                    onEdit={handleEditStory}
                    onDelete={handleDeleteStory}
                    onStatusChange={handleSprintStatusChange}
                    onStartClick={(sprint, stories) => {
                      setSprintToStart({ sprint, stories });
                      setIsStartSprintModalOpen(true);
                    }}
                    onCeremonyClick={(sprint) => {
                      setCeremonySprint(sprint);
                      setIsCeremonyModalOpen(true);
                    }}
                    userRole={userRole}
                    selectedStories={selectedStories}
                    onToggleSelect={toggleStorySelection}
                    onSelectAll={handleSelectAll}
                    onMoveToBacklog={async (id) => {
                      try {
                        await updateUserStory(id, { sprintId: null, status: "BACKLOG" });
                        await loadData();
                      } catch (err) {
                        console.error(err);
                        alert("Không thể rút về Backlog");
                      }
                    }}
                    onAddTask={(id, title) => {
                      setTaskStory({ id, title });
                      setIsTaskModalOpen(true);
                    }}
                    members={members}
                  />
                ))
              ) : (
                activeSprints.length === 0 && (
                  <div className="p-10 border-2 border-dashed border-outline-variant/20 rounded-3xl flex flex-col items-center justify-center text-on-surface-variant/50 gap-2 bg-surface-container-low/30">
                    <span className="material-symbols-outlined text-4xl">inventory_2</span>
                    <p className="text-sm font-medium">No planned sprints. Create one to start planning.</p>
                  </div>
                )
              )}
            </div>

            {/* Completed Sprints Section */}
            {completedSprints.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-outline-variant/10">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-lg font-bold text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    Sprints đã hoàn thành
                  </h3>
                  <button
                    onClick={() => setShowCompletedSprints(!showCompletedSprints)}
                    className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-outline-variant/10"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showCompletedSprints ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                    </span>
                    {showCompletedSprints ? "Ẩn danh sách" : `Hiển thị (${completedSprints.length})`}
                  </button>
                </div>

                {showCompletedSprints && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {completedSprints.map((sprint) => (
                      <SprintSection
                        key={sprint.id}
                        sprint={sprint}
                        stories={stories.filter((s) => s.sprintId === sprint.id)}
                        onAssign={handleAssignStory}
                        onAssignId={handleAssignStoryById}
                        onEdit={handleEditStory}
                        onDelete={handleDeleteStory}
                        onStatusChange={handleSprintStatusChange}
                        onStartClick={(sprint, stories) => {
                          setSprintToStart({ sprint, stories });
                          setIsStartSprintModalOpen(true);
                        }}
                        onCompleteClick={(sprint, stories) => {
                          setSprintToComplete({ sprint, stories });
                          setIsCompleteSprintModalOpen(true);
                        }}
                        onCeremonyClick={(sprint) => {
                          setCeremonySprint(sprint);
                          setIsCeremonyModalOpen(true);
                        }}
                        userRole={userRole}
                        selectedStories={selectedStories}
                        onToggleSelect={toggleStorySelection}
                        onSelectAll={handleSelectAll}
                        onMoveToBacklog={async (id) => {
                          try {
                            await updateUserStory(id, { sprintId: null, status: "BACKLOG" });
                            await loadData();
                          } catch (err) {
                            console.error(err);
                            alert("Không thể rút về Backlog");
                          }
                        }}
                        onAddTask={(id, title) => {
                          setTaskStory({ id, title });
                          setIsTaskModalOpen(true);
                        }}
                        members={members}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DndContext>
      </div>

      {/* Floating Action Bar for Bulk Selection */}
      {selectedStories.length > 0 && userRole !== "MEMBER" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-container-highest shadow-xl border border-outline-variant/20 rounded-2xl px-6 py-4 flex items-center justify-between gap-6 z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">check_circle</span>
            <div>
              <p className="font-bold text-on-surface text-base m-0 leading-tight">Đã chọn {selectedStories.length}</p>
              <button
                onClick={() => setSelectedStories([])}
                className="text-xs text-primary hover:underline m-0 p-0"
              >Bỏ chọn tất cả</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="bg-surface px-3 py-2 rounded-lg border border-outline-variant text-sm font-medium w-40"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (val === 'backlog') handleBulkMoveToBacklog();
                else handleBulkMoveToSprint(val);
                e.target.value = '';
              }}
            >
              <option value="">Di chuyển tới...</option>
              <option value="backlog">🏠 Product Backlog</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>🚀 {s.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-error-container text-on-error-container rounded-lg border border-error/20 flex items-center gap-2 hover:bg-error hover:text-on-error transition-colors text-sm font-bold"
            >
              <span className="material-symbols-outlined text-sm">delete</span> Xóa
            </button>
          </div>
        </div>
      )}

      <CreateSprintModal
        isOpen={isSprintModalOpen}
        onClose={() => setIsSprintModalOpen(false)}
        projectId={projectId}
        onCreated={loadData}
      />

      <CreateStoryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingStory(null); }}
        onSubmit={handleModalSubmit}
        loading={isSubmitting}
        initialData={editingStory}
        projectId={projectId}
        currentUser={currentUser}
      />

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        loading={isSubmitting}
        storyTitle={taskStory?.title}
        userRole={userRole}
      />

      <StartSprintModal
        isOpen={isStartSprintModalOpen}
        onClose={() => setIsStartSprintModalOpen(false)}
        sprint={sprintToStart?.sprint}
        stories={sprintToStart?.stories}
        onStarted={loadData}
      />

      <CompleteSprintModal
        isOpen={isCompleteSprintModalOpen}
        onClose={() => setIsCompleteSprintModalOpen(false)}
        sprint={sprintToComplete?.sprint}
        stories={sprintToComplete?.stories}
        plannedSprints={sprints.filter(s => s.status === 'PLANNED')}
        onCompleted={loadData}
      />

      <SprintCeremonyModal
        isOpen={isCeremonyModalOpen}
        onClose={() => setIsCeremonyModalOpen(false)}
        sprint={ceremonySprint}
        userRole={userRole}
      />
    </MainLayout>
  );
}
