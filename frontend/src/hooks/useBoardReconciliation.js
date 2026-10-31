import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket, onSocketReconnect } from '../context/SocketContext';
import { getBoardState } from '../services/api';
import { 
  globalEventDeduplicator, 
  reconcileBoardState, 
  upsertTaskInStories, 
  upsertStoryInList,
  sanitizeStoriesTree 
} from '../utils/boardReconciliation';

/**
 * Hook quản lý đối chiếu dữ liệu (Reconciliation) và chống trùng lặp (Deduplication)
 * cho Board và Backlog.
 * 
 * @param {string} projectId 
 * @param {Array} stories - State danh sách stories hiện tại
 * @param {Function} setStories - Hàm cập nhật state stories
 * @param {Function} onReloadFull - Callback reload toàn bộ dữ liệu phụ (sprints, members...)
 */
export default function useBoardReconciliation({ projectId, stories, setStories, onReloadFull }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const storiesRef = useRef(stories);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  /**
   * Lưu vị trí cuộn trang để phục hồi mượt mà sau khi đối chiếu dữ liệu (AC4)
   */
  const captureScrollPositions = useCallback(() => {
    const positions = new Map();
    // Vị trí cuộn của cả trang
    positions.set('window', { x: window.scrollX, y: window.scrollY });
    
    // Vị trí cuộn của các cột kanban hoặc container scrollable
    const scrollables = document.querySelectorAll('.kanban-column-scroll, [data-scrollable="true"]');
    scrollables.forEach((el, index) => {
      positions.set(`scrollable-${index}`, { top: el.scrollTop, left: el.scrollLeft, el });
    });

    return positions;
  }, []);

  const restoreScrollPositions = useCallback((positions) => {
    if (!positions) return;
    requestAnimationFrame(() => {
      const winPos = positions.get('window');
      if (winPos) {
        window.scrollTo(winPos.x, winPos.y);
      }

      positions.forEach((val, key) => {
        if (key !== 'window' && val.el) {
          val.el.scrollTop = val.top;
          val.el.scrollLeft = val.left;
        }
      });
    });
  }, []);

  /**
   * Thực hiện đối chiếu dữ liệu với server (State Reconciliation - AC2, AC3)
   */
  const performReconciliation = useCallback(async (source = 'auto') => {
    if (!projectId || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus('syncing');

    const scrollSnapshot = captureScrollPositions();

    try {
      console.log(`[Reconciliation] Bắt đầu đối chiếu dữ liệu Board cho dự án ${projectId} (Nguồn: ${source})...`);
      
      // Gọi API lấy board state mới nhất từ server
      const res = await getBoardState(projectId);
      const serverStories = res.data?.stories || [];

      // Thực hiện đối chiếu và làm sạch trùng lặp (AC3)
      const { stories: reconciled, changesCount, durationMs } = reconcileBoardState(
        storiesRef.current,
        serverStories
      );

      console.log(`[Reconciliation] Hoàn tất đối chiếu trong ${durationMs.toFixed(1)}ms. Có ${changesCount} thay đổi.`);

      // Cập nhật state stories ngay lập tức
      if (typeof setStories === 'function') {
        setStories(reconciled);
      }

      // Reload dữ liệu phụ nếu có (sprints, members)
      if (typeof onReloadFull === 'function') {
        try {
          await onReloadFull();
        } catch (e) {
          console.warn('[Reconciliation] onReloadFull warning:', e);
        }
      }

      // Phục hồi vị trí cuộn trang (AC4)
      restoreScrollPositions(scrollSnapshot);

      setLastSyncAt(Date.now());
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2500);

    } catch (err) {
      console.error('[Reconciliation] Lỗi khi đối chiếu dữ liệu:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [projectId, setStories, onReloadFull, captureScrollPositions, restoreScrollPositions]);

  const performReconciliationRef = useRef(performReconciliation);
  useEffect(() => {
    performReconciliationRef.current = performReconciliation;
  }, [performReconciliation]);

  // 1. Tự động đối chiếu khi WebSocket Reconnect, Browser Online, hoặc Tab Active (AC2)
  useEffect(() => {
    if (!projectId) return;

    const handleReconcileTrigger = (source) => {
      console.log(`🔄 [State Reconciliation] Kích hoạt tự động đối chiếu (Nguồn: ${source})...`);
      if (typeof performReconciliationRef.current === 'function') {
        performReconciliationRef.current(source);
      }
    };

    // Khi WebSocket reconnect thành công (AC2)
    const unsubscribeReconnect = onSocketReconnect(() => {
      handleReconcileTrigger('websocket-reconnect');
    });

    // Khi trình duyệt chuyển sang Online (người dùng bật lại mạng hoặc bỏ tick Offline trong DevTools)
    const handleBrowserOnline = () => {
      console.log('🌐 [Network] Trình duyệt Online trở lại. Kích hoạt State Reconciliation (AC2)...');
      handleReconcileTrigger('browser-online');
    };

    // Khi người dùng chuyển quay lại tab này từ tab khác
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('👁️ [Visibility] Người dùng quay lại tab Board. Kích hoạt State Reconciliation (AC2)...');
        handleReconcileTrigger('tab-visible');
      }
    };

    window.addEventListener('online', handleBrowserOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeReconnect();
      window.removeEventListener('online', handleBrowserOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectId]);

  // 2. Lắng nghe socket events với bộ lọc Event Deduplication (AC1)
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !projectId) return;

    const handleTaskChanged = (event) => {
      if (event?.projectId && event.projectId !== projectId) return;

      // AC1: Kiểm tra chống nhận trùng lặp sự kiện
      if (!globalEventDeduplicator.shouldProcess(event)) {
        console.warn(`[Deduplication] Bỏ qua sự kiện trùng lặp:`, event.eventId || event);
        return;
      }

      console.log(`[WebSocket] Xử lý sự kiện task:changed (Action: ${event.action})`, event.data || event.entityId);

      // Nếu có đầy đủ dữ liệu task, tiến hành upsert in-place ngay lập tức (AC1)
      if (event.data && typeof setStories === 'function') {
        setStories(prev => upsertTaskInStories(prev, event.data, event.action));
      } else {
        // Fallback: nếu event không mang data, gọi đối chiếu nhẹ
        if (typeof performReconciliationRef.current === 'function') {
          performReconciliationRef.current('socket-task-changed');
        }
      }
    };

    const handleStoryChanged = (event) => {
      if (event?.projectId && event.projectId !== projectId) return;

      if (!globalEventDeduplicator.shouldProcess(event)) {
        console.warn(`[Deduplication] Bỏ qua sự kiện trùng lặp:`, event.eventId || event);
        return;
      }

      console.log(`[WebSocket] Xử lý sự kiện userStory:changed (Action: ${event.action})`, event.data || event.entityId);

      if (event.data && typeof setStories === 'function') {
        setStories(prev => upsertStoryInList(prev, event.data, event.action));
      } else {
        if (typeof performReconciliationRef.current === 'function') {
          performReconciliationRef.current('socket-story-changed');
        }
      }
    };

    socket.on('task:changed', handleTaskChanged);
    socket.on('userStory:changed', handleStoryChanged);

    return () => {
      socket.off('task:changed', handleTaskChanged);
      socket.off('userStory:changed', handleStoryChanged);
    };
  }, [projectId, setStories]);

  // Expose ra window để dễ dàng kiểm thử trực tiếp bằng tay trên F12 Console (DoD)
  useEffect(() => {
    window.__miniScrumReconciliation = {
      triggerReconcile: () => performReconciliationRef.current ? performReconciliationRef.current('manual-trigger') : Promise.resolve(),
      deduplicateCurrent: () => {
        if (typeof setStories === 'function') {
          setStories(prev => sanitizeStoriesTree(prev));
        }
      },
      simulateDuplicateEvents: (count = 5) => {
        console.group('🧪 [TC-09] KIỂM THỬ CHỐNG SỰ KIỆN TRÙNG LẶP (AC1)');
        console.log(`Bắn ${count} sự kiện task:changed có CÙNG eventId vào hệ thống...`);
        const fakeEvent = {
          eventId: 'evt_duplicate_test_' + Date.now(),
          action: 'update',
          projectId,
          model: 'Task',
          entityId: 'task_demo_dedup',
          data: { id: 'task_demo_dedup', title: 'Task Test Deduplication', status: 'IN_PROGRESS' },
          timestamp: Date.now()
        };
        let accepted = 0;
        let rejected = 0;
        for (let i = 1; i <= count; i++) {
          if (globalEventDeduplicator.shouldProcess(fakeEvent)) {
            accepted++;
            console.log(`  Event #${i}: ✅ CHẤP NHẬN xử lý (lần đầu nhận)`);
          } else {
            rejected++;
            console.warn(`  Event #${i}: 🛡️ BỊ CHẶN — Phát hiện trùng lặp eventId [${fakeEvent.eventId}]`);
          }
        }
        console.log(`%c📊 KẾT QUẢ: ${accepted} sự kiện được nhận, ${rejected} sự kiện trùng bị loại bỏ hoàn toàn!`, 'color: green; font-weight: bold');
        console.groupEnd();
      },
      getStatus: () => ({ isSyncing, lastSyncAt, syncStatus, storyCount: storiesRef.current?.length || 0 })
    };
  }, [isSyncing, lastSyncAt, syncStatus, setStories, projectId]);

  return {
    isSyncing,
    lastSyncAt,
    syncStatus,
    performReconciliation
  };
}
