// frontend/src/components/ProductBacklog.jsx
import { useState, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableUserStoryCard } from "./SortableUserStoryCard";
import useSocket from '../hooks/useSocket';
import api from '../services/api';

export default function ProductBacklog({
  stories = [],
  searchTerm = "",
  onSearchChange,
  filterPriority = "ALL",
  onFilterPriorityChange,
  filterStatus = "ALL",
  onFilterStatusChange,
  filterTag = "ALL",
  onFilterTagChange,
  onAddStory,
  onAssignStory,
  onEdit,
  onDelete,
  onMoveToSprint,
  userRole,
  selectedStories = [],
  onToggleSelect,
  onSelectAll,
  projectId,
  onAddTask,
  members = [],
  onAssignId
}) {
  const isManagement = userRole === "PO" || userRole === "SM";

  const { setNodeRef } = useDroppable({
    id: "backlog-droppable-area",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ==================== US-051: Server-side Pagination ====================
  const [serverStories, setServerStories] = useState([]);
  const [serverPagination, setServerPagination] = useState({
    page: 1,
    size: 12,
    totalElements: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const [allServerTags, setAllServerTags] = useState([]);

  // State nội bộ cho server mode
  const [internalSearchTerm, setInternalSearchTerm] = useState(searchTerm);
  const [internalFilterPriority, setInternalFilterPriority] = useState(filterPriority);
  const [internalFilterStatus, setInternalFilterStatus] = useState(filterStatus);
  const [internalFilterTag, setInternalFilterTag] = useState(filterTag);

  // Fetch từ API
  const fetchServerBacklog = useCallback(async (isBackground = false) => {
    if (!projectId) return;

    if (isBackground) {
      setIsBackgroundFetching(true);
    } else {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('token');
      const params = {
        projectId,
        page: serverPagination.page,
        size: 12,
        search: internalSearchTerm || undefined,
        priority: internalFilterPriority !== "ALL" ? internalFilterPriority : undefined,
        status: internalFilterStatus !== "ALL" ? internalFilterStatus : undefined,
        tag: internalFilterTag !== "ALL" ? internalFilterTag : undefined,
      };

      console.log("Đang gọi API với params:", params);

      const res = await api.get('/user-stories/backlog', { 
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      console.log("API trả về:", res.data);

      setServerStories(res.data?.content || []);
      setServerPagination({
        page: res.data?.pagination?.page || 1,
        size: res.data?.pagination?.size || 12,
        totalElements: res.data?.pagination?.totalElements || 0,
        totalPages: res.data?.pagination?.totalPages || 1,
      });

      if (res.data.allTags) setAllServerTags(res.data.allTags);
    } catch (error) {
      console.error("Lỗi load Product Backlog:", error);
    } finally {
      if (isBackground) {
        setIsBackgroundFetching(false);
      } else {
        setLoading(false);
      }
    }
  }, [projectId, serverPagination.page, internalSearchTerm, internalFilterPriority, internalFilterStatus, internalFilterTag]);

  // Gọi API khi projectId hoặc các filter thay đổi
  useEffect(() => {
    if (projectId) {
      fetchServerBacklog();
    }
  }, [projectId, serverPagination.page, internalSearchTerm, internalFilterPriority, internalFilterStatus, internalFilterTag]);

  // Reset về trang 1 khi thay đổi filter/search
  const resetToFirstPage = () => {
    setServerPagination(prev => ({ ...prev, page: 1 }));
  };

  // US-028
  const handleRealTimeUpdate = useCallback((data) => {
    if (data && (data.action === 'created' || data.action === 'deleted')) {
      setServerPagination(prev => {
        if (prev.page === 1) fetchServerBacklog(true);
        return { ...prev, page: 1 };
      });
    } else {
      fetchServerBacklog(true);
    }
  }, [fetchServerBacklog]);

// Truyền handleRealTimeUpdate vào useSocket
useSocket(projectId, handleRealTimeUpdate);

  // ==================== Logic cũ giữ nguyên ====================
  useEffect(() => {
    setCurrentPage(1);
  }, [stories.length]);

  // Sync optimistic update from parent (Backlog.jsx)
  useEffect(() => {
    if (projectId && stories && stories.length > 0 && serverStories.length > 0) {
      const storyOrder = new Map(stories.map((s, index) => [s.id, index]));
      let isChanged = false;
      const newServerStories = [...serverStories].sort((a, b) => {
        const orderA = storyOrder.get(a.id);
        const orderB = storyOrder.get(b.id);
        if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
           isChanged = true;
           return orderA - orderB;
        }
        return 0;
      });
      if (isChanged) {
        setServerStories(newServerStories);
      }
    }
  }, [stories, projectId]);

  const allTags = [...new Set(
    stories.flatMap(story => {
      if (!story.tags) return [];
      const tagsArray = Array.isArray(story.tags) 
        ? story.tags 
        : JSON.parse(story.tags || '[]');
      return tagsArray;
    })
  )].sort();

  const totalPages = Math.ceil(stories.length / itemsPerPage);
  const currentStories = stories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const useServerMode = !!projectId;
  const displayStories = useServerMode ? serverStories : currentStories;
  const displayTotalPages = useServerMode ? serverPagination.totalPages : totalPages;
  const displayTotalItems = useServerMode ? serverPagination.totalElements : stories.length;
  const displayAllTags = useServerMode ? allServerTags : allTags;

  return (
    <section>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {onSelectAll && (
              <input 
                type="checkbox"
                className="w-5 h-5 cursor-pointer accent-primary shrink-0"
                checked={displayStories.length > 0 && selectedStories.length === displayStories.length}
                onChange={(e) => onSelectAll(e.target.checked, displayStories)}
              />
            )}
            <h3 className="font-['Manrope'] font-bold text-xl text-on-surface flex items-center gap-2">
              Product Backlog 
              <span className="text-on-surface-variant font-black text-xs px-2 py-0.5 bg-surface-container rounded-full">{displayTotalItems}</span>
            </h3>
          </div>
          
          {/* Nút thêm nhanh trên mobile */}
          {isManagement && (
            <button
              onClick={onAddStory}
              className="lg:hidden w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-xl">add</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:items-center gap-3 flex-1 lg:justify-end">
          {/* Search */}
          <div className="relative w-full lg:max-w-xs transition-all focus-within:lg:max-w-sm">
            <input
              type="text"
              placeholder="Tìm theo tiêu đề hoặc mô tả..."
              className="pl-11 pr-4 py-3 w-full bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium"
              value={useServerMode ? internalSearchTerm : searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                if (useServerMode) {
                  setInternalSearchTerm(value);
                  resetToFirstPage();
                } else if (onSearchChange) {
                  onSearchChange(value);
                }
              }}
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">search</span>
          </div>

          {/* Group Filters on Mobile */}
          <div className="grid grid-cols-2 md:contents gap-2">
            {/* Filter Priority */}
            <div className="relative">
              <select 
                value={useServerMode ? internalFilterPriority : filterPriority}
                onChange={(e) => {
                  const value = e.target.value;
                  if (useServerMode) {
                    setInternalFilterPriority(value);
                    resetToFirstPage();
                  } else if (onFilterPriorityChange) {
                    onFilterPriorityChange(value);
                  }
                }}
                className="appearance-none bg-surface-container-low px-4 py-3 w-full lg:w-40 rounded-2xl border border-outline-variant/10 focus:border-primary outline-none cursor-pointer text-xs font-black uppercase tracking-widest text-on-surface-variant"
              >
                <option value="ALL">Mọi ưu tiên</option>
                <option value="HIGH">🔴 HIGH</option>
                <option value="MEDIUM">🟠 MEDIUM</option>
                <option value="LOW">🟢 LOW</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-lg pointer-events-none">expand_more</span>
            </div>

            {/* Filter Status */}
            <div className="relative">
              <select 
                value={useServerMode ? internalFilterStatus : filterStatus}
                onChange={(e) => {
                  const value = e.target.value;
                  if (useServerMode) {
                    setInternalFilterStatus(value);
                    resetToFirstPage();
                  } else if (onFilterStatusChange) {
                    onFilterStatusChange(value);
                  }
                }}
                className="appearance-none bg-surface-container-low px-4 py-3 w-full lg:w-44 rounded-2xl border border-outline-variant/10 focus:border-primary outline-none cursor-pointer text-xs font-black uppercase tracking-widest text-on-surface-variant"
              >
                <option value="ALL">Mọi trạng thái</option>
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">Todo</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-lg pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* Filter Tag */}
          <div className="relative">
            <select 
              value={useServerMode ? internalFilterTag : filterTag}
              onChange={(e) => {
                const value = e.target.value;
                if (useServerMode) {
                  setInternalFilterTag(value);
                  resetToFirstPage();
                } else if (onFilterTagChange) {
                  onFilterTagChange(value);
                }
              }}
              className="appearance-none bg-surface-container-low px-4 py-3 w-full lg:w-40 rounded-2xl border border-outline-variant/10 focus:border-primary outline-none cursor-pointer text-xs font-black uppercase tracking-widest text-on-surface-variant"
            >
              <option value="ALL">Mọi Nhãn</option>
              {displayAllTags.map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-lg pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>

      {/* Khu vực kéo thả */}
      <div 
        ref={setNodeRef} 
        className="min-h-[350px] border border-dashed border-outline-variant/40 rounded-2xl overflow-hidden transition-all bg-surface"
      >
        <SortableContext 
          items={displayStories.map((story) => story.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col">
            {loading ? (
              <div className="py-12 text-center text-on-surface-variant/70">Đang tải dữ liệu từ server...</div>
            ) : displayStories.length > 0 ? (
              displayStories.map((story) => (
                <SortableUserStoryCard
                  key={story.id}
                  id={story.id}
                  {...story}
                  variant="backlog"
                  onAssign={onAssignStory}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  userRole={userRole}
                  onMove={onMoveToSprint}
                  moveIcon="arrow_upward"
                  moveTitle="Đưa vào Sprint"
                  isSelected={selectedStories.includes(story.id)}
                  onToggleSelect={onToggleSelect}
                  onAddTask={onAddTask}
                  members={members}
                  onAssignId={onAssignId}
                />
              ))
            ) : (
              <div className="py-12 text-center text-on-surface-variant/50 italic border border-dashed border-outline-variant/20 rounded-xl text-sm">
                Product Backlog đang trống.
              </div>
            )}
          </div>
        </SortableContext>
      </div>

      {/* Phân trang */}
      {(displayTotalPages > 1 || totalPages > 1) && (
        <div className="flex items-center justify-center gap-2 mt-4 mb-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 px-3 rounded-lg border border-outline-variant/30 text-sm font-medium hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Trang trước
          </button>
          <span className="text-sm text-on-surface-variant font-medium px-2">
            Trang {currentPage} / {displayTotalPages || totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(displayTotalPages || totalPages, p + 1))}
            disabled={currentPage === (displayTotalPages || totalPages)}
            className="p-1 px-3 rounded-lg border border-outline-variant/30 text-sm font-medium hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Trang sau
          </button>
        </div>
      )}

      {/* Nút thêm */}
      {isManagement && (
        <div
          onClick={onAddStory}
          className="mt-6 border border-dashed border-outline-variant/30 p-3 rounded-xl flex items-center justify-center gap-2 text-on-surface-variant/60 hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-all cursor-pointer group bg-surface-container-lowest"
        >
          <span className="material-symbols-outlined group-hover:rotate-90 transition-transform text-xl">add_circle</span>
          <span className="font-bold text-sm">Thêm User Story mới vào Backlog</span>
        </div>
      )}
    </section>
  );
}