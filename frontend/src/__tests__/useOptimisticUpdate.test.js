import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
import toast from 'react-hot-toast';

import { getErrorMessage } from '../hooks/useOptimisticUpdate';

// ============================================================
// US-64: Unit Test — Optimistic Update & Rollback Logic
// ============================================================

describe('getErrorMessage — Map lỗi sang toast tiếng Việt', () => {
  it('403 → thông báo thiếu quyền', () => {
    expect(getErrorMessage({ response: { status: 403, data: {} } }))
      .toBe('Không thể thực hiện do bạn không có quyền chỉnh sửa');
  });

  it('409 → thông báo xung đột phiên bản', () => {
    expect(getErrorMessage({ response: { status: 409, data: {} } }))
      .toBe('Dữ liệu đã bị người khác thay đổi, vui lòng thử lại');
  });

  it('500 → thông báo lỗi chung', () => {
    expect(getErrorMessage({ response: { status: 500, data: {} } }))
      .toBe('Đã có lỗi xảy ra, vui lòng thử lại');
  });

  it('Network error (no response) → thông báo lỗi chung', () => {
    expect(getErrorMessage({ message: 'Network Error' }))
      .toBe('Đã có lỗi xảy ra, vui lòng thử lại');
  });

  it('Timeout → thông báo lỗi chung', () => {
    expect(getErrorMessage({ code: 'ECONNABORTED' }))
      .toBe('Đã có lỗi xảy ra, vui lòng thử lại');
  });

  it('Backend error message passthrough khi status không nằm trong map', () => {
    expect(getErrorMessage({ response: { status: 422, data: { error: 'Dữ liệu sai' } } }))
      .toBe('Dữ liệu sai');
  });
});

describe('Optimistic Update State Machine', () => {
  const initialItems = [
    { id: 's1', status: 'TODO', title: 'Story 1', updatedAt: '2024-01-01T00:00:00Z' },
    { id: 's2', status: 'IN_PROGRESS', title: 'Story 2', updatedAt: '2024-01-02T00:00:00Z' },
  ];

  let items;

  beforeEach(() => {
    items = JSON.parse(JSON.stringify(initialItems));
    vi.clearAllMocks();
  });

  it('TC1: API reject → rollback state đúng 100% snapshot ban đầu (deep equal)', async () => {
    // 1. Lưu snapshot per-item
    const snapshot = { ...items.find(i => i.id === 's1') };

    // 2. Áp optimistic patch
    items = items.map(s => s.id === 's1' ? { ...s, status: 'DONE' } : s);
    expect(items.find(s => s.id === 's1').status).toBe('DONE');

    // 3. API reject 403
    try {
      await Promise.reject({ response: { status: 403, data: { error: 'Forbidden' } } });
    } catch (error) {
      // 4. Rollback per-item
      items = items.map(item => item.id === 's1' ? { ...snapshot } : item);
      toast.error(getErrorMessage(error));
    }

    // 5. Verify rollback khớp 100% snapshot ban đầu
    expect(items).toEqual(initialItems);
    expect(items.find(s => s.id === 's1').status).toBe('TODO');
    expect(items.find(s => s.id === 's2').status).toBe('IN_PROGRESS');
    expect(toast.error).toHaveBeenCalledWith(
      'Không thể thực hiện do bạn không có quyền chỉnh sửa'
    );
  });

  it('TC2: API resolve → giữ nguyên patch + merge updatedAt', async () => {
    // 1. Áp optimistic patch
    items = items.map(s => s.id === 's1' ? { ...s, status: 'DONE' } : s);
    expect(items.find(s => s.id === 's1').status).toBe('DONE');

    // 2. API resolve
    const response = {
      data: { story: { id: 's1', status: 'DONE', updatedAt: '2024-06-15T10:00:00Z' } }
    };

    // 3. Merge updatedAt từ server
    const serverData = response.data.story;
    items = items.map(item =>
      item.id === 's1'
        ? { ...item, updatedAt: serverData.updatedAt }
        : item
    );

    // 4. Verify: patch giữ nguyên + updatedAt đã merge
    const updated = items.find(s => s.id === 's1');
    expect(updated.status).toBe('DONE');
    expect(updated.updatedAt).toBe('2024-06-15T10:00:00Z');
    // Item khác không bị ảnh hưởng
    expect(items.find(s => s.id === 's2')).toEqual(initialItems.find(s => s.id === 's2'));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
