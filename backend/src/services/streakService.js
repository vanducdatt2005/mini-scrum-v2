/**
 * Sprint Daily Streak Service
 * Tính chuỗi ngày gửi Daily liên tiếp trong phạm vi ngày của Sprint đang hoạt động.
 * Lưu ý: Chỉ để vui — không tính điểm.
 */

const STREAK_DISCLAIMER = "Chỉ để vui — không tính điểm";

/**
 * Lấy chuỗi YYYY-MM-DD theo múi giờ chuẩn (mặc định Asia/Ho_Chi_Minh)
 */
function getLocalDateString(d = new Date(), timeZone = 'Asia/Ho_Chi_Minh') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Chuẩn hóa Date hoặc string thành chuỗi YYYY-MM-DD
 */
function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Trả về ngày làm việc liền trước (YYYY-MM-DD)
 * - Mặc định (skipWeekends = false): lùi 1 ngày dương lịch (diffDays === 1)
 * - Nếu skipWeekends = true: bỏ qua Thứ 7 (6) và Chủ nhật (0)
 */
function getPreviousWorkingDay(dateStr, skipWeekends = false) {
  const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
  dateObj.setUTCDate(dateObj.getUTCDate() - 1);

  if (skipWeekends) {
    while (dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6) {
      dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    }
  }

  return dateObj.toISOString().slice(0, 10);
}

/**
 * Thuật toán tính Current Streak & Longest Streak trong phạm vi Sprint (AC1)
 */
function calculateDailyStreak({
  reportDates = [],
  sprintStartDate = null,
  sprintEndDate = null,
  todayStr = getLocalDateString(),
  skipWeekends = false
}) {
  const startStr = formatDateOnly(sprintStartDate);
  const endStr = formatDateOnly(sprintEndDate);

  // Lọc các ngày nằm trong phạm vi [sprint.start_date, sprint.end_date]
  const validDates = [];
  const seen = new Set();

  for (const raw of reportDates) {
    const d = formatDateOnly(raw);
    if (!d) continue;
    if (startStr && d < startStr) continue;
    if (endStr && d > endStr) continue;
    if (!seen.has(d)) {
      seen.add(d);
      validDates.push(d);
    }
  }

  const hasSubmittedToday = seen.has(todayStr);

  // 1. Tính Current Streak
  let currentStreak = 0;
  let cursor = null;

  if (hasSubmittedToday) {
    // Trường hợp 1: Hôm nay đã gửi -> đếm ngược từ hôm nay
    cursor = todayStr;
  } else {
    // Trường hợp 2: Hôm nay chưa gửi, kiểm tra hôm qua có gửi không
    const yesterdayStr = getPreviousWorkingDay(todayStr, skipWeekends);
    if (seen.has(yesterdayStr)) {
      cursor = yesterdayStr;
    }
    // Trường hợp 3: Cả hôm nay lẫn hôm qua đều không gửi -> streak = 0
  }

  while (cursor && seen.has(cursor)) {
    if (startStr && cursor < startStr) break;
    currentStreak += 1;
    cursor = getPreviousWorkingDay(cursor, skipWeekends);
  }

  // 2. Tính Longest Streak trong Sprint
  const sortedAsc = [...validDates].sort();
  let longestStreakInSprint = 0;
  let currentRun = 0;

  for (let i = 0; i < sortedAsc.length; i += 1) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const expectedPrev = getPreviousWorkingDay(sortedAsc[i], skipWeekends);
      if (expectedPrev === sortedAsc[i - 1]) {
        currentRun += 1;
      } else {
        currentRun = 1;
      }
    }
    if (currentRun > longestStreakInSprint) {
      longestStreakInSprint = currentRun;
    }
  }

  longestStreakInSprint = Math.max(longestStreakInSprint, currentStreak);

  return {
    currentStreak,
    longestStreakInSprint,
    hasSubmittedToday
  };
}

/**
 * Truy vấn DB và trả về thống kê Sprint Daily Streak cho user
 */
async function getUserDailyStreak(prisma, userId, options = {}) {
  const { sprintId = null, skipWeekends = false, todayStr = getLocalDateString() } = options;

  let sprint = null;

  if (sprintId) {
    sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        projectId: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });
  } else {
    // Tự động tìm Active Sprint hiện tại của user
    sprint = await prisma.sprint.findFirst({
      where: {
        status: 'ACTIVE',
        project: {
          members: {
            some: {
              userId,
              status: 'ACCEPTED'
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        projectId: true,
        startDate: true,
        endDate: true,
        status: true
      },
      orderBy: [
        { startDate: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  if (!sprint) {
    return {
      sprintId: null,
      sprintName: null,
      projectId: null,
      currentStreak: 0,
      longestStreakInSprint: 0,
      hasSubmittedToday: false,
      disclaimer: STREAK_DISCLAIMER
    };
  }

  const standups = await prisma.dailyStandup.findMany({
    where: {
      userId,
      sprintId: sprint.id
    },
    select: { reportDate: true },
    orderBy: { reportDate: 'desc' }
  });

  const stats = calculateDailyStreak({
    reportDates: standups.map(s => s.reportDate),
    sprintStartDate: sprint.startDate,
    sprintEndDate: sprint.endDate,
    todayStr,
    skipWeekends
  });

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    projectId: sprint.projectId,
    ...stats,
    disclaimer: STREAK_DISCLAIMER
  };
}

module.exports = {
  STREAK_DISCLAIMER,
  getLocalDateString,
  formatDateOnly,
  getPreviousWorkingDay,
  calculateDailyStreak,
  getUserDailyStreak
};
