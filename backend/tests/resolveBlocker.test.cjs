const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'mini_scrum_secret';

async function runTests() {
  console.log('🧪 Bắt đầu Integration Test cho tính năng "Ai đang kẹt" & Gỡ Blocker (AC1, AC2, DoD Permission)...');

  // 1. Lấy thông tin sprint active
  const sprint = await prisma.sprint.findFirst({
    where: { status: 'ACTIVE' },
    include: { project: true }
  });

  if (!sprint) {
    console.error('❌ Không tìm thấy Active Sprint để test.');
    process.exit(1);
  }

  console.log(`🏃 Active Sprint: "${sprint.name}" (ID: ${sprint.id}, Project: ${sprint.projectId})`);

  // 2. Tìm hoặc tạo 3 user riêng biệt cho 3 role: SM, PO, và MEMBER
  let smUser = await prisma.user.findFirst({ where: { email: 'test_sm@miniscrum.local' } });
  if (!smUser) {
    smUser = await prisma.user.create({
      data: {
        email: 'test_sm@miniscrum.local',
        password: 'hashed_password_sm',
        fullName: 'Test Scrum Master',
        role: 'USER'
      }
    });
  }
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: smUser.id, projectId: sprint.projectId } },
    update: { role: 'SM', status: 'ACCEPTED' },
    create: { userId: smUser.id, projectId: sprint.projectId, role: 'SM', status: 'ACCEPTED' }
  });
  const smMember = { user: smUser, role: 'SM' };

  let poUser = await prisma.user.findFirst({ where: { email: 'test_po@miniscrum.local' } });
  if (!poUser) {
    poUser = await prisma.user.create({
      data: {
        email: 'test_po@miniscrum.local',
        password: 'hashed_password_po',
        fullName: 'Test Product Owner',
        role: 'USER'
      }
    });
  }
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: poUser.id, projectId: sprint.projectId } },
    update: { role: 'PO', status: 'ACCEPTED' },
    create: { userId: poUser.id, projectId: sprint.projectId, role: 'PO', status: 'ACCEPTED' }
  });
  const poMember = { user: poUser, role: 'PO' };

  let devUser = await prisma.user.findFirst({ where: { email: 'test_dev_member@miniscrum.local' } });
  if (!devUser) {
    devUser = await prisma.user.create({
      data: {
        email: 'test_dev_member@miniscrum.local',
        password: 'hashed_password_dev',
        fullName: 'Test Dev Member',
        role: 'USER'
      }
    });
  }
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: devUser.id, projectId: sprint.projectId } },
    update: { role: 'MEMBER', status: 'ACCEPTED' },
    create: { userId: devUser.id, projectId: sprint.projectId, role: 'MEMBER', status: 'ACCEPTED' }
  });
  const regularMember = { user: devUser, role: 'MEMBER' };

  console.log(`👑 SM User:     ${smMember.user.fullName || smMember.user.email} (${smMember.user.id})`);
  console.log(`🎯 PO User:     ${poMember.user.fullName || poMember.user.email} (${poMember.user.id})`);
  console.log(`👤 Member User: ${regularMember.user.fullName || regularMember.user.email} (${regularMember.user.id})`);

  const smToken = jwt.sign({ userId: smMember.user.id, email: smMember.user.email, role: 'SM' }, JWT_SECRET, { expiresIn: '1h' });
  const poToken = jwt.sign({ userId: poMember.user.id, email: poMember.user.email, role: 'PO' }, JWT_SECRET, { expiresIn: '1h' });
  const memberToken = jwt.sign({ userId: regularMember.user.id, email: regularMember.user.email, role: 'MEMBER' }, JWT_SECRET, { expiresIn: '1h' });

  // Dọn dẹp các standups test cũ trong sprint này
  await prisma.dailyStandup.deleteMany({
    where: { sprintId: sprint.id }
  });

  // ========================================================
  // TEST CASE 1: AC1 PASS - TẠO 3 DAILY BLOCKED VÀ SORT MỚI NHẤT ĐỨNG ĐẦU
  // ========================================================
  console.log('\n--- TEST CASE 1: AC1 Pass - Lấy danh sách OPEN Blockers sắp xếp mới nhất đứng đầu ---');

  const now = Date.now();
  const d1 = await prisma.dailyStandup.create({
    data: {
      userId: regularMember.user.id,
      sprintId: sprint.id,
      reportDate: new Date('2026-11-15T00:00:00.000Z'),
      createdAt: new Date(now - 100000), // cũ nhất
      yesterdayWork: 'Task 1',
      todayPlan: 'Task 2',
      blockers: 'Kẹt môi trường',
      blocked: true,
      blockerNote: 'Blocker 1: Kẹt cấu hình Docker',
      blockerStatus: 'OPEN'
    }
  });

  const d2 = await prisma.dailyStandup.create({
    data: {
      userId: smMember.user.id,
      sprintId: sprint.id,
      reportDate: new Date('2026-11-16T00:00:00.000Z'),
      createdAt: new Date(now - 50000), // ở giữa
      yesterdayWork: 'Task 3',
      todayPlan: 'Task 4',
      blockers: 'Kẹt database',
      blocked: true,
      blockerNote: 'Blocker 2: Chờ cấp quyền DB Production',
      blockerStatus: 'OPEN'
    }
  });

  const d3 = await prisma.dailyStandup.create({
    data: {
      userId: poMember.user.id,
      sprintId: sprint.id,
      reportDate: new Date('2026-11-17T00:00:00.000Z'),
      createdAt: new Date(now), // mới nhất
      yesterdayWork: 'Task 5',
      todayPlan: 'Task 6',
      blockers: 'Kẹt bên thứ 3',
      blocked: true,
      blockerNote: 'Blocker 3: Cổng thanh toán Sandbox bị lỗi 503',
      blockerStatus: 'OPEN'
    }
  });

  // Gọi API GET /blockers
  const getBlockersRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/blockers?status=OPEN`, {
    headers: { 'Authorization': `Bearer ${smToken}` }
  });

  console.log(`Status gọi GET /blockers: ${getBlockersRes.status}`);
  const blockersData = await getBlockersRes.json();
  console.log(`Tổng số blocker OPEN: ${blockersData.total}`);

  if (blockersData.total !== 3) {
    console.error(`❌ Vi phạm AC1: Số lượng blocker không đúng! Mong đợi: 3, nhận được: ${blockersData.total}`);
    process.exit(1);
  }

  // Kiểm tra thứ tự sắp xếp mới nhất đứng đầu (d3 -> d2 -> d1)
  const returnedIds = blockersData.blockers.map(b => b.id);
  console.log(`Thứ tự ID trả về:`, returnedIds);
  console.log(`Thứ tự mong đợi: `, [d3.id, d2.id, d1.id]);

  if (returnedIds[0] !== d3.id || returnedIds[1] !== d2.id || returnedIds[2] !== d1.id) {
    console.error(`❌ Vi phạm AC1: Sắp xếp chưa đúng thứ tự mới nhất lên đầu!`);
    process.exit(1);
  }
  console.log('✅ TEST CASE 1 PASSED: Lấy đúng 3 blocker OPEN và sắp xếp mới nhất đứng đầu.');

  // ========================================================
  // TEST CASE 2: DOD PERMISSION - CHẶN MEMBER GỠ BLOCKER (403 FORBIDDEN)
  // ========================================================
  console.log('\n--- TEST CASE 2: DoD Permission - Member cố tình gọi resolve -> 403 Forbidden ---');

  const memberResolveRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/blockers/${d1.id}/resolve`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  console.log(`Status gọi PATCH resolve bởi Member: ${memberResolveRes.status}`);
  const memberResolveData = await memberResolveRes.json();
  console.log(`Thông báo lỗi nhận được: "${memberResolveData.error}" (code: ${memberResolveData.code})`);

  if (memberResolveRes.status !== 403 || memberResolveData.code !== 'FORBIDDEN_ROLE') {
    console.error(`❌ Vi phạm DoD Permission: Member không bị chặn! Status: ${memberResolveRes.status}`);
    process.exit(1);
  }
  console.log('✅ TEST CASE 2 PASSED: Chặn Member gỡ Blocker thành công, trả về 403 Forbidden.');

  // ========================================================
  // TEST CASE 3: AC2 PASS - SCRUM MASTER GỠ BLOCKER THÀNH CÔNG VÀ BẢO TOÀN DỮ LIỆU GỐC
  // ========================================================
  console.log('\n--- TEST CASE 3: AC2 Pass - SM gỡ Blocker, trạng thái chuyển CLOSED và bảo toàn 100% dữ liệu gốc ---');

  const smResolveRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/blockers/${d1.id}/resolve`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${smToken}` }
  });

  console.log(`Status gọi PATCH resolve bởi SM: ${smResolveRes.status}`);
  if (smResolveRes.status !== 200) {
    const errText = await smResolveRes.text();
    console.error(`❌ SM gỡ Blocker thất bại: ${errText}`);
    process.exit(1);
  }

  const resolvedItem = await smResolveRes.json();
  console.log(`Kết quả trả về sau khi gỡ:`);
  console.log(`   - blockerStatus:     "${resolvedItem.blockerStatus}"`);
  console.log(`   - blockerResolvedAt: "${resolvedItem.blockerResolvedAt}"`);
  console.log(`   - blockerResolvedBy: "${resolvedItem.blockerResolvedBy}" (${resolvedItem.resolver?.fullName})`);

  // Kiểm tra d1 không còn trong danh sách OPEN
  const getOpenAfterResolve = await fetch(`${BASE_URL}/sprints/${sprint.id}/blockers?status=OPEN`, {
    headers: { 'Authorization': `Bearer ${smToken}` }
  });
  const openDataAfter = await getOpenAfterResolve.json();
  console.log(`Số lượng blocker OPEN còn lại: ${openDataAfter.total}`);

  if (openDataAfter.total !== 2 || openDataAfter.blockers.some(b => b.id === d1.id)) {
    console.error('❌ Vi phạm: Blocker đã gỡ vẫn xuất hiện trong danh sách OPEN!');
    process.exit(1);
  }

  // Kiểm tra d1 xuất hiện trong danh sách CLOSED
  const getClosedRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/blockers?status=CLOSED`, {
    headers: { 'Authorization': `Bearer ${smToken}` }
  });
  const closedData = await getClosedRes.json();
  if (!closedData.blockers.some(b => b.id === d1.id)) {
    console.error('❌ Vi phạm: Blocker đã gỡ không xuất hiện trong danh sách CLOSED!');
    process.exit(1);
  }

  // Kiểm tra BẢO TOÀN DỮ LIỆU GỐC: Gọi API lấy chi tiết Daily
  const detailRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/${d1.id}`, {
    headers: { 'Authorization': `Bearer ${smToken}` }
  });
  const detailData = await detailRes.json();

  if (detailData.yesterdayWork !== 'Task 1' ||
      detailData.todayPlan !== 'Task 2' ||
      detailData.blocked !== true ||
      detailData.blockerNote !== 'Blocker 1: Kẹt cấu hình Docker') {
    console.error('❌ Vi phạm AC2: Dữ liệu Daily gốc bị thay đổi hoặc mất mát!');
    process.exit(1);
  }
  console.log('✅ TEST CASE 3 PASSED: SM gỡ thành công, dữ liệu Daily gốc được bảo toàn 100%.');

  // ========================================================
  // TEST CASE 4: DOD PERMISSION - PRODUCT OWNER CŨNG CÓ QUYỀN GỠ BLOCKER
  // ========================================================
  console.log('\n--- TEST CASE 4: DoD Permission - PO gọi resolve -> 200 OK ---');

  const poResolveRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/blockers/${d2.id}/resolve`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${poToken}` }
  });

  console.log(`Status gọi PATCH resolve bởi PO: ${poResolveRes.status}`);
  if (poResolveRes.status !== 200) {
    const errText = await poResolveRes.text();
    console.error(`❌ PO gỡ Blocker thất bại: ${errText}`);
    process.exit(1);
  }
  console.log('✅ TEST CASE 4 PASSED: PO gỡ Blocker thành công (200 OK).');

  console.log('\n🎉 TẤT CẢ 4 BÀI TEST TÍNH NĂNG "AI ĐANG KẸT" & GỠ BLOCKER ĐÃ PASS 100%!');
  await prisma.$disconnect();
}

runTests().catch(err => {
  console.error('❌ Lỗi không xác định khi test:', err);
  process.exit(1);
});
