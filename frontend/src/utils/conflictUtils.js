/**
 * Utilities for conflict resolution (SCRUM-66)
 */

export function formatTimeAgo(dateInput) {
  if (!dateInput) return 'vừa xong';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'vừa xong';
  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 5) return 'vừa xong';
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} tháng trước`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} năm trước`;
}

export async function copyDraftToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard.writeText failed, trying fallback', e);
    }
  }

  // Fallback using hidden textarea + execCommand('copy')
  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return !!successful;
    }
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  return false;
}

export function buildDraftCopyText(form, members = []) {
  const parts = [];
  parts.push(`Tiêu đề: ${form.title || ''}`);
  parts.push(`Mô tả: ${form.description || ''}`);
  if (form.status) parts.push(`Trạng thái: ${form.status}`);
  if (form.assigneeId) {
    const member = members.find(m => m.user?.id === form.assigneeId);
    const assigneeName = member ? (member.user.fullName || member.user.email) : form.assigneeId;
    parts.push(`Người phụ trách: ${assigneeName}`);
  }
  if (form.dueDate) parts.push(`Hạn chót: ${form.dueDate}`);
  return parts.join('\n');
}

