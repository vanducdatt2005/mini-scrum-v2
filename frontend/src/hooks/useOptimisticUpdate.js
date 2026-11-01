import { useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

const ERROR_MESSAGES = {
  403: 'Không thể thực hiện do bạn không có quyền chỉnh sửa',
  409: 'Dữ liệu đã bị người khác thay đổi, vui lòng thử lại',
};
const DEFAULT_ERROR = 'Đã có lỗi xảy ra, vui lòng thử lại';
const TIMEOUT_MS = 10000;

/**
 * Map HTTP error sang thông báo tiếng Việt.
 * Exported để unit test có thể kiểm tra trực tiếp.
 */
export function getErrorMessage(error) {
  if (error?.code === 'ECONNABORTED' || error?.name === 'AbortError') return DEFAULT_ERROR;
  if (!error?.response) return DEFAULT_ERROR; // Network error / timeout
  const status = error.response.status;
  if (ERROR_MESSAGES[status]) return ERROR_MESSAGES[status];
  if (status >= 500) return DEFAULT_ERROR;
  return error.response.data?.error || DEFAULT_ERROR;
}

/**
 * Hook hỗ trợ Optimistic UI Update với Rollback & Race-condition handling (US-64).
 *
 * @param {Function} setItems  - setState setter cho danh sách items (stories)
 * @param {Array}    currentItems - giá trị hiện tại của items (để lưu snapshot qua ref)
 */
export default function useOptimisticUpdate(setItems, currentItems) {
  const itemsRef = useRef(currentItems);
  const latestRequestMap = useRef(new Map());     // itemId → requestId
  const socketInvalidatedSet = useRef(new Set());  // requestIds đã bị socket vô hiệu

  // Giữ ref luôn đồng bộ với state mới nhất
  useEffect(() => {
    itemsRef.current = currentItems;
  }, [currentItems]);

  /**
   * Thực hiện optimistic update cho một item.
   *
   * @param {Object}   opts
   * @param {string}   opts.itemId  - ID của item đang cập nhật
   * @param {Function} opts.patchFn - (prevItems) => newItems
   * @param {Function} opts.apiCall - () => Promise<AxiosResponse>
   * @returns {Promise<boolean>} true nếu thành công
   */
  const optimisticUpdate = useCallback(async ({ itemId, patchFn, apiCall }) => {
    const requestId = `${itemId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    latestRequestMap.current.set(itemId, requestId);

    // 1. Lưu snapshot per-item TRƯỚC khi patch
    const currentItem = itemsRef.current?.find(item => item.id === itemId);
    const itemSnapshot = currentItem ? { ...currentItem } : null;

    // 2. Áp patch vào UI ngay lập tức (đồng bộ, < 50ms)
    setItems(patchFn);

    // 3. Gọi API bất đồng bộ với timeout 10s
    let timeoutId;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(Object.assign(new Error('Request timeout'), { code: 'ECONNABORTED' })),
          TIMEOUT_MS
        );
      });

      const response = await Promise.race([apiCall(), timeoutPromise]);
      clearTimeout(timeoutId);

      // 4. Race-condition: chỉ xử lý nếu là request mới nhất cho item này
      if (latestRequestMap.current.get(itemId) !== requestId) return true;

      // 5. Socket đã xử lý rồi? Bỏ qua merge.
      if (socketInvalidatedSet.current.has(requestId)) {
        socketInvalidatedSet.current.delete(requestId);
        return true;
      }

      // 6. Thành công: merge updatedAt từ server, không re-render toàn bộ
      if (response?.data) {
        const serverData = response.data.story || response.data;
        if (serverData?.updatedAt) {
          setItems(prev => prev.map(item =>
            item.id === itemId
              ? { ...item, updatedAt: serverData.updatedAt }
              : item
          ));
        }
      }

      latestRequestMap.current.delete(itemId);
      return true;
    } catch (error) {
      clearTimeout(timeoutId);

      // Race-condition: không rollback nếu đã có request mới hơn
      if (latestRequestMap.current.get(itemId) !== requestId) return false;

      // Socket đã cập nhật? Không rollback.
      if (socketInvalidatedSet.current.has(requestId)) {
        socketInvalidatedSet.current.delete(requestId);
        return false;
      }

      // 7. Khôi phục đúng snapshot ban đầu (chỉ item bị ảnh hưởng)
      if (itemSnapshot) {
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...itemSnapshot } : item
        ));
      }

      latestRequestMap.current.delete(itemId);

      // 8. Toast lỗi CHỈ SAU KHI rollback hoàn tất (next frame)
      requestAnimationFrame(() => {
        toast.error(getErrorMessage(error));
      });

      return false;
    }
  }, [setItems]);

  /**
   * Gọi khi socket event cập nhật cùng item đang có pending request.
   * Vô hiệu hóa rollback của request đang chờ → data socket ưu tiên.
   */
  const invalidateBySocket = useCallback((itemId) => {
    const requestId = latestRequestMap.current.get(itemId);
    if (requestId) {
      socketInvalidatedSet.current.add(requestId);
      latestRequestMap.current.delete(itemId);
    }
  }, []);

  return { optimisticUpdate, invalidateBySocket };
}
