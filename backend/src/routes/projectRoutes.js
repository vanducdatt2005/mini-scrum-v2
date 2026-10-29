// backend/src/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Giả sử đã có middleware auth (req.user) từ phần login/register
// Nếu chưa có thì tạm bỏ check quyền, sau bổ sung

// GET chi tiết project (nếu chưa có)
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update project – đây là endpoint chính cho US-037
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, goal } = req.body;

    // Optional: Check quyền (chỉ PO được edit)
    // const member = await prisma.projectMember.findFirst({
    //   where: {
    //     projectId: req.params.id,
    //     userId: req.user?.id, // giả sử middleware auth gắn req.user
    //     role: 'PO'
    //   }
    // });
    // if (!member) return res.status(403).json({ error: 'No permission to edit' });

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        goal: goal !== undefined ? goal : undefined,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;