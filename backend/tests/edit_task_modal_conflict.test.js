const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const esbuild = require('../../frontend/node_modules/esbuild');

// Đọc và transform EditTaskModal.jsx bằng esbuild (không cần cài thêm thư viện ngoài)
const editTaskModalPath = path.resolve(__dirname, '../../frontend/src/components/EditTaskModal.jsx');
const sourceCode = fs.readFileSync(editTaskModalPath, 'utf8');

// Tạo module tạm thời đã transpile JSX sang JS thuần
const transformed = esbuild.transformSync(sourceCode, {
  loader: 'jsx',
  format: 'cjs'
});

// Mock dependencies
const mockToast = {
  successCalledWith: null,
  errorCalledWith: null,
  success(msg) { this.successCalledWith = msg; },
  error(msg) { this.errorCalledWith = msg; },
  reset() { this.successCalledWith = null; this.errorCalledWith = null; }
};

const mod = { exports: {} };
const moduleScope = {
  require: (name) => {
    if (name === 'react') return require('../../frontend/node_modules/react');
    if (name === 'react-hot-toast') return { default: mockToast };
    if (name.includes('conflictUtils')) {
      return require('../../frontend/src/utils/conflictUtils.js');
    }
    if (name.includes('SocketContext')) {
      return { getSocket: () => null };
    }
    if (name.includes('services/api')) {
      return { updateTask: async () => ({}) };
    }
    return require(name);
  }
};

const runTransformed = new Function('module', 'exports', 'require', transformed.code);
runTransformed(mod, mod.exports, moduleScope.require);

const { useEditTaskModal } = mod.exports;

/**
 * Harness giả lập vòng đời React hooks (useState, useEffect, useRef) để test Hook độc lập
 */
function createHookHarness(hookFn, initialProps) {
  let props = { ...initialProps };
  let stateIndex = 0;
  const states = [];
  const stateSetters = [];
  let effectIndex = 0;
  const effects = [];
  let refIndex = 0;
  const refs = [];
  let result;

  const ReactMock = {
    useState(initial) {
      const idx = stateIndex++;
      if (states.length <= idx) {
        states[idx] = typeof initial === 'function' ? initial() : initial;
        stateSetters[idx] = (newVal) => {
          states[idx] = typeof newVal === 'function' ? newVal(states[idx]) : newVal;
          flush();
        };
      }
      return [states[idx], stateSetters[idx]];
    },
    useRef(initial) {
      const idx = refIndex++;
      if (refs.length <= idx) {
        refs[idx] = { current: initial };
      }
      return refs[idx];
    },
    useEffect(effect, deps) {
      const idx = effectIndex++;
      if (effects.length <= idx) {
        effects[idx] = { effect, deps, cleanup: null };
      } else {
        const prev = effects[idx];
        const changed = !deps || !prev.deps || deps.some((d, i) => d !== prev.deps[i]);
        if (changed) {
          effects[idx] = { effect, deps, cleanup: prev.cleanup };
        }
      }
    }
  };

  function flush() {
    stateIndex = 0;
    effectIndex = 0;
    refIndex = 0;
    result = hookFn(props, ReactMock);

    // Chạy các effect mới
    for (const eff of effects) {
      if (eff.cleanup) {
        eff.cleanup();
        eff.cleanup = null;
      }
      const cleanup = eff.effect();
      if (typeof cleanup === 'function') {
        eff.cleanup = cleanup;
      }
    }
  }

  flush();

  return {
    get current() {
      return result;
    },
    rerender(newProps) {
      props = { ...props, ...newProps };
      flush();
    },
    unmount() {
      for (const eff of effects) {
        if (typeof eff.cleanup === 'function') eff.cleanup();
      }
    }
  };
}

