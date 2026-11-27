/**
 * Cấu hình Pool Câu hỏi phụ vui nhộn (Fun Icebreaker Prompts) cho Daily Standup
 * - Tỷ lệ xuất hiện: 30% (Math.random() <= 0.3) theo phiên mở form tạo mới
 * - Hoàn toàn tùy chọn (Optional)
 */

export const FUN_PROMPT_PROBABILITY = 0.3;

export const FUN_PROMPTS_POOL = [
    { id: 'coffee', question: 'Hôm nay bạn cần 1 ly cafe vì…' },
    { id: 'song', question: 'Nếu hôm nay là một bài hát, tên bài hát đó là gì?' },
    { id: 'smile', question: 'Một điều nhỏ khiến bạn mỉm cười hôm qua hoặc sáng nay là…' },
    { id: 'superpower', question: 'Siêu năng lực bạn muốn có nhất để xử lý task hôm nay là gì?' },
    { id: 'lunch', question: 'Món ăn trưa nay bạn đang nghĩ tới là…' },
    { id: 'battery', question: 'Độ pin năng lượng của bạn sáng nay đang ở mức bao nhiêu %?' },
    { id: 'thanks', question: 'Một lời cảm ơn nhanh bạn muốn gửi tới đồng đội nào hôm nay?' },
    { id: 'teleport', question: 'Nếu được dịch chuyển tức thời ngay sau giờ làm, bạn muốn đi đâu?' },
    { id: 'hardest-bug', question: "Bug hoặc thử thách nào hôm qua làm bạn thấy 'hack não' nhất?" },
    { id: 'relax', question: 'Kế hoạch thư giãn của bạn tối nay sau khi xong việc là gì?' },
    { id: 'keyword', question: 'Một từ khóa mô tả tâm trạng làm việc của bạn hôm nay?' },
    { id: 'cheer', question: 'Hôm nay bạn muốn đồng đội cổ vũ điều gì nhất?' }
];

/**
 * Xác suất 30% chọn ngẫu nhiên 1 câu hỏi phụ cho phiên mở form
 * @param {() => number} randomFn - Hàm sinh số ngẫu nhiên [0, 1) (mặc định Math.random, hỗ trợ inject để unit test)
 * @param {Array<{id: string, question: string}>} pool - Danh sách câu hỏi
 * @returns {{id: string, question: string} | null}
 */
export function pickRandomFunPrompt(randomFn = Math.random, pool = FUN_PROMPTS_POOL) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    if (randomFn() <= FUN_PROMPT_PROBABILITY) {
        const index = Math.min(Math.floor(randomFn() * pool.length), pool.length - 1);
        return pool[index];
    }
    return null;
}
