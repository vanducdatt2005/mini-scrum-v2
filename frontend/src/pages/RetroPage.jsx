import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../hooks/useSocket';
import { onSocketReconnect } from '../context/SocketContext';
import api, {
  getProjectRetros,
  createProjectRetro,
  getRetroDetails,
  addRetroNote,
  updateRetroNote,
  deleteRetroNote,
  voteRetroNote,
  updateRetroSession,
  getSprintsByProject,
  getAvatarUrl,
  getMyProjectRole,
} from '../services/api';

const COLUMNS = [
  {
    id: 'WENT_WELL',
    title: 'Làm tốt',
    icon: 'sentiment_satisfied',
    colorClasses: {
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
      headerBg: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40',
      noteBg: 'bg-[#f0fdf4] dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-100 shadow-sm hover:shadow-md',
      inputFocus: 'focus:border-emerald-500 focus:ring-emerald-200',
      accent: 'border-l-4 border-l-emerald-500',
      tag: 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    placeholder: 'Điều nhóm đã làm tốt... (Nhấn Enter để gửi)',
  },
  {
    id: 'TO_IMPROVE',
    title: 'Cần cải thiện',
    icon: 'sentiment_dissatisfied',
    colorClasses: {
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
      headerBg: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40',
      noteBg: 'bg-[#fffbeb] dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 shadow-sm hover:shadow-md',
      inputFocus: 'focus:border-amber-500 focus:ring-amber-200',
      accent: 'border-l-4 border-l-amber-500',
      tag: 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    placeholder: 'Điều nhóm cần cải thiện... (Nhấn Enter để gửi)',
  },
  {
    id: 'ACTION_ITEM',
    title: 'Action Item',
    icon: 'check_circle',
    colorClasses: {
      badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
      headerBg: 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/40',
      noteBg: 'bg-[#f0f9ff] dark:bg-sky-950/40 border-sky-300 dark:border-sky-700/60 text-sky-950 dark:text-sky-100 shadow-sm hover:shadow-md',
      inputFocus: 'focus:border-sky-500 focus:ring-sky-200',
      accent: 'border-l-4 border-l-sky-500',
      tag: 'bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    },
    placeholder: 'Hành động cụ thể tiếp theo... (Nhấn Enter để gửi)',
  },
];

export default function RetroPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const [columnsData, setColumnsData] = useState({
    WENT_WELL: [],
    TO_IMPROVE: [],
    ACTION_ITEM: [],
  });
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);

  // Modal tạo buổi
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [creating, setCreating] = useState(false);

  // Input sticky notes theo từng cột
  const [inputs, setInputs] = useState({
    WENT_WELL: '',
    TO_IMPROVE: '',
    ACTION_ITEM: '',
  });

  // Checkbox ẩn danh theo từng cột (SCRUM-74)
  const [anonymousInputs, setAnonymousInputs] = useState({
    WENT_WELL: false,
    TO_IMPROVE: false,
    ACTION_ITEM: false,
  });

  // State chỉnh sửa note (SCRUM-74)
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // State bình chọn sticky note (SCRUM-75)
  const [myVotesLeft, setMyVotesLeft] = useState(3);
  const [votingNoteId, setVotingNoteId] = useState(null);

  // Vai trò trong dự án (SCRUM-76: ẩn nút Đóng buổi với thành viên thường)
  const [myProjectRole, setMyProjectRole] = useState(null);

  // Tải danh sách buổi khi mở trang
  useEffect(() => {
    if (projectId) {
      loadSessions();
      loadSprints();
      getMyProjectRole(projectId)
        .then((res) => setMyProjectRole(res.data?.role || 'MEMBER'))
        .catch(() => setMyProjectRole('MEMBER'));
    }
  }, [projectId]);

  const loadSprints = async () => {
    try {
      const res = await getSprintsByProject(projectId);
      setSprints(res.data || []);
    } catch (err) {
      console.warn('Không thể tải danh sách sprint:', err);
    }
  };

  const loadSessions = async (preferSessionId = null) => {
    setLoading(true);
    try {
      const res = await getProjectRetros(projectId);
      const list = res.data || [];
      setSessions(list);

      if (list.length > 0) {
        const target = preferSessionId
          ? list.find((s) => s.id === preferSessionId) || list[0]
          : list[0];
        await selectSession(target.id);
      } else {
        setActiveSession(null);
        setColumnsData({
          WENT_WELL: [],
          TO_IMPROVE: [],
          ACTION_ITEM: [],
        });
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách Retrospective:', err);
      toast.error(err.response?.data?.error || 'Không thể tải danh sách Retrospective');
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (sessionId, showLoading = true) => {
    if (showLoading) setLoadingSession(true);
    try {
      const res = await getRetroDetails(sessionId);
      setActiveSession(res.data);
      if (typeof res.data?.myVotesLeft === 'number') {
        setMyVotesLeft(res.data.myVotesLeft);
      } else {
        setMyVotesLeft(3);
      }
      setColumnsData(
        res.data.columns || {
          WENT_WELL: [],
          TO_IMPROVE: [],
          ACTION_ITEM: [],
        }
      );
    } catch (err) {
      console.error('Lỗi tải chi tiết buổi Retrospective:', err);
      toast.error(err.response?.data?.error || 'Không thể tải chi tiết buổi Retrospective');
    } finally {
      if (showLoading) setLoadingSession(false);
    }
  };

  // Upsert note theo id (SCRUM-63 & SCRUM-74 & SCRUM-75)
  const upsertNote = (incoming) => {
    if (!incoming || !incoming.id || !incoming.column) return;
    setColumnsData((prev) => {
      let existingNote = null;
      for (const colKey of Object.keys(prev)) {
        const found = prev[colKey].find((n) => n.id === incoming.id);
        if (found) {
          existingNote = found;
          break;
        }
      }

      const targetCol = incoming.column;
      const isMine =
        existingNote && existingNote.isMine !== undefined
          ? existingNote.isMine
          : (incoming.isMine !== undefined ? incoming.isMine : false);

      const myVoted =
        existingNote && existingNote.myVoted !== undefined
          ? existingNote.myVoted
          : (incoming.myVoted !== undefined ? incoming.myVoted : false);

      const voteCount =
        incoming.voteCount !== undefined
          ? incoming.voteCount
          : (existingNote ? existingNote.voteCount || 0 : 0);

      const mergedNote = {
        ...incoming,
        isMine,
        myVoted,
        voteCount,
      };

      const nextState = {};
      for (const colKey of Object.keys(prev)) {
        if (colKey === targetCol) {
          const list = prev[colKey];
          // Check if there is an optimistic note to replace
          const optIdx = list.findIndex(
            (n) => n._isOptimistic && n.content === incoming.content && n.column === incoming.column
          );
          const existingIdx = list.findIndex((n) => n.id === incoming.id);

          if (existingIdx >= 0) {
            const updatedList = [...list];
            updatedList[existingIdx] = mergedNote;
            nextState[colKey] = updatedList;
          } else if (optIdx >= 0) {
            const updatedList = [...list];
            updatedList[optIdx] = { ...mergedNote, isMine: true };
            nextState[colKey] = updatedList;
          } else {
            nextState[colKey] = [...list, mergedNote];
          }
        } else {
          nextState[colKey] = prev[colKey].filter((n) => n.id !== incoming.id);
        }
      }
      return nextState;
    });
  };

  const removeNote = (noteId) => {
    if (!noteId) return;
    setColumnsData((prev) => {
      const nextState = {};
      let changed = false;
      for (const colKey of Object.keys(prev)) {
        const filtered = prev[colKey].filter((n) => n.id !== noteId);
        if (filtered.length !== prev[colKey].length) changed = true;
        nextState[colKey] = filtered;
      }
      return changed ? nextState : prev;
    });
  };

  // Realtime Socket Listeners (SCRUM-59, SCRUM-74, SCRUM-75)
  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('joinProject', projectId);

    const handleCreated = (note) => {
      if (activeSessionRef.current && note.sessionId && note.sessionId !== activeSessionRef.current.id) {
        return;
      }
      upsertNote(note);
    };

    const handleUpdated = (note) => {
      if (activeSessionRef.current && note.sessionId && note.sessionId !== activeSessionRef.current.id) {
        return;
      }
      upsertNote(note);
    };

    const handleDeleted = (data) => {
      const deletedId = data?.id;
      if (!deletedId) return;
      removeNote(deletedId);
    };

    const handleNoteVoted = (data) => {
      const noteId = data?.noteId;
      const voteCount = data?.voteCount;
      if (!noteId) return;

      // Cập nhật voteCount theo noteId, giữ nguyên myVoted, isMine (SCRUM-75)
      setColumnsData((prev) => {
        const nextState = {};
        let changed = false;
        for (const colKey of Object.keys(prev)) {
          const list = prev[colKey];
          const idx = list.findIndex((n) => n.id === noteId);
          if (idx >= 0) {
            changed = true;
            const updatedList = [...list];
            updatedList[idx] = {
              ...updatedList[idx],
              voteCount,
            };
            nextState[colKey] = updatedList;
          } else {
            nextState[colKey] = list;
          }
        }
        return changed ? nextState : prev;
      });
    };

    const handleReconnect = () => {
      if (activeSessionRef.current?.id) {
        getRetroDetails(activeSessionRef.current.id)
          .then((res) => {
            if (res.data?.columns) {
              setColumnsData(res.data.columns);
            }
            if (typeof res.data?.myVotesLeft === 'number') {
              setMyVotesLeft(res.data.myVotesLeft);
            }
          })
          .catch((err) => {
            console.error('Lỗi tải lại ghi chú sau khi kết nối lại:', err);
          });
      }
    };

    socket.on('RETRO_NOTE_CREATED', handleCreated);
    socket.on('RETRO_NOTE_UPDATED', handleUpdated);
    socket.on('RETRO_NOTE_DELETED', handleDeleted);
    socket.on('RETRO_NOTE_VOTED', handleNoteVoted);
    socket.on('connect', handleReconnect);
    const offReconnect = onSocketReconnect(handleReconnect);

    return () => {
      socket.off('RETRO_NOTE_CREATED', handleCreated);
      socket.off('RETRO_NOTE_UPDATED', handleUpdated);
      socket.off('RETRO_NOTE_DELETED', handleDeleted);
      socket.off('RETRO_NOTE_VOTED', handleNoteVoted);
      socket.off('connect', handleReconnect);
      offReconnect();
    };
  }, [projectId]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề buổi Retrospective');
      return;
    }

    setCreating(true);
    try {
      const res = await createProjectRetro(projectId, {
        title: newTitle.trim(),
        sprintId: selectedSprintId || null,
      });
      toast.success('Đã tạo buổi Retrospective mới!');
      setShowCreateModal(false);
      setNewTitle('');
      setSelectedSprintId('');
      await loadSessions(res.data.id);
    } catch (err) {
      console.error('Lỗi tạo buổi Retrospective:', err);
      toast.error(err.response?.data?.error || 'Không thể tạo buổi Retrospective');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!activeSession) return;
    const nextStatus = activeSession.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      const res = await updateRetroSession(activeSession.id, { status: nextStatus });
      setActiveSession((prev) => ({ ...prev, status: nextStatus }));
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, status: nextStatus } : s))
      );
      toast.success(
        nextStatus === 'CLOSED'
          ? 'Đã đóng buổi Retrospective'
          : 'Đã mở lại buổi Retrospective'
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể cập nhật trạng thái');
    }
  };

  const handleKeyDownNote = async (e, columnId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = inputs[columnId]?.trim();
      const isAnon = Boolean(anonymousInputs[columnId]);

      if (!content) {
        toast.error('Nội dung ghi chú không được để trống');
        return;
      }

      if (content.length > 500) {
        toast.error('Nội dung không được vượt quá 500 ký tự');
        return;
      }

      if (activeSession.status === 'CLOSED') {
        toast.error('Buổi Retrospective đã kết thúc, không thể thêm ghi chú');
        return;
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const optimisticNote = {
        id: tempId,
        sessionId: activeSession.id,
        column: columnId,
        content,
        isAnonymous: isAnon,
        isMine: true,
        createdAt: new Date().toISOString(),
        ...(isAnon
          ? {}
          : {
              author: {
                id: user?.id,
                name: user?.fullName || user?.name || 'Tôi',
              },
            }),
        _isOptimistic: true,
      };

      // Cập nhật giao diện ngay lập tức (TC-US074-18)
      setColumnsData((prev) => ({
        ...prev,
        [columnId]: [...(prev[columnId] || []), optimisticNote],
      }));
      setInputs((prev) => ({ ...prev, [columnId]: '' }));

      try {
        const res = await addRetroNote(activeSession.id, {
          column: columnId,
          content,
          isAnonymous: isAnon,
        });

        const realNote = res.data;
        setColumnsData((prev) => {
          const colNotes = prev[columnId] || [];
          const alreadyExists = colNotes.some((n) => n.id === realNote.id);
          if (alreadyExists) {
            return {
              ...prev,
              [columnId]: colNotes
                .filter((n) => n.id !== tempId)
                .map((n) => (n.id === realNote.id ? { ...n, isMine: true } : n)),
            };
          }
          return {
            ...prev,
            [columnId]: colNotes.map((n) => (n.id === tempId ? { ...realNote, isMine: true } : n)),
          };
        });
        toast.success('Đã thêm ghi chú');
      } catch (err) {
        // Khôi phục trạng thái cũ khi lỗi (TC-US074-19)
        setColumnsData((prev) => ({
          ...prev,
          [columnId]: (prev[columnId] || []).filter((n) => n.id !== tempId),
        }));
        setInputs((prev) => ({ ...prev, [columnId]: content }));
        console.error('Lỗi thêm ghi chú:', err);
        toast.error(err.response?.data?.error || 'Không thể thêm ghi chú');
      }
    }
  };

  // Sửa ghi chú (SCRUM-74)
  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleSaveEditNote = async (note) => {
    const trimmed = editingContent.trim();
    if (!trimmed) {
      toast.error('Nội dung ghi chú không được để trống');
      return;
    }
    if (trimmed.length > 500) {
      toast.error('Nội dung không được vượt quá 500 ký tự');
      return;
    }

    const oldContent = note.content;
    const colId = note.column;

    // Cập nhật giao diện ngay lập tức (TC-US074-15)
    setColumnsData((prev) => ({
      ...prev,
      [colId]: (prev[colId] || []).map((n) => (n.id === note.id ? { ...n, content: trimmed } : n)),
    }));
    setEditingNoteId(null);
    setSavingEdit(true);

    try {
      const res = await updateRetroNote(activeSession.id, note.id, { content: trimmed });
      setColumnsData((prev) => ({
        ...prev,
        [colId]: (prev[colId] || []).map((n) => (n.id === note.id ? { ...res.data, isMine: true } : n)),
      }));
      toast.success('Đã cập nhật ghi chú');
    } catch (err) {
      // Khôi phục khi lỗi
      setColumnsData((prev) => ({
        ...prev,
        [colId]: (prev[colId] || []).map((n) => (n.id === note.id ? { ...n, content: oldContent } : n)),
      }));
      toast.error(err.response?.data?.error || 'Không thể cập nhật ghi chú');
    } finally {
      setSavingEdit(false);
    }
  };

  // Xóa ghi chú (SCRUM-74)
  const handleDeleteNote = async (note) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) {
      return;
    }

    const colId = note.column;
    // Cập nhật giao diện ngay lập tức (TC-US074-16)
    setColumnsData((prev) => ({
      ...prev,
      [colId]: (prev[colId] || []).filter((n) => n.id !== note.id),
    }));

    try {
      await deleteRetroNote(activeSession.id, note.id);
      toast.success('Đã xóa ghi chú');
    } catch (err) {
      // Khôi phục khi lỗi
      setColumnsData((prev) => ({
        ...prev,
        [colId]: [...(prev[colId] || []), note],
      }));
      toast.error(err.response?.data?.error || 'Không thể xóa ghi chú');
    }
  };

  // Vote sticky note (SCRUM-75)
  const handleVoteNote = async (note) => {
    if (!activeSession) return;
    if (activeSession.status === 'CLOSED') {
      toast.error('Buổi Retrospective đã kết thúc, không thể vote');
      return;
    }
    if (note.myVoted) {
      toast.error('Bạn đã vote note này rồi');
      return;
    }
    if (myVotesLeft <= 0) {
      toast.error('Bạn đã dùng hết 3 phiếu');
      return;
    }

    const prevVotesLeft = myVotesLeft;
    const colId = note.column;
    const oldVoteCount = note.voteCount || 0;

    // Optimistic update
    setVotingNoteId(note.id);
    setMyVotesLeft((prev) => Math.max(0, prev - 1));
    setColumnsData((prev) => ({
      ...prev,
      [colId]: (prev[colId] || []).map((n) =>
        n.id === note.id ? { ...n, voteCount: oldVoteCount + 1, myVoted: true } : n
      ),
    }));

    try {
      const res = await voteRetroNote(activeSession.id, note.id);
      // Người vote cập nhật giao diện ngay từ response của mình (SCRUM-75)
      if (typeof res.data?.myVotesLeft === 'number') {
        setMyVotesLeft(res.data.myVotesLeft);
      }
      setColumnsData((prev) => ({
        ...prev,
        [colId]: (prev[colId] || []).map((n) =>
          n.id === note.id
            ? {
                ...n,
                voteCount: res.data.voteCount ?? oldVoteCount + 1,
                myVoted: true,
              }
            : n
        ),
      }));
      toast.success('Đã bình chọn ghi chú');
    } catch (err) {
      // Khôi phục khi lỗi và hiện toast thông báo
      setMyVotesLeft(prevVotesLeft);
      setColumnsData((prev) => ({
        ...prev,
        [colId]: (prev[colId] || []).map((n) =>
          n.id === note.id ? { ...n, voteCount: oldVoteCount, myVoted: false } : n
        ),
      }));
      toast.error(err.response?.data?.error || 'Không thể bình chọn ghi chú');
    } finally {
      setVotingNoteId(null);
    }
  };

  return (
    <MainLayout activePage="Retrospective" projectId={projectId}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">rate_review</span>
              <h1 className="text-xl md:text-2xl font-bold font-['Manrope'] text-on-surface">
                Sprint Retrospective
              </h1>
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1">
              Nhìn lại sprint: cùng đánh giá điều làm tốt, cần cải thiện và xác định hành động tiếp theo
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Nút Tạo buổi */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-medium text-sm transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Tạo buổi</span>
            </button>
          </div>
        </div>

        {/* Danh sách buổi (Session Selector Bar) */}
        {sessions.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-container-low p-3 md:p-4 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider shrink-0 mr-1">
                Các buổi:
              </span>
              {sessions.map((session) => {
                const isActive = activeSession?.id === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/10'
                    }`}
                  >
                    <span>{session.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                        session.status === 'OPEN'
                          ? isActive
                            ? 'bg-emerald-400/30 text-white'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isActive
                          ? 'bg-slate-400/30 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {session.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Trạng thái và nút đổi trạng thái buổi */}
            {activeSession && (
              <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-outline-variant/10">
                <span className="text-xs text-on-surface-variant hidden sm:inline">
                  Trạng thái:
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    activeSession.status === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {activeSession.status === 'OPEN' ? '🟢 Đang mở thảo luận' : '🔒 Đã kết thúc'}
                </span>
                {(myProjectRole === 'PO' || myProjectRole === 'SM') && (
                  <button
                    onClick={handleToggleStatus}
                    className="text-xs px-3 py-1 rounded-lg border border-outline-variant/20 hover:bg-surface-container-high text-on-surface-variant font-medium transition-colors"
                  >
                    {activeSession.status === 'OPEN' ? 'Đóng buổi' : 'Mở lại'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trạng thái rỗng khi chưa có buổi Retrospective */}
        {!loading && sessions.length === 0 && (
          <div className="bg-surface-container-low border border-dashed border-outline-variant/30 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">rate_review</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2 font-['Manrope']">
              Chưa có buổi Retrospective nào
            </h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Tạo buổi Retrospective đầu tiên cho dự án để các thành viên cùng đóng góp ý kiến về những gì làm tốt, cần cải thiện và các hành động tiếp theo.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm hover:bg-primary/90 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Tạo buổi Retrospective đầu tiên</span>
            </button>
          </div>
        )}

        {/* Nội dung 3 cột khi có buổi được chọn */}
        {activeSession && (
          <div className="space-y-4">
            {/* Thông tin buổi hiện tại */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">{activeSession.title}</span>
                {activeSession.sprint && (
                  <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-md font-medium">
                    {activeSession.sprint.name}
                  </span>
                )}
                <span className="text-xs opacity-60">
                  Tạo bởi {activeSession.createdBy?.fullName || 'Thành viên'} vào{' '}
                  {new Date(activeSession.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>

              {/* Hiển thị số phiếu bầu còn lại (SCRUM-75) */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold shadow-xs">
                <span className="material-symbols-outlined text-[15px]">how_to_vote</span>
                <span>Còn {myVotesLeft}/3 phiếu</span>
              </div>
            </div>

            {/* 3 Cột Sticky Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {COLUMNS.map((col) => {
                const notes = columnsData[col.id] || [];
                const inputValue = inputs[col.id];

                return (
                  <div
                    key={col.id}
                    className="flex flex-col bg-surface-container-low/60 rounded-2xl border border-outline-variant/10 overflow-hidden shadow-xs"
                  >
                    {/* Header Cột */}
                    <div
                      className={`p-3.5 border-b flex items-center justify-between ${col.colorClasses.headerBg}`}
                    >
                      <div className="flex items-center gap-2 font-['Manrope'] font-bold text-sm text-on-surface">
                        <span className="material-symbols-outlined text-base">{col.icon}</span>
                        <span>{col.title}</span>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.colorClasses.badge}`}
                      >
                        {notes.length}
                      </span>
                    </div>

                    {/* Ô nhập Sticky Note */}
                    <div className="p-3 bg-surface border-b border-outline-variant/10">
                      {activeSession.status === 'CLOSED' ? (
                        <div className="text-center py-2 text-xs text-on-surface-variant bg-surface-container-high/40 rounded-xl">
                          🔒 Buổi đã đóng - không thể thêm note
                        </div>
                      ) : (
                        <div>
                          <textarea
                            value={inputValue}
                            onChange={(e) =>
                              setInputs((prev) => ({ ...prev, [col.id]: e.target.value }))
                            }
                            onKeyDown={(e) => handleKeyDownNote(e, col.id)}
                            placeholder={col.placeholder}
                            rows={2}
                            maxLength={500}
                            className={`w-full text-xs md:text-sm p-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-on-surface resize-none transition-all outline-none ${col.colorClasses.inputFocus}`}
                          />
                          <div className="flex items-center justify-between mt-1 text-[11px] text-on-surface-variant/70">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-on-surface hover:text-primary transition-colors">
                              <input
                                type="checkbox"
                                checked={!!anonymousInputs[col.id]}
                                onChange={(e) =>
                                  setAnonymousInputs((prev) => ({ ...prev, [col.id]: e.target.checked }))
                                }
                                className="rounded border-outline-variant/30 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="font-medium text-xs">Ẩn danh</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <span>Nhấn Enter để gửi</span>
                              <span>{inputValue?.length || 0}/500</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Danh sách Sticky Notes dạng thẻ dán */}
                    <div className="p-3 space-y-3 min-h-[220px] max-h-[600px] overflow-y-auto scrollbar-thin">
                      {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-on-surface-variant/60">
                          <span className="material-symbols-outlined text-3xl mb-1 opacity-40">
                            sticky_note_2
                          </span>
                          <p className="text-xs">Chưa có ghi chú nào</p>
                          {activeSession.status === 'OPEN' && (
                            <p className="text-[11px] mt-0.5 opacity-70">
                              Gõ vào ô trên và nhấn Enter để thêm
                            </p>
                          )}
                        </div>
                      ) : (
                        notes.map((note) => {
                          const isEditing = editingNoteId === note.id;

                          return (
                            <div
                              key={note.id}
                              className={`p-3.5 rounded-xl border transition-all ${col.colorClasses.noteBg} ${col.colorClasses.accent}`}
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveEditNote(note);
                                      } else if (e.key === 'Escape') {
                                        cancelEditNote();
                                      }
                                    }}
                                    rows={2}
                                    maxLength={500}
                                    autoFocus
                                    className="w-full text-xs md:text-sm p-2 rounded-lg border border-outline-variant/30 bg-surface text-on-surface resize-none outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                                    <span>{editingContent.length}/500 (Enter để lưu, Esc để hủy)</span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={cancelEditNote}
                                        className="px-2 py-0.5 text-xs rounded hover:bg-surface-container-high transition-colors text-on-surface-variant"
                                      >
                                        Hủy
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditNote(note)}
                                        disabled={savingEdit || !editingContent.trim()}
                                        className="px-2.5 py-0.5 text-xs rounded bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                                      >
                                        {savingEdit ? 'Đang lưu...' : 'Lưu'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs md:text-sm font-['Inter'] whitespace-pre-wrap break-words leading-relaxed">
                                  {note.content}
                                </p>
                              )}

                              <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-on-surface-variant opacity-80">
                                <div className="flex items-center gap-1.5">
                                  {note.isAnonymous ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant font-medium text-[10px]">
                                      <span className="material-symbols-outlined text-[13px]">visibility_off</span>
                                      <span>Ẩn danh</span>
                                    </span>
                                  ) : (
                                    <>
                                      {note.author?.avatar ? (
                                        <img
                                          src={getAvatarUrl(note.author.avatar)}
                                          alt={note.author.name || note.author.fullName || 'User'}
                                          className="w-4 h-4 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold">
                                          {(note.author?.name || note.author?.fullName || 'U').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="font-medium truncate max-w-[120px]">
                                        {note.author?.name || note.author?.fullName || 'Thành viên'}
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Nút Vote (SCRUM-75) */}
                                  <button
                                    type="button"
                                    onClick={() => handleVoteNote(note)}
                                    disabled={
                                      note.myVoted ||
                                      myVotesLeft <= 0 ||
                                      activeSession.status === 'CLOSED' ||
                                      votingNoteId === note.id
                                    }
                                    title={
                                      note.myVoted
                                        ? 'Bạn đã vote note này rồi'
                                        : myVotesLeft <= 0
                                        ? 'Bạn đã dùng hết 3 phiếu'
                                        : activeSession.status === 'CLOSED'
                                        ? 'Buổi đã đóng'
                                        : 'Bình chọn cho note này'
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all select-none ${
                                      note.myVoted
                                        ? 'bg-primary text-white shadow-xs cursor-default'
                                        : myVotesLeft <= 0 || activeSession.status === 'CLOSED'
                                        ? 'bg-surface-container-high/60 text-on-surface-variant/40 cursor-not-allowed border border-outline-variant/10'
                                        : 'bg-surface-container-high hover:bg-primary/15 text-on-surface-variant hover:text-primary active:scale-95 border border-outline-variant/20'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[13px]">thumb_up</span>
                                    <span className="text-[11px] font-bold">{note.voteCount || 0}</span>
                                  </button>

                                  <span className="text-[10px] shrink-0">
                                    {new Date(note.createdAt).toLocaleTimeString('vi-VN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>

                                  {/* Nút Sửa/Xóa chỉ hiện khi isMine */}
                                  {note.isMine && activeSession.status === 'OPEN' && !isEditing && (
                                    <div className="flex items-center gap-1 ml-1 border-l pl-1.5 border-outline-variant/20">
                                      <button
                                        type="button"
                                        onClick={() => startEditNote(note)}
                                        title="Sửa ghi chú"
                                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-on-surface-variant transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteNote(note)}
                                        title="Xóa ghi chú"
                                        className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Tạo buổi Retrospective */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-low rounded-2xl max-w-md w-full border border-outline-variant/15 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-['Manrope'] font-bold text-lg text-on-surface">
                  Tạo buổi Retrospective
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Tiêu đề buổi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="VD: Retrospective Sprint 1"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-outline-variant/20 bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Sprint liên kết (tùy chọn)
                  </label>
                  <select
                    value={selectedSprintId}
                    onChange={(e) => setSelectedSprintId(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-outline-variant/20 bg-surface text-on-surface outline-none focus:border-primary"
                  >
                    <option value="">-- Không gắn Sprint cụ thể --</option>
                    {sprints.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name} {sp.status === 'ACTIVE' ? '(Đang chạy)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 text-sm bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {creating ? 'Đang tạo...' : 'Tạo buổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

