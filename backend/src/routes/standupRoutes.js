const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Middleware auth should be provided by index.js but we can define a local one or assume it's passed
// However, the standard way in this project seems to be defining routes in separate files.
// Let's assume the authMiddleware is passed or we can just use the one from index.js if we export it.
// Looking at index.js, it's not exported. I'll define a simple one here for now or expect it to be handled.
// Actually, I'll just use the userId from req.user which should be populated by the middleware in index.js.

// Create a new standup log
router.post('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { yesterday, today, blockers } = req.body;
  const userId = req.user.userId;

  try {
    // Check if already submitted today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existing = await prisma.dailyStandup.findFirst({
      where: {
        userId,
        projectId,
        date: {
          gte: startOfToday
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: "Bạn đã ghi Daily Stand-up cho ngày hôm nay rồi!" });
    }

    const standup = await prisma.dailyStandup.create({
      data: {
        yesterday,
        today,
        blockers,
        userId,
        projectId
      },
      include: {
        user: { select: { fullName: true } }
      }
    });

    res.status(201).json(standup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi lưu Daily Stand-up" });
  }
});

// Get standups for a project
router.get('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const standups = await prisma.dailyStandup.findMany({
      where: { projectId },
      include: {
        user: { select: { fullName: true, email: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(standups);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách Stand-up" });
  }
});

// Check if user has already submitted today
router.get('/project/:projectId/me/today', async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existing = await prisma.dailyStandup.findFirst({
      where: {
        userId,
        projectId,
        date: {
          gte: startOfToday
        }
      }
    });

    res.json({ submitted: !!existing, standup: existing });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
