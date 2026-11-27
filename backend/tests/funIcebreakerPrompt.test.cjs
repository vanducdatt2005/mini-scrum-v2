/**
 * Unit & Integration Test: Câu hỏi phụ vui nhộn ngẫu nhiên (Fun Icebreaker Prompt - 30% chance, Optional)
 * Kiểm chứng 4 tiêu chí DoD:
 * 1. DoD Config Check: FUN_PROMPTS_POOL >= 10 phần tử, chuỗi tiếng Việt hợp lệ, không rỗng.
 * 2. AC1 Random Probability Test: Mock Math.random = 0.25 (<= 0.3) -> hiện prompt; 0.75 (> 0.3) -> null.
 * 3. AC2 Pass (Bỏ trống vẫn gửi thành công): funPromptAnswer: "" / "   " -> 201 Created, DB lưu null.
 * 4. Có nhập câu phụ: Lưu đầy đủ cả funPromptQuestion và funPromptAnswer vào DB & trả về qua Daily Digest.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const { FUN_PROMPTS_POOL, FUN_PROMPT_PROBABILITY } = require('../src/config/daily-prompts.config');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BASE_URL = 'http://localhost:5000/api';

async function runFunPromptTests() {
  console.log('🧪 Bắt đầu Unit & Integration Test cho tính năng Fun Icebreaker Prompt (30% chance, Optional)...');

  // ========================================================
  // TEST 1: DoD CONFIG CHECK
  // ========================================================
  console.log('\n--- TEST 1: DoD Config Check (FUN_PROMPTS_POOL) ---');
  assert.ok(Array.isArray(FUN_PROMPTS_POOL), 'FUN_PROMPTS_POOL phải là mảng');
  assert.ok(FUN_PROMPTS_POOL.length >= 10, `Pool phải có >= 10 câu hỏi (hiện có ${FUN_PROMPTS_POOL.length})`);
  assert.strictEqual(FUN_PROMPT_PROBABILITY, 0.3, 'Tỷ lệ xác suất phải là 0.3 (30%)');

  FUN_PROMPTS_POOL.forEach((item, idx) => {
    assert.ok(item.id && typeof item.id === 'string' && item.id.trim().length > 0, `Item #${idx} thiếu id hợp lệ`);
    assert.ok(item.question && typeof item.question === 'string' && item.question.trim().length > 5, `Item #${idx} thiếu question tiếng Việt hợp lệ`);
  });
  console.log(`✅ TEST 1 PASSED: Config pool có ${FUN_PROMPTS_POOL.length} câu hỏi tiếng Việt hợp lệ.`);

  // ========================================================
  // TEST 2: AC1 RANDOM PROBABILITY TEST (Frontend helper)
  // ========================================================
  console.log('\n--- TEST 2: AC1 Random Probability Test (Mock Math.random) ---');
  const frontendConfigPath = pathToFileURL(
    path.resolve(__dirname, '../../frontend/src/config/daily-prompts.config.js')
  ).href;
  const frontendConfig = await import(frontendConfigPath);

  assert.strictEqual(frontendConfig.FUN_PROMPTS_POOL.length, FUN_PROMPTS_POOL.length, 'Pool frontend và backend phải đồng bộ');

  // Mock Math.random = 0.25 (<= 0.3) -> Phải hiển thị 1 câu hỏi từ pool
  const hitPrompt = frontendConfig.pickRandomFunPrompt(() => 0.25);
  assert.ok(hitPrompt !== null, 'Khi random = 0.25 (<= 0.3), phải trả về 1 câu hỏi phụ');
  assert.ok(
    frontendConfig.FUN_PROMPTS_POOL.some(p => p.id === hitPrompt.id && p.question === hitPrompt.question),
    'Câu hỏi được chọn phải nằm trong FUN_PROMPTS_POOL'
  );
  console.log(`   -> Mock 0.25 (<= 0.3): Hiện câu hỏi "${hitPrompt.question}"`);

  // Mock Math.random = 0.75 (> 0.3) -> Phải ẩn (trả về null)
  const missPrompt = frontendConfig.pickRandomFunPrompt(() => 0.75);
  assert.strictEqual(missPrompt, null, 'Khi random = 0.75 (> 0.3), phải ẩn câu hỏi phụ (trả về null)');
  console.log('   -> Mock 0.75 (> 0.3): Ẩn câu hỏi phụ (null)');
  console.log('✅ TEST 2 PASSED: Cơ chế random 30% hoạt động chính xác.');

  // ========================================================
  // CHUẨN BỊ DỮ LIỆU INTEGRATION TEST API
  // ========================================================
  const sprint = await prisma.sprint.findFirst({
    where: { status: 'ACTIVE' },
    include: { project: true }
  });
  if (!sprint) {
    console.error('❌ Không tìm thấy Active Sprint để test.');
    process.exit(1);
  }

  let testUser = await prisma.user.findFirst({ where: { email: 'fun_prompt_test@miniscrum.local' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'fun_prompt_test@miniscrum.local',
        password: 'hashed_password_fun',
        fullName: 'Fun Prompt Tester',
        role: 'USER'
      }
    });
  }

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: testUser.id, projectId: sprint.projectId } },
    update: { role: 'MEMBER', status: 'ACCEPTED' },
    create: { userId: testUser.id, projectId: sprint.projectId, role: 'MEMBER', status: 'ACCEPTED' }
  });

  const token = jwt.sign({ userId: testUser.id, email: testUser.email, role: 'MEMBER' }, JWT_SECRET, { expiresIn: '1h' });

  // Dùng ngày test riêng để không đụng dữ liệu thật
  const testDateEmpty = '2026-11-26';
  const testDateFilled = '2026-11-27';

  await prisma.dailyStandup.deleteMany({
    where: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: { in: [new Date(`${testDateEmpty}T00:00:00.000Z`), new Date(`${testDateFilled}T00:00:00.000Z`)] }
    }
  });

  // ========================================================
  // TEST 3: AC2 PASS - BỎ TRỐNG CÂU PHỤ VẪN GỬI THÀNH CÔNG (201)
  // ========================================================
  console.log('\n--- TEST 3: AC2 Pass - Bỏ trống câu hỏi phụ vẫn gửi thành công & lưu null ---');
  const emptyFunRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      report_date: testDateEmpty,
      yesterday_work: 'Hoàn thành API cấu hình prompt',
      today_plan: 'Tích hợp vào QuickDailyStandupForm',
      blockers: 'Không có',
      fun_prompt_question: FUN_PROMPTS_POOL[0].question,
      fun_prompt_answer: '   ' // Chỉ khoảng trắng -> phải được làm sạch thành null
    })
  });

  const emptyFunData = await emptyFunRes.json();
  console.log(`Status POST (bỏ trống câu phụ): ${emptyFunRes.status}`);
  assert.strictEqual(emptyFunRes.status, 201, `Mong đợi 201 Created, nhận được ${emptyFunRes.status}`);
  assert.strictEqual(emptyFunData.funPromptAnswer, null, 'fun_prompt_answer phải là null khi bỏ trống');
  assert.strictEqual(emptyFunData.funPromptQuestion, null, 'fun_prompt_question phải là null để tránh lưu rác khi không trả lời');
  console.log('✅ TEST 3 PASSED: Bỏ trống câu hỏi phụ vẫn gửi thành công 201 Created, DB lưu null.');

  // ========================================================
  // TEST 4: CÓ NHẬP CÂU PHỤ -> LƯU ĐẦY ĐỦ & TRẢ QUA DAILY DIGEST
  // ========================================================
  console.log('\n--- TEST 4: Có nhập câu phụ -> Lưu DB đầy đủ & hiển thị trên Daily Digest ---');
  const chosenQuestion = FUN_PROMPTS_POOL[0].question;
  const chosenAnswer = 'Sáng nay chạy deadline sớm';

  const filledFunRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      report_date: testDateFilled,
      yesterday_work: 'Code chức năng random 30%',
      today_plan: 'Chạy Integration Test toàn bộ module',
      blockers: 'Không có',
      funPromptQuestion: chosenQuestion,
      funPromptAnswer: `  ${chosenAnswer}  `
    })
  });

  const filledFunData = await filledFunRes.json();
  console.log(`Status POST (có nhập câu phụ): ${filledFunRes.status}`);
  assert.strictEqual(filledFunRes.status, 201, `Mong đợi 201 Created, nhận được ${filledFunRes.status}`);
  assert.strictEqual(filledFunData.funPromptQuestion, chosenQuestion);
  assert.strictEqual(filledFunData.funPromptAnswer, chosenAnswer);

  // Kiểm tra API Daily Digest trả kèm funPromptQuestion & funPromptAnswer
  const digestRes = await fetch(
    `${BASE_URL}/projects/${sprint.projectId}/sprints/${sprint.id}/daily-digest?date=${testDateFilled}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  assert.strictEqual(digestRes.status, 200);
  const digestData = await digestRes.json();
  const matchedItem = digestData.items.find(i => i.id === filledFunData.id);
  assert.ok(matchedItem, 'Phải tìm thấy bản ghi trong Daily Digest');
  assert.strictEqual(matchedItem.funPromptQuestion, chosenQuestion);
  assert.strictEqual(matchedItem.funPromptAnswer, chosenAnswer);
  console.log(`   -> Digest Item: "${matchedItem.funPromptQuestion}" => "${matchedItem.funPromptAnswer}"`);
  console.log('✅ TEST 4 PASSED: Lưu đầy đủ câu hỏi & câu trả lời phụ, đồng bộ chuẩn sang Daily Digest.');

  // Dọn dẹp bản ghi test để không làm bẩn dữ liệu sprint của user
  await prisma.dailyStandup.deleteMany({
    where: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: { in: [new Date(`${testDateEmpty}T00:00:00.000Z`), new Date(`${testDateFilled}T00:00:00.000Z`)] }
    }
  });

  console.log('\n🎉 TẤT CẢ 4 BÀI TEST FUN ICEBREAKER PROMPT ĐÃ PASS 100%!\n');
}

runFunPromptTests()
  .catch(err => {
    console.error('❌ Test thất bại:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