test('Integration Test cho EditTaskModal (SCRUM-66)', async (t) => {

  await t.test('a) Kiểm tra click "Sao chép" gọi đúng clipboard API và Toast, KHÔNG reset form/banner', async () => {
    let clipboardWrittenText = null;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: async (text) => {
          clipboardWrittenText = text;
          return true;
        }
      },
      configurable: true,
      writable: true
    });
    mockToast.reset();

    const initialTask = {
      id: 'task-101',
      title: 'Bản nháp ban đầu',
      description: 'Mô tả nháp ban đầu',
      status: 'TODO',
      version: 1
    };

    const harness = createHookHarness(useEditTaskModal, {
      isOpen: true,
      task: initialTask,
      members: [],
      toastLib: mockToast
    });

    // Người dùng chỉnh sửa nội dung form
    harness.current.setForm({
      title: 'Tiêu đề người dùng đang nhập dở',
      description: 'Mô tả chi tiết đang nhập dở',
      status: 'IN_PROGRESS',
      assigneeId: '',
      dueDate: ''
    });

    // Giả lập trạng thái có conflict
    harness.current.setConflict({
      message: 'Task này vừa được người khác cập nhật.',
      latestTask: { id: 'task-101', title: 'Tiêu đề mới trên Server', version: 2 }
    });

    // Click "Sao chép nội dung của tôi"
    const copyResult = await harness.current.handleCopyDraft();
    assert.equal(copyResult, true, 'Copy qua clipboard API phải trả về true');

    // Kiểm tra clipboard API nhận đúng text
    assert.ok(clipboardWrittenText.includes('Tiêu đề: Tiêu đề người dùng đang nhập dở'));
    assert.ok(clipboardWrittenText.includes('Mô tả: Mô tả chi tiết đang nhập dở'));

    // Kiểm tra Toast được gọi đúng nội dung
    assert.equal(mockToast.successCalledWith, 'Đã sao chép nội dung nháp!');

    // KHÔNG reset form, KHÔNG đóng banner
    assert.equal(harness.current.form.title, 'Tiêu đề người dùng đang nhập dở');
    assert.equal(harness.current.form.description, 'Mô tả chi tiết đang nhập dở');
    assert.ok(harness.current.conflict !== null, 'Banner xung đột vẫn phải hiển thị');

    // Kiểm tra tiếp luồng FALLBACK khi navigator.clipboard.writeText không hỗ trợ hoặc lỗi
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true
    });

    let execCommandAction = null;
    let appendedElement = null;
    global.document = {
      createElement: (tag) => {
        const el = { tag, value: '', style: {}, setAttribute: () => {}, select: () => {} };
        return el;
      },
      body: {
        appendChild: (el) => { appendedElement = el; },
        removeChild: () => { appendedElement = null; }
      },
      execCommand: (cmd) => {
        execCommandAction = cmd;
        return true;
      }
    };

    mockToast.reset();
    const fallbackResult = await harness.current.handleCopyDraft();
    assert.equal(fallbackResult, true, 'Fallback copy qua textarea + execCommand phải trả về true');
    assert.equal(execCommandAction, 'copy');
    assert.equal(mockToast.successCalledWith, 'Đã sao chép nội dung nháp!');
  });

  await t.test('b) Kiểm tra khi banner xung đột đang hiện, socket event và task prop cập nhật thì form KHÔNG bị reset (DoD - No Data Loss)', async () => {
    let socketHandler = null;
    const mockSocket = {
      on(event, handler) {
        if (event === 'task:changed') socketHandler = handler;
      },
      off(event, handler) {
        if (event === 'task:changed') socketHandler = null;
      }
    };

    const initialTask = {
      id: 'task-202',
      title: 'Tiêu đề ban đầu',
      description: 'Mô tả ban đầu',
      status: 'TODO',
      version: 2
    };

    const harness = createHookHarness(useEditTaskModal, {
      isOpen: true,
      task: initialTask,
      members: [],
      socket: mockSocket,
      toastLib: mockToast
    });

    // Người dùng gõ nội dung mới vào form
    const userDraftTitle = 'Nội dung quan trọng tôi vừa gõ xong';
    harness.current.setForm({
      ...harness.current.form,
      title: userDraftTitle
    });

    // Giả lập banner xung đột đang hiện
    harness.current.setConflict({
      message: 'Task này vừa được Nguyễn Văn A cập nhật.',
      latestTask: {
        id: 'task-202',
        title: 'Bản của Server vừa ghi đè',
        version: 3,
        updated_at: new Date().toISOString()
      }
    });

    assert.ok(harness.current.conflict !== null, 'Banner xung đột đang hiển thị');

    // Giả lập Socket event task:changed đẩy dữ liệu mới tới
    if (socketHandler) {
      socketHandler({
        action: 'update',
        entityId: 'task-202',
        data: {
          id: 'task-202',
          title: 'Dữ liệu từ Socket mới nhất',
          version: 4
        }
      });
    }

    // Giả lập component cha re-render và truyền task prop mới vào
    harness.rerender({
      task: {
        id: 'task-202',
        title: 'Dữ liệu từ Socket mới nhất',
        version: 4
      }
    });

    // KIỂM TRA QUAN TRỌNG (No Data Loss): Form KHÔNG bị reset!
    assert.equal(
      harness.current.form.title,
      userDraftTitle,
      'Form title phải giữ nguyên bản nháp của user, không bị socket hay prop ghi đè'
    );
    assert.ok(harness.current.conflict !== null, 'Banner xung đột vẫn phải duy trì');
  });

  await t.test('c) Kiểm tra click "Nạp bản mới nhất" thì form và V_current cập nhật đúng latestTask', async () => {
    const initialTask = {
      id: 'task-303',
      title: 'Task cũ',
      description: 'Mô tả cũ',
      status: 'TODO',
      version: 1
    };

    const harness = createHookHarness(useEditTaskModal, {
      isOpen: true,
      task: initialTask,
      members: [],
      toastLib: mockToast
    });

    // Người dùng nhập dở
    harness.current.setForm({
      ...harness.current.form,
      title: 'Bản nháp của tôi đang có xung đột'
    });

    // Server trả về latestTask trong conflict (version 5)
    const latestServerTask = {
      id: 'task-303',
      title: 'Tiêu đề chuẩn nhất trên Server',
      description: 'Mô tả chuẩn nhất trên Server',
      status: 'DONE',
      assigneeId: 'user-xyz',
      dueDate: '2026-12-31',
      version: 5,
      updated_at: new Date(Date.now() - 120000).toISOString() // 2 phút trước
    };

    harness.current.setConflict({
      message: 'Task vừa được cập nhật',
      latestTask: latestServerTask
    });

    // Người dùng click "Nạp bản mới nhất"
    harness.current.handleReloadLatest();

    // KIỂM TRA:
    // 1. Form cập nhật đúng dữ liệu của latestTask
    assert.equal(harness.current.form.title, 'Tiêu đề chuẩn nhất trên Server');
    assert.equal(harness.current.form.description, 'Mô tả chuẩn nhất trên Server');
    assert.equal(harness.current.form.status, 'DONE');
    assert.equal(harness.current.form.assigneeId, 'user-xyz');
    assert.equal(harness.current.form.dueDate, '2026-12-31');

    // 2. V_current cập nhật đúng version mới (5)
    assert.equal(harness.current.vCurrent, 5);

    // 3. Banner xung đột được ẩn đi
    assert.equal(harness.current.conflict, null);

    // 4. Bảng diff được đóng lại
    assert.equal(harness.current.showDiff, false);
  });

  await t.test('d) Kiểm tra format thời gian tương đối và nhãn Diff View', async () => {
    const { formatTimeAgo } = require('../../frontend/src/utils/conflictUtils.js');
    assert.equal(formatTimeAgo(new Date()), 'vừa xong');
    assert.equal(formatTimeAgo(new Date(Date.now() - 30000)), '30 giây trước');
    assert.equal(formatTimeAgo(new Date(Date.now() - 5 * 60 * 1000)), '5 phút trước');
    assert.equal(formatTimeAgo(new Date(Date.now() - 3 * 3600 * 1000)), '3 giờ trước');
    assert.equal(formatTimeAgo(new Date(Date.now() - 2 * 86400 * 1000)), '2 ngày trước');
  });
});
