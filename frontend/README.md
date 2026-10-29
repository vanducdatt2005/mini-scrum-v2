# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# 1.Di chuyển vào thư mục backend
cd backend

# Cài đặt các thư viện cần thiết
npm install

# Tạo database cục bộ (Dành cho SQLite)
npx prisma generate
npx prisma db push
# Tạo file .env trong thư mục backend/ với nội dung sau:
DATABASE_URL="file:./dev.db"
JWT_SECRET="supersecretkey2026"
PORT=5000

# 2.Mở Terminal tại thư mục frontend/
cd ../frontend

# Cài đặt thư viện
npm install

# Chạy thử dự án
npm run dev

# Tech Stack sử dụng
Frontend: ReactJS (Vite), Material UI (MUI), Axios.
Backend: NodeJS, Express, Prisma ORM.

Database: SQLite (tiện lợi cho làm việc nhóm local).
# Danh sách các API đã hoàn thiện (Thúy)
POST /api/register: Đăng ký tài khoản (US-001).
POST /api/project: Tạo dự án (để test).
POST /api/userstory: Tạo User Story (để test).
GET /api/userstory/:id: Xem chi tiết User Story (US-006).
POST /api/project/:projectId/members: Thêm thành viên vào dự án (US-039).