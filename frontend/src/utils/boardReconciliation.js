/**
 * US-063: BOARD RECONCILIATION & DEDUPLICATION ENGINE
 * 
 * Đảm bảo:
 * 1. Chống hiển thị trùng thẻ (Deduplication by Event/Task ID - AC1)
 * 2. Đối chiếu dữ liệu sau khi kết nối lại (State Reconciliation - AC2, AC3)
 * 3. Xử lý mượt mà, không giật lag, thời gian đối chiếu < 500ms (AC4, DoD)
 * 4. Tính chất Idempotent (xử lý cùng 1 event nhiều lần không làm đổi kết quả - DoD)
 */

/**
 * Loại bỏ trùng lặp mảng theo trường `id`.
 * Nếu có phần tử trùng, phần tử xuất hiện sau (mới hơn) sẽ ghi đè lên phần tử trước.
 */
export function deduplicateById(items = []) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const item of items) {
    if (item && item.id != null) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Loại bỏ trùng lặp triệt để cho toàn bộ cây User Story và Tasks bên trong.
 * Đảm bảo mỗi Task ID chỉ xuất hiện đúng 1 lần duy nhất trên toàn bộ Board.
 */
export function sanitizeStoriesTree(stories = []) {
  if (!Array.isArray(stories)) return [];
  const cleanStories = deduplicateById(stories);
  const seenTaskIds = new Set();

  return cleanStories.map(story => {
    if (!story || !Array.isArray(story.tasks)) {
      return story;
    }

    const uniqueTasks = [];
    for (const task of story.tasks) {
      if (task && task.id != null && !seenTaskIds.has(task.id)) {
        seenTaskIds.add(task.id);
        uniqueTasks.push(task);
      }
    }

    return {
      ...story,
      tasks: uniqueTasks
    };
  });
}

/**
 * Lớp quản lý và lọc trùng lặp sự kiện WebSocket (Event Deduplicator).
 * Ngăn chặn việc thực thi nhiều lần cùng 1 event do mạng chập chờn hoặc retry.
 */
export class EventDeduplicator {
  constructor(maxSize = 300) {
    this.maxSize = maxSize;
    this.processedEvents = new Map(); // key -> timestamp
  }

  /**
   * Tạo chữ ký duy nhất cho một sự kiện
   */
  getEventKey(event) {
    if (!event) return null;
    if (event.eventId) return `id:${event.eventId}`;
    
    // Fallback: tạo composite signature từ thông tin sự kiện
    const entityId = event.entityId || event.data?.id || '';
    const action = event.action || '';
    const model = event.model || '';
    const timestamp = event.timestamp || '';
    return `sig:${model}:${action}:${entityId}:${timestamp}`;
  }

  /**
   * Kiểm tra xem sự kiện đã từng được xử lý hay chưa.
   * Nếu chưa, ghi nhớ sự kiện và trả về true.
   * Nếu đã xử lý rồi, trả về false (bỏ qua).
   */
  shouldProcess(event) {
    const key = this.getEventKey(event);
    if (!key) return true;

    if (this.processedEvents.has(key)) {
      return false; // Bị trùng lặp -> bỏ qua (AC1)
    }

    // Dọn dẹp cache nếu vượt quá giới hạn
    if (this.processedEvents.size >= this.maxSize) {
      const oldestKey = this.processedEvents.keys().next().value;
      if (oldestKey) this.processedEvents.delete(oldestKey);
    }

    this.processedEvents.set(key, Date.now());
    return true;
  }

  /**
   * Xóa lịch sử cache sự kiện
   */
  clear() {
    this.processedEvents.clear();
  }
}

// Global Singleton Event Deduplicator instance
export const globalEventDeduplicator = new EventDeduplicator();

/**
 * Cập nhật hoặc Thêm mới Task vào danh sách Stories (Upsert Task - AC1)
 * Đảm bảo tính Idempotent: gọi nhiều lần với cùng 1 task sẽ cho kết quả giống nhau.
 */
export function upsertTaskInStories(stories = [], incomingTask, action = 'update') {
  if (!incomingTask || !incomingTask.id) return stories;
  if (!Array.isArray(stories)) return [];

  const taskId = incomingTask.id;
  const targetStoryId = incomingTask.storyId;

  // Trường hợp XÓA Task
  if (action === 'delete') {
    return stories.map(story => {
      if (!Array.isArray(story.tasks)) return story;
      const filtered = story.tasks.filter(t => t.id !== taskId);
      return filtered.length !== story.tasks.length ? { ...story, tasks: filtered } : story;
    });
  }

  // Trường hợp CREATE hoặc UPDATE Task (Upsert)
  let taskHandled = false;

  const nextStories = stories.map(story => {
    const isTargetStory = story.id === targetStoryId;
    const currentTasks = Array.isArray(story.tasks) ? story.tasks : [];
    const hasTaskCurrently = currentTasks.some(t => t.id === taskId);

    if (isTargetStory) {
      taskHandled = true;
      let newTasks;
      if (hasTaskCurrently) {
        // Cập nhật in-place thẻ đã tồn tại (chống nhân đôi thẻ - AC1)
        newTasks = currentTasks.map(t => t.id === taskId ? { ...t, ...incomingTask } : t);
      } else {
        // Thêm mới nếu chưa có
        newTasks = [...currentTasks, incomingTask];
      }
      return { ...story, tasks: deduplicateById(newTasks) };
    } else if (hasTaskCurrently) {
      // Nếu task bị chuyển sang story khác, gỡ nó khỏi story cũ
      return { ...story, tasks: currentTasks.filter(t => t.id !== taskId) };
    }

    return story;
  });

  return sanitizeStoriesTree(nextStories);
}

/**
 * Cập nhật hoặc Thêm mới User Story vào danh sách (Upsert Story - AC1)
 */
export function upsertStoryInList(stories = [], incomingStory, action = 'update') {
  if (!incomingStory || !incomingStory.id) return stories;
  if (!Array.isArray(stories)) return [];

  const storyId = incomingStory.id;

  if (action === 'delete') {
    return stories.filter(s => s.id !== storyId);
  }

  const exists = stories.some(s => s.id === storyId);

  let updatedList;
  if (exists) {
    // Cập nhật in-place, giữ nguyên danh sách tasks nếu incoming không có
    updatedList = stories.map(s => {
      if (s.id === storyId) {
        return {
          ...s,
          ...incomingStory,
          tasks: incomingStory.tasks !== undefined ? incomingStory.tasks : s.tasks
        };
      }
      return s;
    });
  } else {
    // Thêm mới
    updatedList = [...stories, incomingStory];
  }

  return sanitizeStoriesTree(updatedList);
}

/**
 * ĐỐI CHIẾU VÀ LÀM SẠCH BOARD STATE (Reconcile Board State - AC3)
 * So sánh state hiện tại của Client với state chuẩn từ Server sau Reconnect:
 * - Cập nhật các thẻ có thay đổi
 * - Thêm các thẻ mới được tạo trong thời gian rớt mạng
 * - Xóa các thẻ đã bị xóa trên Server
 * - Loại bỏ hoàn toàn mọi thẻ trùng lặp
 * 
 * Hiệu năng: Đo thời gian thực thi (Performance Check < 500ms theo DoD)
 */
export function reconcileBoardState(currentStories = [], serverStories = []) {
  const startTime = performance.now();

  if (!Array.isArray(serverStories)) {
    return {
      stories: sanitizeStoriesTree(currentStories),
      changesCount: 0,
      durationMs: performance.now() - startTime
    };
  }

  const cleanServerStories = sanitizeStoriesTree(serverStories);
  const serverStoryMap = new Map(cleanServerStories.map(s => [s.id, s]));
  const currentStoryMap = new Map((currentStories || []).map(s => [s.id, s]));

  let changesCount = 0;

  // 1. Duyệt qua server stories để xây dựng danh sách đã đối chiếu
  const reconciled = cleanServerStories.map(serverStory => {
    const currentStory = currentStoryMap.get(serverStory.id);

    if (!currentStory) {
      changesCount++;
      return serverStory; // Thẻ mới trên server
    }

    // Kiểm tra xem có thay đổi hay không
    const storyChanged = 
      currentStory.title !== serverStory.title ||
      currentStory.status !== serverStory.status ||
      currentStory.priority !== serverStory.priority ||
      currentStory.assigneeId !== serverStory.assigneeId ||
      currentStory.sprintId !== serverStory.sprintId;

    // Đối chiếu tasks bên trong story
    const serverTasks = Array.isArray(serverStory.tasks) ? serverStory.tasks : [];
    const currentTasks = Array.isArray(currentStory.tasks) ? currentStory.tasks : [];
    const currentTaskMap = new Map(currentTasks.map(t => [t.id, t]));

    let tasksChanged = serverTasks.length !== currentTasks.length;

    const reconciledTasks = deduplicateById(serverTasks).map(serverTask => {
      const curTask = currentTaskMap.get(serverTask.id);
      if (!curTask) {
        tasksChanged = true;
        return serverTask;
      }
      if (
        curTask.title !== serverTask.title ||
        curTask.status !== serverTask.status ||
        curTask.assigneeId !== serverTask.assigneeId
      ) {
        tasksChanged = true;
      }
      return serverTask;
    });

    if (storyChanged || tasksChanged) {
      changesCount++;
    }

    return {
      ...serverStory,
      tasks: reconciledTasks
    };
  });

  // Kiểm tra xem có story nào bị xóa trên server không
  for (const curId of currentStoryMap.keys()) {
    if (!serverStoryMap.has(curId)) {
      changesCount++;
    }
  }

  const finalClean = sanitizeStoriesTree(reconciled);
  const durationMs = performance.now() - startTime;

  return {
    stories: finalClean,
    changesCount,
    durationMs
  };
}

