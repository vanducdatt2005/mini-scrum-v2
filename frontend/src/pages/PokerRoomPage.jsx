import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../context/SocketContext';
import { getPokerRoom, closePokerRoom, savePokerEstimate, getAvatarUrl } from '../services/api';
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

    socket.on('poker:stateUpdate', handleStateUpdate);
    socket.on('poker:yourVote', handleYourVote);

    return () => {
      socket.emit('poker:leave', { roomCode: cleanCode });
      socket.off('poker:stateUpdate', handleStateUpdate);
      socket.off('poker:yourVote', handleYourVote);
    };
  }, [roomData, currentUser, roomCode]);

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

  // Hành động Lật bài (SM/PO)
  const handleRevealCards = () => {
    const socket = getSocket();
    socket.emit('poker:reveal', {
      roomCode: roomCode.toUpperCase().trim()
    });
    toast.success('Đã lật bài cả phòng!');
  };

  // Hành động Vòng mới (Reset)
  const handleResetRound = () => {
    setMyVote(null);
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

  // Lưu Story Points vào US (SM/PO)
  const handleSavePoints = async (points) => {
    if (!roomData?.id) return;
    setIsSavingEstimate(true);
    try {
      await savePokerEstimate(roomData.id, points);
      toast.success(`Đã lưu ${points} Story Points vào User Story!`);
      setRoomData(prev => ({
        ...prev,
        userStory: {
          ...prev.userStory,
          storyPoints: parseInt(points, 10)
        }
      }));
    } catch (err) {
      toast.error('Lỗi khi lưu điểm Story Points');
    } finally {
      setIsSavingEstimate(false);
    }
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

  // Tính toán thống kê điểm số khi lật bài
  const statistics = useMemo(() => {
    if (!isRevealed || members.length === 0) return null;
    const numericVotes = members
      .map(m => parseFloat(m.vote))
      .filter(v => !isNaN(v));

    if (numericVotes.length === 0) {
      return { average: 'N/A', consensus: 'N/A', count: 0 };
    }

    const sum = numericVotes.reduce((acc, curr) => acc + curr, 0);
    const avg = (sum / numericVotes.length).toFixed(1);

    // Tính điểm phổ biến nhất (Consensus / Mode)
    const frequency = {};
    numericVotes.forEach(v => {
      frequency[v] = (frequency[v] || 0) + 1;
    });
    let maxFreq = 0;
    let mode = numericVotes[0];
    for (const key in frequency) {
      if (frequency[key] > maxFreq) {
        maxFreq = frequency[key];
        mode = key;
      }
    }

    return {
      average: avg,
      consensus: mode,
      count: numericVotes.length
    };
  }, [isRevealed, members]);

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
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Đang diễn ra</span>
          </div>

          {isModerator && (
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
                Story Points hiện tại:
              </div>
              <div className="text-sm font-black px-3 py-1 bg-primary/10 text-primary rounded-xl">
                {story.storyPoints !== null && story.storyPoints !== undefined ? `${story.storyPoints} SP` : 'Chưa gán'}
              </div>
            </div>
          </div>

          {/* HỘP KẾT QUẢ SAU KHI LẬT BÀI */}
          {isRevealed && statistics && (
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
              <h4 className="text-xs font-black uppercase tracking-wider text-primary mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">analytics</span>
                Kết quả thống nhất (Consensus)
              </h4>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-primary/5 p-3.5 rounded-2xl border border-primary/10 text-center">
                  <div className="text-[10px] uppercase font-bold text-outline">Điểm trung bình</div>
                  <div className="text-2xl font-black text-primary mt-0.5">{statistics.average}</div>
                </div>
                <div className="bg-emerald-500/5 p-3.5 rounded-2xl border border-emerald-500/10 text-center">
                  <div className="text-[10px] uppercase font-bold text-outline">Được chọn nhiều nhất</div>
                  <div className="text-2xl font-black text-emerald-600 mt-0.5">{statistics.consensus}</div>
                </div>
              </div>

              {isModerator && (
                <div className="space-y-2 pt-2 border-t border-outline-variant/10">
                  <span className="text-[11px] font-bold text-on-surface-variant block">
                    Gợi ý lưu điểm vào User Story:
                  </span>
                  <div className="flex gap-2">
                    {statistics.consensus !== 'N/A' && (
                      <button
                        onClick={() => handleSavePoints(statistics.consensus)}
                        disabled={isSavingEstimate}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        <span>Lưu {statistics.consensus} SP</span>
                      </button>
                    )}
                    {statistics.average !== 'N/A' && statistics.average !== statistics.consensus && (
                      <button
                        onClick={() => handleSavePoints(Math.round(parseFloat(statistics.average)))}
                        disabled={isSavingEstimate}
                        className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Lưu {Math.round(parseFloat(statistics.average))} SP (Làm tròn)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: BÀN POKER + THÀNH VIÊN VÀ BỘ BÀI */}
        <div className="lg:w-3/5 flex flex-col gap-6">
          {/* 1. KHU VỰC THÀNH VIÊN THAM GIA */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">group</span>
                <h3 className="font-bold text-sm text-on-surface">Thành viên trong phòng ({members.length})</h3>
              </div>

              {/* Nút lật bài & vòng mới cho Moderator */}
              {isModerator && (
                <div className="flex items-center gap-2">
                  {!isRevealed ? (
                    <button
                      onClick={handleRevealCards}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>Lật bài</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResetRound}
                      className="px-4 py-2 bg-surface-container-high hover:bg-primary/10 hover:text-primary text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      <span>Vòng mới</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Danh sách các lá bài thành viên trên bàn Poker */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {members.map((member) => {
                const isMe = member.userId === currentUser?.id;
                // Kiểm tra xem thành viên này đã vote chưa
                const hasVoted = isMe ? (myVote !== null && myVote !== undefined) : member.hasVoted;

                return (
                  <div
                    key={member.userId}
                    className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${
                      hasVoted 
                        ? 'bg-primary/5 border-primary/30 shadow-sm' 
                        : 'bg-surface-container/30 border-outline-variant/15 opacity-80'
                    }`}
                  >
                    {/* Lá bài úp hoặc lật */}
                    <div className="w-14 h-20 mb-3 rounded-xl flex items-center justify-center font-black text-xl shadow-md transition-transform duration-300 transform perspective-500">
                      {isRevealed ? (
                        /* Đã lật bài: Tất cả mọi người thấy số điểm */
                        <div className="w-full h-full rounded-xl bg-white text-primary border-2 border-primary flex items-center justify-center font-mono animate-in zoom-in-75 shadow-sm">
                          {member.vote !== null && member.vote !== undefined ? member.vote : '-'}
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

