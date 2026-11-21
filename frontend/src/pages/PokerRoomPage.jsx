import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../context/SocketContext';
import { getPokerRoom, closePokerRoom, savePokerEstimate, finalizePokerEstimate, getAvatarUrl } from '../services/api';
import { toast } from 'react-hot-toast';

// Bộ bài Planning Poker chuẩn Fibonacci theo yêu cầu US-034
const POKER_CARDS = ['0', '1', '2', '3', '5', '8', '13', '20', '?', '☕'];

export default function PokerRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { message, isAccessDenied, projectName }
  const [roomData, setRoomData] = useState(null);
  const [userRole, setUserRole] = useState('MEMBER');
  const [isModerator, setIsModerator] = useState(false);

  // Real-time State từ WebSocket
  const [members, setMembers] = useState([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [myVote, setMyVote] = useState(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [isSavingEstimate, setIsSavingEstimate] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);

  // US-036: Vòng "nói nhanh" khi lệch điểm lớn (Speed Talk 30s)
  const [varianceThreshold, setVarianceThreshold] = useState(5); // Ngưỡng cấu hình mặc định: 5
  const [speedTalkDismissed, setSpeedTalkDismissed] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Thảo luận Realtime (Chat trong phòng Poker)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatQuickTag, setChatQuickTag] = useState(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const chatBottomRef = useRef(null);
  const chatInputRef = useRef(null);

  // US-037: Chốt Story Points từ Poker vào Backlog (PO/SM)
  const [customPoints, setCustomPoints] = useState('');
  const [selectedPointType, setSelectedPointType] = useState('MEDIAN');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizedData, setFinalizedData] = useState(null);

  // 1. Tải thông tin phòng và kiểm tra quyền thành viên Project (AC2)
  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;
    setLoading(true);
    setErrorState(null);

    getPokerRoom(roomCode)
      .then((res) => {
        if (!isMounted) return;
        setRoomData(res.data.room);
        setUserRole(res.data.userRole || 'MEMBER');
        setIsModerator(Boolean(res.data.isModerator));
      })
      .catch((err) => {
        if (!isMounted) return;
        const status = err.response?.status;
        const errData = err.response?.data;
        if (status === 403) {
          // AC2: Người ngoài Project bị từ chối
          setErrorState({
            isAccessDenied: true,
            message: errData?.error || 'Bạn không phải thành viên của dự án này!',
            projectName: errData?.projectName || 'Dự án'
          });
        } else {
          setErrorState({
            isAccessDenied: false,
            message: errData?.error || 'Không tìm thấy phòng Poker hoặc phòng đã đóng.'
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  // 2. Kết nối WebSocket để cập nhật real-time trạng thái phòng (vote, thành viên, lật bài)
  useEffect(() => {
    if (!roomData || !currentUser?.id) return;

    const socket = getSocket();
    const cleanCode = roomCode.toUpperCase().trim();

    // Gửi sự kiện tham gia phòng Poker
    socket.emit('poker:join', {
      roomCode: cleanCode,
      user: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        avatar: currentUser.avatar
      }
    });

    // Lắng nghe cập nhật trạng thái toàn phòng từ server
    const handleStateUpdate = (state) => {
      if (state.roomCode === cleanCode) {
        setMembers(state.members || []);
        setIsRevealed(Boolean(state.isRevealed));

        // Cập nhật lại myVote nếu phòng vừa bị reset
        if (!state.isRevealed) {
          const me = (state.members || []).find(m => m.userId === currentUser.id);
          if (!me || !me.hasVoted) {
            setMyVote(null);
          }
        }
      }
    };

    // Lắng nghe xác nhận lá bài riêng của chính mình từ server
    const handleYourVote = (data) => {
      if (data && 'vote' in data) {
        setMyVote(data.vote);
      }
    };

    // Lắng nghe thông báo lỗi từ server (ví dụ: AC2 - chặn lật bài khi chưa ai vote)
    const handlePokerError = (err) => {
      if (err?.message) {
        toast.error(err.message, { id: 'poker-server-error' });
      }
    };

    // Lắng nghe lịch sử tin nhắn phòng và tin nhắn mới
    const handleChatHistory = (data) => {
      if (data?.messages) {
        setChatMessages(data.messages);
      }
    };

    const handleNewMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    // Lắng nghe sự kiện chốt Story Points & đóng phòng (US-037 AC1)
    const handlePokerFinalized = (data) => {
      setFinalizedData(data);
      setRoomData((prev) => ({
        ...prev,
        status: 'CLOSED',
        userStory: {
          ...prev?.userStory,
          storyPoints: data.storyPoints
        }
      }));
      toast.success(data.message || `Đã chốt ${data.storyPoints} Story Points vào User Story! Phòng đã đóng.`, {
        duration: 5000,
        id: 'poker-finalized'
      });
    };

    socket.on('poker:stateUpdate', handleStateUpdate);
    socket.on('poker:yourVote', handleYourVote);
    socket.on('poker:error', handlePokerError);
    socket.on('poker:chatHistory', handleChatHistory);
    socket.on('poker:newMessage', handleNewMessage);
    socket.on('poker:finalized', handlePokerFinalized);

    return () => {
      socket.emit('poker:leave', { roomCode: cleanCode });
      socket.off('poker:stateUpdate', handleStateUpdate);
      socket.off('poker:yourVote', handleYourVote);
      socket.off('poker:error', handlePokerError);
      socket.off('poker:chatHistory', handleChatHistory);
      socket.off('poker:newMessage', handleNewMessage);
      socket.off('poker:finalized', handlePokerFinalized);
    };
  }, [roomData, currentUser, roomCode]);

  // Tự động cuộn xuống cuối khung chat khi có tin nhắn mới
  useEffect(() => {
    if (!isChatCollapsed) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatCollapsed]);

  // Gửi tin nhắn thảo luận realtime
  const handleSendChatMessage = (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const socket = getSocket();
    socket.emit('poker:sendMessage', {
      roomCode: roomCode.toUpperCase().trim(),
      content: chatInput.trim(),
      tag: chatQuickTag,
      sender: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        avatar: currentUser.avatar
      }
    });

    setChatInput('');
    setChatQuickTag(null);
  };

  // Chọn gợi ý tag nhanh
  const handleSelectQuickTag = (tagText) => {
    setChatQuickTag(tagText);
    setChatInput((prev) => {
      if (!prev) return `[${tagText}] `;
      if (prev.startsWith('[')) return prev.replace(/^\[.*?\]\s*/, `[${tagText}] `);
      return `[${tagText}] ${prev}`;
    });
    chatInputRef.current?.focus();
  };

  // Số lượng thành viên đã chọn bài trong phòng
  const votedCount = useMemo(() => {
    return members.filter(m => m.hasVoted).length;
  }, [members]);

  // AC1 & AC2: Hành động chọn một lá bài và đổi lá bài trước khi Reveal
  const handleSelectCard = (card) => {
    if (isRevealed) {
      toast.error('Vòng đánh giá đã lật bài, không thể chọn hoặc đổi lá bài lúc này!');
      return;
    }
    const isChanging = myVote !== null && myVote !== card;
    const newVote = myVote === card ? null : card;
    setMyVote(newVote);

    const socket = getSocket();
    socket.emit('poker:vote', {
      roomCode: roomCode.toUpperCase().trim(),
      vote: newVote
    });

    if (newVote === null) {
      toast('Đã hủy chọn lá bài', { icon: '↩️' });
    } else if (isChanging) {
      toast.success(`Đã đổi lựa chọn sang lá: ${card}`, { id: 'poker-vote' });
    } else {
      toast.success(`Đã chọn lá: ${card} (ẩn với người khác)`, { id: 'poker-vote' });
    }
  };

  // AC1 & AC2: Hành động Lật bài (SM/PO)
  const handleRevealCards = () => {
    // AC2: Chặn lật bài khi chưa có lượt vote nào
    if (votedCount === 0) {
      toast.error('Chưa có ai vote! Không thể lật bài khi chưa có lượt vote nào.', { id: 'no-votes-error' });
      return;
    }

    if (votedCount === 1) {
      toast('Khuyến nghị: Cần ít nhất 2 thành viên vote để so sánh độ lệch cao - thấp.', { icon: 'ℹ️', id: 'few-votes' });
    }

    const socket = getSocket();
    socket.emit('poker:reveal', {
      roomCode: roomCode.toUpperCase().trim()
    });
    toast.success('Đã lật bài cả phòng!');
  };

  // Hành động Vòng mới (Reset)
  const handleResetRound = () => {
    setMyVote(null);
    setSpeedTalkDismissed(false);
    setIsTimerRunning(false);
    setTimerSeconds(30);
    const socket = getSocket();
    socket.emit('poker:reset', {
      roomCode: roomCode.toUpperCase().trim()
    });
    toast('Bắt đầu vòng đánh giá mới', { icon: '🔄' });
  };

  // Sao chép mã phòng
  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
    setCopiedCode(true);
    toast.success(`Đã sao chép mã phòng: ${roomCode.toUpperCase()}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // US-037 AC1 & AC2: Chốt Story Points từ Poker vào Backlog & Đóng phòng (Product Owner / SM)
  const handleFinalizePoints = async (pointsToFinalize) => {
    // AC2: Given chưa Reveal -> When Chốt -> Then bị từ chối
    if (!isRevealed) {
      toast.error('Không thể chốt điểm khi chưa Reveal các lá bài! Vui lòng nhấn Lật bài trước khi chốt.', {
        id: 'poker-not-revealed-error'
      });
      return;
    }

    if (!isModerator && userRole !== 'PO' && userRole !== 'SM') {
      toast.error('Chỉ Product Owner hoặc Scrum Master mới có quyền chốt điểm vào Backlog!');
      return;
    }

    const pointsNum = parseInt(pointsToFinalize, 10);
    if (isNaN(pointsNum) || pointsNum < 0) {
      toast.error('Vui lòng nhập hoặc chọn số Story Points hợp lệ (>= 0)!');
      return;
    }

    setIsFinalizing(true);
    try {
      const res = await finalizePokerEstimate(roomData.id, {
        storyPoints: pointsNum,
        isRevealed: true
      });

      toast.success(`Đã chốt ${pointsNum} Story Points vào User Story! Phòng Poker đã đóng.`, {
        duration: 4000
      });

      setFinalizedData(res.data);
      setRoomData((prev) => ({
        ...prev,
        status: 'CLOSED',
        userStory: {
          ...prev?.userStory,
          storyPoints: pointsNum
        }
      }));
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Lỗi khi chốt điểm Story Points';
      toast.error(errMsg);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Lưu Story Points vào US (SM/PO)
  const handleSavePoints = async (points) => {
    return handleFinalizePoints(points);
  };

  // Đóng phòng Poker
  const handleCloseRoom = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đóng phòng Planning Poker này?')) return;
    setIsClosingRoom(true);
    try {
      await closePokerRoom(roomData.id);
      toast.success('Đã đóng phòng Poker');
      navigate(`/projects/${roomData.projectId}/board`);
    } catch (err) {
      toast.error('Lỗi khi đóng phòng Poker');
    } finally {
      setIsClosingRoom(false);
    }
  };

  // AC1: Tính toán thống kê điểm số & độ lệch cao - thấp (max - min) khi lật bài
  const statistics = useMemo(() => {
    if (!isRevealed || members.length === 0) return null;

    // Lọc các vote dạng số hợp lệ
    const numericEntries = members
      .filter(m => m.hasVoted && m.vote !== null && m.vote !== undefined && !isNaN(parseFloat(m.vote)))
      .map(m => ({
        userId: m.userId,
        fullName: m.fullName || 'Thành viên',
        avatar: m.avatar || null,
        val: parseFloat(m.vote)
      }));

    // Lọc các vote đặc biệt (? hoặc ☕)
    const specialVotes = members
      .filter(m => m.hasVoted && (m.vote === '?' || m.vote === '☕'))
      .map(m => ({ userId: m.userId, fullName: m.fullName || 'Thành viên', avatar: m.avatar, vote: m.vote }));

    if (numericEntries.length === 0) {
      return {
        hasNumeric: false,
        count: members.filter(m => m.hasVoted).length,
        average: 'N/A',
        consensus: specialVotes.length > 0 ? specialVotes[0].vote : 'N/A',
        median: 'N/A',
        max: null,
        min: null,
        diff: null,
        isConsensus: true,
        maxVoters: [],
        minVoters: [],
        highestVoter: null,
        lowestVoter: null,
        specialVotes
      };
    }

    const values = numericEntries.map(e => e.val);
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = (sum / values.length).toFixed(1);

    // US-037: Tính Trung vị (Median)
    const sortedValues = [...values].sort((a, b) => a - b);
    const midIndex = Math.floor(sortedValues.length / 2);
    let median;
    if (sortedValues.length % 2 !== 0) {
      median = sortedValues[midIndex];
    } else {
      const midAvg = (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2;
      median = Number.isInteger(midAvg) ? midAvg : Number(midAvg.toFixed(1));
    }

    // AC1: Tính Max, Min và Độ lệch cao - thấp (Spread = Max - Min)
    const max = Math.max(...values);
    const min = Math.min(...values);
    const diff = Number((max - min).toFixed(1));

    const maxVoters = numericEntries.filter(e => e.val === max).map(e => e.fullName);
    const minVoters = numericEntries.filter(e => e.val === min).map(e => e.fullName);

    // US-036 AC1: Lấy cụ thể 1 người vote thấp nhất và 1 người vote cao nhất để highlight và mời phát biểu
    const highestVoter = numericEntries.find(e => e.val === max) || null;
    const lowestVoter = numericEntries.find(e => e.val === min) || null;

    // Tính điểm phổ biến nhất (Consensus / Mode)
    const frequency = {};
    values.forEach(v => {
      frequency[v] = (frequency[v] || 0) + 1;
    });
    let maxFreq = 0;
    let mode = values[0];
    for (const key in frequency) {
      if (frequency[key] > maxFreq) {
        maxFreq = frequency[key];
        mode = Number(key);
      }
    }

    return {
      hasNumeric: true,
      count: values.length,
      average: avg,
      consensus: mode,
      median, // US-037: Trung vị
      max,
      min,
      diff, // max - min
      isConsensus: diff === 0,
      maxVoters,
      minVoters,
      highestVoter, // 1 người vote cao nhất
      lowestVoter,  // 1 người vote thấp nhất
      specialVotes
    };
  }, [isRevealed, members]);

  // US-037: Tự động khởi tạo giá trị điểm đề xuất ban đầu (Trung vị) khi Reveal
  useEffect(() => {
    if (isRevealed && statistics?.hasNumeric && statistics.median !== undefined && statistics.median !== 'N/A') {
      if (customPoints === '' || customPoints === null) {
        setCustomPoints(statistics.median);
      }
    }
  }, [isRevealed, statistics?.median]);

  // US-036: Quản lý timer đếm ngược 30 giây (chỉ UI timer - AC1)
  useEffect(() => {
    let timer = null;
    if (isTimerRunning && timerSeconds > 0) {
      timer = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTimerRunning, timerSeconds]);

  // US-036 AC1 & AC2: Khi Reveal, kiểm tra độ lệch so với ngưỡng
  useEffect(() => {
    if (isRevealed && statistics?.hasNumeric && statistics.diff !== null) {
      if (statistics.diff >= varianceThreshold) {
        // AC1: Độ lệch >= ngưỡng -> Tự động hiện prompt nói nhanh + đếm ngược 30s
        setSpeedTalkDismissed(false);
        setTimerSeconds(30);
        setIsTimerRunning(true);
      } else {
        // AC2: Độ lệch < ngưỡng -> Không hiện prompt nói nhanh
        setSpeedTalkDismissed(true);
        setIsTimerRunning(false);
      }
    } else {
      setIsTimerRunning(false);
      setTimerSeconds(30);
    }
  }, [isRevealed, statistics?.diff, varianceThreshold]);

  // =========================================================================
  // GIAO DIỆN KHI ĐANG TẢI
  // =========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <h3 className="font-bold text-base text-on-surface">Đang kết nối vào phòng Planning Poker...</h3>
        <p className="text-xs text-on-surface-variant mt-1">Đang xác thực quyền thành viên dự án</p>
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN AC2: TỪ CHỐI NGƯỜI NGOÀI DỰ ÁN
  // =========================================================================
  if (errorState?.isAccessDenied) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-3xl shadow-2xl border border-error/20 text-center">
          <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-5 shadow-sm">
            <span className="material-symbols-outlined text-3xl">block</span>
          </div>
          <span className="inline-block px-3 py-1 bg-error/10 text-error text-[11px] font-black uppercase tracking-widest rounded-full mb-3">
            Quyền truy cập bị từ chối (403)
          </span>
          <h2 className="text-xl font-bold text-on-surface mb-2">Không có quyền vào phòng</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed mb-6 font-medium">
            {errorState.message}
          </p>

          <div className="p-4 bg-surface-container rounded-2xl mb-6 text-left border border-outline-variant/30">
            <div className="text-[10px] uppercase font-bold text-outline tracking-wider mb-1">Mã phòng bạn vừa nhập:</div>
            <div className="font-mono font-bold text-primary text-base">{roomCode?.toUpperCase()}</div>
            <div className="text-[11px] text-on-surface-variant mt-2">
              Dự án này là nội bộ. Vui lòng liên hệ Scrum Master hoặc Project Owner để được mời vào dự án trước khi tham gia đánh giá Poker.
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 bg-primary text-white rounded-2xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            <span>Quay về Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN KHI PHÒNG KHÔNG TỒN TẠI HOẶC LỖI KHÁC
  // =========================================================================
  if (errorState || !roomData) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-3xl shadow-xl border border-outline-variant/20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">sentiment_dissatisfied</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface mb-2">Không thể truy cập</h2>
          <p className="text-xs text-on-surface-variant mb-6">{errorState?.message || 'Phòng không tồn tại'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all"
          >
            Quay về Dashboard
          </button>
        </div>
      </div>
    );
  }

  const story = roomData.userStory || {};
  const project = roomData.project || {};

  // =========================================================================
  // GIAO DIỆN PHÒNG POKER CHÍNH (AC1 & AC2 HỢP LỆ)
  // =========================================================================
  return (
    <div className="min-h-screen bg-surface flex flex-col font-['Inter'] text-on-surface">
      {/* 1. TOP BAR CỦA PHÒNG POKER */}
      <header className="h-16 px-4 md:px-8 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${project.id}/board`)}
            className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors"
            title="Trở về Task Board"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                {project.name || 'Dự án'}
              </span>
              <span className="text-xs font-bold text-on-surface truncate max-w-[200px] md:max-w-sm">
                {roomData.name}
              </span>
            </div>
            <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 mt-0.5">
              <span>Phòng:</span>
              <span className="font-mono font-bold text-primary">{roomCode.toUpperCase()}</span>
              <button
                onClick={handleCopyRoomCode}
                className="hover:text-primary transition-colors inline-flex items-center ml-1"
                title="Sao chép mã"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {copiedCode ? 'done' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2 md:gap-3">
          {roomData.status === 'CLOSED' || finalizedData ? (
            <div className="flex items-center gap-1.5 bg-neutral-500/10 text-neutral-600 px-3 py-1 rounded-full text-xs font-bold border border-neutral-500/20">
              <span className="w-2 h-2 rounded-full bg-neutral-500" />
              <span>Đã đóng (Closed)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Đang diễn ra</span>
            </div>
          )}

          {isModerator && roomData.status !== 'CLOSED' && !finalizedData && (
            <button
              onClick={handleCloseRoom}
              disabled={isClosingRoom}
              className="px-3.5 py-1.5 bg-error/10 text-error hover:bg-error hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-error/20"
            >
              <span className="material-symbols-outlined text-sm">lock</span>
              <span className="hidden md:inline">Đóng phòng</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. NỘI DUNG CHÍNH */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-6">
        {/* CỘT TRÁI: USER STORY ĐANG ESTIMATE */}
        <div className="lg:w-2/5 flex flex-col gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-outline">
                User Story đang đánh giá
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                story.priority === 'HIGH' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
              }`}>
                Ưu tiên: {story.priority || 'MEDIUM'}
              </span>
            </div>

            <h2 className="text-xl font-bold text-on-surface leading-snug mb-3">
              {story.title || 'Tiêu đề User Story'}
            </h2>

            <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap mb-6 bg-surface-container/50 p-4 rounded-2xl border border-outline-variant/10">
              {story.description || 'Chưa có mô tả chi tiết cho User Story này.'}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
              <div className="text-xs font-medium text-on-surface-variant">
                Story Points Backlog:
              </div>
              <div className="text-sm font-black px-3 py-1 bg-primary/10 text-primary rounded-xl flex items-center gap-1.5">
                <span>{story.storyPoints !== null && story.storyPoints !== undefined ? `${story.storyPoints} SP` : 'Chưa gán'}</span>
                {(roomData.status === 'CLOSED' || finalizedData) && (
                  <span className="material-symbols-outlined text-xs text-emerald-600 font-bold" title="Điểm đã chốt vào Backlog">check_circle</span>
                )}
              </div>
            </div>
          </div>

          {/* HỘP KẾT QUẢ SAU KHI LẬT BÀI (AC1: max - min + người vote cao/thấp) */}
          {isRevealed && statistics && (
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">analytics</span>
                  Kết quả đánh giá Poker
                </h4>
                {statistics.hasNumeric && (
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    statistics.isConsensus
                      ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
                  }`}>
                    {statistics.isConsensus ? 'Đồng thuận 100%' : 'Cần thảo luận'}
                  </span>
                )}
              </div>

              {/* AC1: KHỐI ĐỘ CHÊNH LỆCH CAO - THẤP (MAX - MIN) */}
              {statistics.hasNumeric && statistics.diff !== null ? (
                <div className={`p-4 rounded-2xl border mb-4 text-center ${
                  statistics.isConsensus 
                    ? 'bg-emerald-500/5 border-emerald-500/20' 
                    : 'bg-amber-500/5 border-amber-500/30'
                }`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/80">
                    Độ chênh lệch cao - thấp (Max - Min)
                  </div>

                  <div className="flex items-baseline justify-center gap-1.5 my-1.5">
                    <span className="text-3xl font-black font-mono text-on-surface">
                      {statistics.diff}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant">SP</span>
                    <span className="text-xs font-mono font-medium text-outline ml-1">
                      (Max {statistics.max} - Min {statistics.min})
                    </span>
                  </div>

                  {/* Chi tiết thành viên vote cao nhất & thấp nhất */}
                  {!statistics.isConsensus ? (
                    <div className="text-left pt-2.5 mt-2 border-t border-amber-500/20 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-rose-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          Cao nhất ({statistics.max} SP):
                        </span>
                        <span className="font-semibold text-on-surface truncate text-right">
                          {statistics.maxVoters.join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-blue-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          Thấp nhất ({statistics.min} SP):
                        </span>
                        <span className="font-semibold text-on-surface truncate text-right">
                          {statistics.minVoters.join(', ')}
                        </span>
                      </div>
                      <p className="text-[11px] italic text-amber-800/80 pt-1 border-t border-amber-500/10">
                        💡 Gợi ý Scrum Master: Mời người vote cao nhất ({statistics.max} SP) và thấp nhất ({statistics.min} SP) chia sẻ góc nhìn để cả nhóm đạt đồng thuận.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-emerald-700 pt-1 flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      <span>Nhóm hoàn toàn nhất trí số điểm {statistics.consensus} SP (Độ lệch: 0 SP)</span>
                    </p>
                  )}
                </div>
              ) : null}

              {/* CÁC CHỈ SỐ THỐNG KÊ (TRUNG VỊ, PHỔ BIẾN NHẤT, TRUNG BÌNH) - US-037 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* 1. Điểm Trung vị (Median) */}
                <div className="bg-primary/5 p-3 rounded-2xl border border-primary/15 text-center">
                  <div className="text-[9px] uppercase font-bold text-outline">Trung vị (Median)</div>
                  <div className="text-xl font-black text-primary mt-0.5">{statistics.median}</div>
                </div>

                {/* 2. Điểm Phổ biến nhất (Consensus / Mode) */}
                <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/15 text-center">
                  <div className="text-[9px] uppercase font-bold text-outline">Phổ biến nhất</div>
                  <div className="text-xl font-black text-emerald-600 mt-0.5">{statistics.consensus}</div>
                </div>

                {/* 3. Điểm Trung bình (Average) */}
                <div className="bg-amber-500/5 p-3 rounded-2xl border border-amber-500/15 text-center">
                  <div className="text-[9px] uppercase font-bold text-outline">Trung bình</div>
                  <div className="text-xl font-black text-amber-600 mt-0.5">{statistics.average}</div>
                </div>
              </div>

              {/* KHU VỰC CHỐT STORY POINTS VÀO BACKLOG (DÀNH CHO PRODUCT OWNER / SM) - US-037 AC1 & AC2 */}
              {isModerator && (
                <div className="space-y-3 pt-3 border-t border-outline-variant/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">gavel</span>
                      <span>Chốt Story Points vào Backlog</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      PO / SM
                    </span>
                  </div>

                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Chọn điểm trung vị, phổ biến nhất hoặc tự nhập điểm để lưu vào Backlog và đóng phòng.
                  </p>

                  {/* 3 Nút gợi ý nhanh */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Nút 1: Trung vị (Median) */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPoints(statistics.median);
                        setSelectedPointType('MEDIAN');
                      }}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        selectedPointType === 'MEDIAN'
                          ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-primary/30'
                          : 'bg-surface-container/40 hover:bg-surface-container text-on-surface border-outline-variant/30'
                      }`}
                    >
                      <div className="text-[9px] uppercase font-bold opacity-80">Trung vị</div>
                      <div className="text-sm font-black font-mono mt-0.5">{statistics.median} SP</div>
                    </button>

                    {/* Nút 2: Chọn nhiều nhất (Mode) */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPoints(statistics.consensus);
                        setSelectedPointType('CONSENSUS');
                      }}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        selectedPointType === 'CONSENSUS'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/30'
                          : 'bg-surface-container/40 hover:bg-surface-container text-on-surface border-outline-variant/30'
                      }`}
                    >
                      <div className="text-[9px] uppercase font-bold opacity-80">Phổ biến nhất</div>
                      <div className="text-sm font-black font-mono mt-0.5">{statistics.consensus} SP</div>
                    </button>

                    {/* Nút 3: Trung bình làm tròn */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPoints(Math.round(parseFloat(statistics.average)));
                        setSelectedPointType('AVERAGE');
                      }}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        selectedPointType === 'AVERAGE'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/30'
                          : 'bg-surface-container/40 hover:bg-surface-container text-on-surface border-outline-variant/30'
                      }`}
                    >
                      <div className="text-[9px] uppercase font-bold opacity-80">Trung bình</div>
                      <div className="text-sm font-black font-mono mt-0.5">{Math.round(parseFloat(statistics.average))} SP</div>
                    </button>
                  </div>

                  {/* Nhập số tự chọn & Nút Chốt */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <div className="flex-1 flex items-center bg-surface border border-outline-variant/40 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
                      <span className="text-[11px] font-bold text-on-surface-variant mr-2 whitespace-nowrap">
                        Điểm chốt:
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customPoints}
                        onChange={(e) => {
                          setCustomPoints(e.target.value);
                          setSelectedPointType('CUSTOM');
                        }}
                        placeholder="Nhập SP..."
                        className="w-full bg-transparent font-mono font-black text-sm text-primary focus:outline-none"
                      />
                      <span className="text-xs font-bold text-outline">SP</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFinalizePoints(customPoints)}
                      disabled={isFinalizing || customPoints === '' || customPoints === null || roomData.status === 'CLOSED'}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0 ${
                        isFinalizing || customPoints === '' || customPoints === null || roomData.status === 'CLOSED'
                          ? 'bg-surface-container text-outline opacity-50 cursor-not-allowed'
                          : 'bg-primary text-white hover:bg-primary/90 active:scale-95 cursor-pointer'
                      }`}
                      title={!isRevealed ? "Cần Lật bài (Reveal) trước khi Chốt điểm" : "Chốt Story Points vào Backlog & Đóng phòng"}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {roomData.status === 'CLOSED' ? 'lock' : 'task_alt'}
                      </span>
                      <span>
                        {roomData.status === 'CLOSED' 
                          ? 'Đã chốt & Đóng phòng' 
                          : isFinalizing 
                          ? 'Đang chốt...' 
                          : 'Chốt Story Points & Đóng'}
                      </span>
                    </button>
                  </div>

                  {roomData.status === 'CLOSED' && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs font-medium flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                      <span>Story Points đã được đồng bộ vào Backlog (Mã phiên: #{finalizedData?.pokerSessionId || roomData.id}).</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. THẢO LUẬN REALTIME (CHAT PHÒNG POKER) */}
          <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/20 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">forum</span>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">
                    Thảo luận Realtime
                  </h4>
                  <span className="text-[10px] text-on-surface-variant font-medium">
                    Giải thích lý do đánh giá cao &amp; thấp
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {chatMessages.length} tin nhắn
                  </span>
                )}
                <button
                  onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                  title={isChatCollapsed ? "Mở rộng khung chat" : "Thu gọn khung chat"}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isChatCollapsed ? "expand_more" : "expand_less"}
                  </span>
                </button>
              </div>
            </div>

            {!isChatCollapsed && (
              <>
                {/* Khu vực danh sách tin nhắn cuộn */}
                <div className="h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin mb-3">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant/60 py-6 px-4">
                      <span className="material-symbols-outlined text-3xl mb-1.5 text-primary/30">
                        chat_bubble_outline
                      </span>
                      <p className="text-xs font-bold text-on-surface">Chưa có thảo luận nào</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Nhập lý do tại sao bạn cho điểm này để cả nhóm cùng hiểu góc nhìn của bạn!
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      if (msg.isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center my-1.5">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant/80 border border-outline-variant/20 shadow-2xs">
                              {msg.content}
                            </span>
                          </div>
                        );
                      }

                      const isMe = msg.userId === currentUser?.id;
                      const numVote = parseFloat(msg.vote);
                      const isHigh = isRevealed && statistics?.hasNumeric && numVote === statistics.max;
                      const isLow = isRevealed && statistics?.hasNumeric && numVote === statistics.min;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} text-xs`}
                        >
                          {/* Tên + Badge Vote + Giờ */}
                          <div className={`flex items-center gap-1.5 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="font-bold text-[11px] text-on-surface">
                              {msg.fullName} {isMe ? '(Tôi)' : ''}
                            </span>

                            {/* Badge điểm vote của người gửi */}
                            {msg.vote !== null && msg.vote !== undefined && (
                              <span className={`text-[9px] font-black font-mono px-1.5 py-0.2 rounded-full ${
                                isHigh
                                  ? 'bg-rose-500 text-white'
                                  : isLow
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-primary/10 text-primary'
                              }`}>
                                {msg.vote} SP {isHigh ? '(Cao nhất)' : isLow ? '(Thấp nhất)' : ''}
                              </span>
                            )}

                            {/* Tag lý do */}
                            {msg.tag && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 border border-amber-500/20">
                                {msg.tag}
                              </span>
                            )}

                            <span className="text-[9px] text-outline">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Bong bóng tin nhắn */}
                          <div
                            className={`p-2.5 rounded-2xl max-w-[85%] break-words leading-relaxed shadow-2xs ${
                              isMe
                                ? 'bg-primary text-white rounded-tr-xs'
                                : 'bg-surface-container text-on-surface rounded-tl-xs border border-outline-variant/15'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Các gợi ý lý do nhanh (Quick Chips) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-2">
                  <span className="text-[10px] font-bold text-outline shrink-0">Gợi ý:</span>
                  {[
                    { label: '🚀 Đơn giản / Có sẵn', tag: 'Đơn giản' },
                    { label: '⚠️ Phức tạp / Rủi ro', tag: 'Rủi ro' },
                    { label: '🔗 Phụ thuộc API bên ngoài', tag: 'Phụ thuộc' },
                    { label: '❓ Chưa rõ yêu cầu', tag: 'Chưa rõ' }
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleSelectQuickTag(item.tag)}
                      className={`text-[10px] font-bold px-2 py-0.8 rounded-lg shrink-0 border transition-all ${
                        chatQuickTag === item.tag
                          ? 'bg-amber-500/20 text-amber-800 border-amber-500/40 shadow-xs'
                          : 'bg-surface-container/60 hover:bg-surface-container text-on-surface-variant border-outline-variant/20'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Ô nhập tin nhắn */}
                <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Nhập lý do bạn đánh giá hoặc trao đổi..."
                    className="flex-1 bg-surface text-on-surface px-3 py-2 rounded-xl text-xs border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                      chatInput.trim()
                        ? 'bg-primary text-white hover:bg-primary/90 shadow-sm active:scale-95'
                        : 'bg-surface-container text-outline opacity-40 cursor-not-allowed'
                    }`}
                    title="Gửi tin nhắn"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: BÀN POKER + THÀNH VIÊN VÀ BỘ BÀI */}
        <div className="lg:w-3/5 flex flex-col gap-6">
          {/* 1. KHU VỰC THÀNH VIÊN THAM GIA */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm flex-1 flex flex-col">
            {/* US-037 AC1: BANNER THÔNG BÁO KHI PHÒNG POKER ĐÃ CHỐT VÀO BACKLOG */}
            {(roomData.status === 'CLOSED' || finalizedData) && (
              <div className="mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 border-2 border-emerald-500/40 shadow-sm animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                      <span className="material-symbols-outlined text-xl">verified</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-on-surface">
                          Đã chốt {story.storyPoints ?? finalizedData?.storyPoints} Story Points vào Backlog
                        </h4>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                          Closed
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Phiên Poker <span className="font-mono font-bold text-primary">#{finalizedData?.pokerSessionId || roomData.id}</span> đã hoàn tất. Điểm số đã đồng bộ chính xác với Backlog của dự án.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/projects/${project.id}/board`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">dashboard</span>
                    <span>Xem Backlog</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">group</span>
                <h3 className="font-bold text-sm text-on-surface">Thành viên trong phòng ({members.length})</h3>
              </div>

              {/* Nút lật bài & vòng mới cho Moderator (AC2: Chặn lật bài khi chưa ai vote) */}
              {isModerator && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* US-036: Cấu hình ngưỡng độ lệch kích hoạt vòng nói nhanh */}
                  <div className="flex items-center gap-1.5 bg-surface-container/60 px-2.5 py-1.5 rounded-xl border border-outline-variant/20 text-xs">
                    <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-amber-600">tune</span>
                      <span className="hidden sm:inline">Ngưỡng nói nhanh:</span>
                    </span>
                    <select
                      value={varianceThreshold}
                      onChange={(e) => setVarianceThreshold(Number(e.target.value))}
                      className="bg-surface text-on-surface font-bold text-xs rounded-lg px-2 py-0.5 border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      title="Chọn ngưỡng chênh lệch Max - Min để tự động kích hoạt vòng nói nhanh 30s"
                    >
                      <option value={3}>≥ 3 SP</option>
                      <option value={5}>≥ 5 SP (Mặc định)</option>
                      <option value={8}>≥ 8 SP</option>
                      <option value={10}>≥ 10 SP</option>
                    </select>
                  </div>

                  {!isRevealed ? (
                    <button
                      onClick={handleRevealCards}
                      disabled={votedCount === 0}
                      title={votedCount === 0 ? "Chưa có ai vote! Hãy chờ thành viên chọn bài để lật." : `Đã có ${votedCount} thành viên vote. Nhấn để lật bài.`}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                        votedCount === 0
                          ? "bg-surface-container text-outline opacity-40 cursor-not-allowed border border-outline-variant/30"
                          : "bg-primary text-white hover:bg-primary/90 active:scale-95 cursor-pointer shadow-md"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>Lật bài {votedCount > 0 ? `(${votedCount})` : ''}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResetRound}
                      disabled={roomData.status === 'CLOSED'}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        roomData.status === 'CLOSED'
                          ? 'bg-surface-container text-outline opacity-40 cursor-not-allowed'
                          : 'bg-surface-container-high hover:bg-primary/10 hover:text-primary text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      <span>Vòng mới</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* US-036 AC1 & AC2: Prompt Vòng "nói nhanh" 30 giây khi max - min >= ngưỡng */}
            {isRevealed && statistics?.hasNumeric && statistics.diff !== null && statistics.diff >= varianceThreshold && !speedTalkDismissed && (
              <div className="mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-500/40 shadow-md animate-in slide-in-from-top-3 duration-300 relative">
                {/* Header của Prompt */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-xl animate-pulse">campaign</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-on-surface">
                          Vòng &quot;Nói Nhanh&quot; (Speed Talk)
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 border border-rose-500/20">
                          Độ lệch {statistics.diff} SP (≥ {varianceThreshold} SP)
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                        Ai thấp &amp; ai cao nói lý do 30 giây để tìm tiếng nói chung
                      </p>
                    </div>
                  </div>

                  {/* Nút đóng / bỏ qua prompt */}
                  <button
                    onClick={() => setSpeedTalkDismissed(true)}
                    className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                    title="Đóng vòng nói nhanh"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                {/* 3 Cột: Người vote thấp nhất - Đồng hồ 30s - Người vote cao nhất */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-surface-container-lowest/80 p-3.5 rounded-xl border border-amber-500/20">
                  {/* Cột 1: Người vote thấp nhất */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50/50 border border-blue-200">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ring-2 ring-blue-400">
                      {statistics.lowestVoter?.avatar ? (
                        <img src={getAvatarUrl(statistics.lowestVoter.avatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        statistics.lowestVoter?.fullName?.charAt(0).toUpperCase() || 'L'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-600 text-white">
                          Thấp nhất
                        </span>
                        <span className="font-mono font-bold text-blue-700 text-xs">
                          {statistics.lowestVoter?.val} SP
                        </span>
                      </div>
                      <div className="text-xs font-bold text-on-surface truncate mt-0.5">
                        {statistics.lowestVoter?.fullName || 'Thành viên'}
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="text-[10px] text-blue-600/80 italic truncate">
                          Giải thích tại sao đánh giá thấp
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChatCollapsed(false);
                            handleSelectQuickTag("Lý do thấp");
                          }}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors shrink-0 shadow-2xs"
                          title="Mở chat và gắn tag lý do thấp"
                        >
                          <span className="material-symbols-outlined text-[11px]">chat</span>
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Countdown 30s UI Timer (AC1) */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-surface-container/40">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black font-mono tracking-tight ${
                        timerSeconds <= 5 ? 'text-rose-600 animate-pulse' : 'text-on-surface'
                      }`}>
                        {timerSeconds}
                      </span>
                      <span className="text-[11px] font-bold text-on-surface-variant">giây</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-[140px] h-1.5 bg-surface-container-high rounded-full overflow-hidden my-1.5">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          timerSeconds <= 5 ? 'bg-rose-500' : 'bg-primary'
                        }`}
                        style={{ width: `${(timerSeconds / 30) * 100}%` }}
                      />
                    </div>

                    {/* Nút điều khiển Timer */}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm ${
                          isTimerRunning
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-primary text-white hover:bg-primary/90'
                        }`}
                        title={isTimerRunning ? 'Tạm dừng đếm ngược' : 'Bắt đầu đếm ngược'}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isTimerRunning ? 'pause' : 'play_arrow'}
                        </span>
                        <span>{isTimerRunning ? 'Dừng' : 'Bắt đầu'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setTimerSeconds(30);
                          setIsTimerRunning(true);
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors flex items-center gap-0.5"
                        title="Đặt lại 30 giây"
                      >
                        <span className="material-symbols-outlined text-[13px]">replay</span>
                        <span>30s</span>
                      </button>
                    </div>

                    {timerSeconds === 0 && (
                      <span className="text-[10px] font-bold text-rose-600 mt-1 animate-bounce">
                        ⏰ Hết thời gian 30s!
                      </span>
                    )}
                  </div>

                  {/* Cột 3: Người vote cao nhất */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-rose-50/50 border border-rose-200">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ring-2 ring-rose-400">
                      {statistics.highestVoter?.avatar ? (
                        <img src={getAvatarUrl(statistics.highestVoter.avatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        statistics.highestVoter?.fullName?.charAt(0).toUpperCase() || 'H'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-600 text-white">
                          Cao nhất
                        </span>
                        <span className="font-mono font-bold text-rose-700 text-xs">
                          {statistics.highestVoter?.val} SP
                        </span>
                      </div>
                      <div className="text-xs font-bold text-on-surface truncate mt-0.5">
                        {statistics.highestVoter?.fullName || 'Thành viên'}
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="text-[10px] text-rose-600/80 italic truncate">
                          Giải thích tại sao đánh giá cao
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChatCollapsed(false);
                            handleSelectQuickTag("Lý do cao");
                          }}
                          className="text-[10px] font-bold text-rose-700 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors shrink-0 shadow-2xs"
                          title="Mở chat và gắn tag lý do cao"
                        >
                          <span className="material-symbols-outlined text-[11px]">chat</span>
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Danh sách các lá bài thành viên trên bàn Poker */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {members.map((member) => {
                const isMe = member.userId === currentUser?.id;
                // Kiểm tra xem thành viên này đã vote chưa
                const hasVoted = isMe ? (myVote !== null && myVote !== undefined) : member.hasVoted;
                const numVote = parseFloat(member.vote);
                const isMax = isRevealed && statistics?.hasNumeric && !statistics.isConsensus && numVote === statistics.max;
                const isMin = isRevealed && statistics?.hasNumeric && !statistics.isConsensus && numVote === statistics.min;

                // US-036 AC1: Highlight 1 người thấp + 1 người cao khi lệch >= ngưỡng
                const isSpeedTalkHigh = isRevealed && statistics?.hasNumeric && statistics.diff !== null && statistics.diff >= varianceThreshold && member.userId === statistics.highestVoter?.userId;
                const isSpeedTalkLow = isRevealed && statistics?.hasNumeric && statistics.diff !== null && statistics.diff >= varianceThreshold && member.userId === statistics.lowestVoter?.userId;

                return (
                  <div
                    key={member.userId}
                    className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${
                      isSpeedTalkHigh
                        ? 'bg-rose-500/10 border-rose-500/60 ring-4 ring-rose-400/50 shadow-xl scale-105'
                        : isSpeedTalkLow
                        ? 'bg-blue-500/10 border-blue-500/60 ring-4 ring-blue-400/50 shadow-xl scale-105'
                        : hasVoted 
                        ? 'bg-primary/5 border-primary/30 shadow-sm' 
                        : 'bg-surface-container/30 border-outline-variant/15 opacity-80'
                    }`}
                  >
                    {/* Lá bài úp hoặc lật */}
                    <div className="w-14 h-20 mb-3 rounded-xl flex items-center justify-center font-black text-xl shadow-md transition-transform duration-300 transform perspective-500 relative">
                      {isRevealed ? (
                        /* Đã lật bài: Tất cả mọi người thấy số điểm (AC1) */
                        <div className={`w-full h-full rounded-xl bg-white border-2 flex flex-col items-center justify-center font-mono animate-in zoom-in-75 shadow-sm relative ${
                          isSpeedTalkHigh
                            ? 'border-rose-600 text-rose-700 bg-rose-50 shadow-md ring-2 ring-rose-400'
                            : isSpeedTalkLow
                            ? 'border-blue-600 text-blue-700 bg-blue-50 shadow-md ring-2 ring-blue-400'
                            : isMax 
                            ? 'border-rose-500 text-rose-700 bg-rose-50/20' 
                            : isMin 
                            ? 'border-blue-500 text-blue-700 bg-blue-50/20' 
                            : 'border-primary text-primary'
                        }`}>
                          {/* Huy hiệu cao nhất / thấp nhất (AC1) */}
                          {isSpeedTalkHigh ? (
                            <span className="absolute -top-2.5 px-1.5 py-0.5 bg-rose-600 text-white text-[8px] font-sans font-bold uppercase tracking-wider rounded-full shadow-sm flex items-center gap-0.5 whitespace-nowrap">
                              <span className="material-symbols-outlined text-[10px]">campaign</span>
                              <span>Nói nhanh (Max)</span>
                            </span>
                          ) : isSpeedTalkLow ? (
                            <span className="absolute -top-2.5 px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-sans font-bold uppercase tracking-wider rounded-full shadow-sm flex items-center gap-0.5 whitespace-nowrap">
                              <span className="material-symbols-outlined text-[10px]">campaign</span>
                              <span>Nói nhanh (Min)</span>
                            </span>
                          ) : isMax ? (
                            <span className="absolute -top-2 px-1.5 py-0.2 bg-rose-600 text-white text-[7px] font-sans font-bold uppercase tracking-wider rounded-full shadow-sm">
                              Max
                            </span>
                          ) : isMin ? (
                            <span className="absolute -top-2 px-1.5 py-0.2 bg-blue-600 text-white text-[7px] font-sans font-bold uppercase tracking-wider rounded-full shadow-sm">
                              Min
                            </span>
                          ) : null}
                          <span className="text-xl font-black">
                            {member.vote !== null && member.vote !== undefined ? member.vote : '-'}
                          </span>
                        </div>
                      ) : isMe && myVote ? (
                        /* AC1: Chưa lật bài nhưng là CHÍNH MÌNH -> Chỉ mình thấy lá đã chọn */
                        <div 
                          className="w-full h-full rounded-xl bg-white text-purple-700 border-2 border-purple-500 shadow-md flex flex-col items-center justify-center font-mono relative animate-in zoom-in-90 ring-2 ring-purple-500/20"
                          title="Lá bài bạn đã chọn (đang ẩn với tất cả thành viên khác)"
                        >
                          <span className="text-xl font-black">{myVote}</span>
                          <span className="text-[7px] font-sans font-bold text-purple-600 tracking-tighter uppercase mt-0.5">Lá của bạn</span>
                        </div>
                      ) : member.hasVoted ? (
                        /* AC1: Chưa lật bài & là NGƯỜI KHÁC -> Chỉ thấy lá bài úp bí mật, không thấy số */
                        <div 
                          className="w-full h-full rounded-xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center border-2 border-primary/50 shadow-inner"
                          title="Thành viên đã chọn bài (đang được ẩn)"
                        >
                          <span className="material-symbols-outlined text-2xl animate-pulse">style</span>
                        </div>
                      ) : (
                        /* Chưa chọn bài */
                        <div className="w-full h-full rounded-xl border-2 border-dashed border-outline-variant/40 flex items-center justify-center text-outline text-xs">
                          ...
                        </div>
                      )}
                    </div>

                    {/* Avatar và tên */}
                    <div className="flex items-center gap-1.5 max-w-full">
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {member.avatar ? (
                          <img src={getAvatarUrl(member.avatar)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          member.fullName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <span className="text-xs font-semibold truncate text-on-surface">
                        {member.fullName} {isMe ? '(Tôi)' : ''}
                      </span>
                    </div>

                    {/* AC1: Trạng thái hiển thị rõ ràng "Đã vote" với người khác */}
                    <span className="text-[10px] font-bold mt-1">
                      {hasVoted ? (
                        <span className="text-emerald-600 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          <span>Đã vote</span>
                        </span>
                      ) : (
                        <span className="text-outline/70 italic">Chưa vote</span>
                      )}
                    </span>
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-on-surface-variant/50 italic">
                  Chưa có thành viên nào vào phòng...
                </div>
              )}
            </div>
          </div>

          {/* 2. BỘ BÀI PLANNING POKER CHO NGƯỜI DÙNG CHỌN */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-outline flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">style</span>
                  <span>Chọn lá bài Fibonacci {myVote ? `(Đang chọn: ${myVote})` : ''}</span>
                </div>
                <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                  Lá bài bạn chọn được ẩn hoàn toàn với các thành viên khác cho đến khi Lật bài.
                </p>
              </div>

              {myVote && !isRevealed && (
                <button
                  onClick={() => handleSelectCard(myVote)}
                  className="text-[11px] font-bold text-error hover:underline flex items-center gap-1 self-start sm:self-center"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                  <span>Bỏ chọn bài</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 justify-center md:justify-start">
              {POKER_CARDS.map((card) => {
                const isSelected = myVote === card;
                return (
                  <button
                    key={card}
                    disabled={isRevealed}
                    onClick={() => handleSelectCard(card)}
                    className={`w-12 h-16 md:w-14 md:h-20 rounded-2xl flex items-center justify-center font-black font-mono text-base md:text-lg transition-all duration-200 transform ${
                      isSelected
                        ? 'bg-primary text-white -translate-y-2 shadow-xl ring-4 ring-primary/30 scale-105'
                        : isRevealed
                        ? 'bg-surface-container/40 text-on-surface-variant/40 cursor-not-allowed border border-outline-variant/20'
                        : 'bg-surface-container hover:bg-surface-container-high hover:-translate-y-1 text-on-surface shadow-sm border border-outline-variant/20'
                    }`}
                  >
                    {card}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

