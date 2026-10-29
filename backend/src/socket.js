const { Server } = require("socket.io");

let io = null;

function initSocket(server, prisma) {
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:3000',
          process.env.FRONTEND_URL,
        ].filter(Boolean);
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("joinProject", (projectId) => {
      if (projectId) {
        socket.join(projectId);
        console.log(`📂 Socket ${socket.id} joined project room: ${projectId}`);
      }
    });

    socket.on("leaveProject", (projectId) => {
      if (projectId) {
        socket.leave(projectId);
        console.log(`📂 Socket ${socket.id} left project room: ${projectId}`);
      }
    });

    socket.on("joinUser", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`👤 Socket ${socket.id} joined personal room: user_${userId}`);
      }
    });

    socket.on("leaveUser", (userId) => {
      if (userId) {
        socket.leave(`user_${userId}`);
        console.log(`👤 Socket ${socket.id} left personal room: user_${userId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  // Prisma Middleware to capture mutations and auto-emit
  prisma.$use(async (params, next) => {
    const result = await next(params);
    const targetModels = ["UserStory", "Task", "Comment"];
    const targetActions = ["create", "update", "delete", "updateMany", "deleteMany"];

    if (targetModels.includes(params.model) && targetActions.includes(params.action)) {
      try {
        let projectId = null;

        if (params.model === "UserStory") {
          if (["create", "update", "delete"].includes(params.action)) {
            projectId = result?.projectId;
          } else if (["updateMany", "deleteMany"].includes(params.action)) {
            projectId = params.args?.where?.projectId;
            if (!projectId && params.args?.where?.id?.in && params.args.where.id.in.length > 0) {
              const firstId = params.args.where.id.in[0];
              const story = await prisma.userStory.findUnique({
                where: { id: firstId },
                select: { projectId: true }
              });
              projectId = story?.projectId;
            }
          }
        } else if (params.model === "Task") {
          let storyId = null;
          if (["create", "update", "delete"].includes(params.action)) {
            storyId = result?.storyId;
          }
          if (storyId) {
            const story = await prisma.userStory.findUnique({
              where: { id: storyId },
              select: { projectId: true }
            });
            projectId = story?.projectId;
          }
        } else if (params.model === "Comment") {
          const comment = result || (params.args?.where?.id ? await prisma.comment.findUnique({ where: { id: params.args.where.id } }) : null);
          if (comment) {
            if (comment.userStoryId) {
              const story = await prisma.userStory.findUnique({ where: { id: comment.userStoryId }, select: { projectId: true } });
              projectId = story?.projectId;
            } else if (comment.taskId) {
              const task = await prisma.task.findUnique({ where: { id: comment.taskId }, include: { userStory: { select: { projectId: true } } } });
              projectId = task?.userStory?.projectId;
            }
          }
        }

        if (projectId && io) {
          let eventName = "userStory:changed";
          if (params.model === "Task") eventName = "task:changed";
          if (params.model === "Comment") eventName = "comment:changed";

          io.to(projectId).emit(eventName, {
            action: params.action,
            projectId,
            entityId: result?.userStoryId || result?.taskId || null
          });
          console.log(`📡 Emitted ${eventName} [${params.action}] to room ${projectId}`);

          // --- US-029: In-app Notification ---
          if (["create", "update", "delete"].includes(params.action)) {
            const title = result?.title || "Một tác vụ";
            const type = params.model === "Task" ? "TASK_CHANGED" : "STORY_CHANGED";
            const actionText = params.action === "create" ? "được tạo mới" : params.action === "update" ? "đã được cập nhật" : "đã bị xóa";
            const message = `${params.model === "Task" ? "Task" : "Story"} "${title}" ${actionText}`;
            const link = params.model === "Task" ? `/projects/${projectId}/board` : `/projects/${projectId}/backlog`;

            try {
              const members = await prisma.projectMember.findMany({
                where: { projectId, status: "ACCEPTED" }
              });

              for (const member of members) {
                // Không có senderId trong middleware params, nên có thể bỏ trống (System)
                const notif = await prisma.notification.create({
                  data: {
                    userId: member.userId,
                    content: message,
                    type: type,
                    taskTitle: title,
                    link: link
                  }
                });
                io.to(`user_${member.userId}`).emit("notification:new", notif);
              }
            } catch (err) {
              console.error("Lỗi khi tạo Notification:", err);
            }
          }
        }
      } catch (err) {
        console.error("Socket emit error:", err);
      }
    }
    return result;
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
