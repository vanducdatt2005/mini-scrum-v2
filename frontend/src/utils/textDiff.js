/**
 * Helper tính toán Diff giữa 2 văn bản theo cấp độ từ (Word-level Diff)
 * Sử dụng giải thuật Longest Common Subsequence (LCS)
 */

export function computeWordDiff(oldText = '', newText = '') {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ type: 'added', value: newText }];
  if (!newText) return [{ type: 'removed', value: oldText }];
  if (oldText === newText) return [{ type: 'unchanged', value: oldText }];

  // Phân tách chuỗi thành các từ và khoảng trắng / dấu câu
  const tokenize = (str) => str.match(/\S+|\s+/g) || [];

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  const n = oldTokens.length;
  const m = newTokens.length;

  // Giới hạn độ dài để tránh quá tải bộ nhớ nếu chuỗi quá khổng lồ
  if (n * m > 100000) {
    return [
      { type: 'removed', value: oldText },
      { type: 'added', value: newText }
    ];
  }

  // Khởi tạo bảng LCS DP
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (oldTokens[i] === newTokens[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Truy vết ngược để tạo diff chunks
  const diff = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      diff.unshift({ type: 'unchanged', value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', value: newTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'removed', value: oldTokens[i - 1] });
      i--;
    }
  }

  // Gộp các token liên tiếp cùng loại để tối ưu render
  const merged = [];
  for (const token of diff) {
    if (merged.length > 0 && merged[merged.length - 1].type === token.type) {
      merged[merged.length - 1].value += token.value;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
}

