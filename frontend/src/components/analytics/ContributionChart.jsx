/**
 * ContributionChart.jsx
 * -----------------------------------------------------------------------
 * Component biểu đồ đóng góp tái sử dụng (không cần thư viện ngoài).
 * Bao gồm:
 *  - Donut SVG Chart: biểu đồ tròn tỉ lệ đóng góp
 *  - Horizontal Bar List: thanh ngang cho từng thành viên
 *
 * Props:
 *  contributions: Array<{
 *    user: { fullName, email },
 *    contributionPct: number,
 *    storyPoints: number,
 *    roleInSprint: string,
 *    hoursWorked: number,
 *  }>
 * -----------------------------------------------------------------------
 */

import { useEffect, useRef } from 'react';

// Palette màu cho từng thành viên (tối đa 8 người)
const PALETTE = [
  { stroke: '#6366f1', bg: 'rgba(99,102,241,0.12)',  text: '#6366f1' },  // indigo
  { stroke: '#10b981', bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },  // emerald
  { stroke: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },  // amber
  { stroke: '#ef4444', bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },  // red
  { stroke: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  text: '#8b5cf6' },  // violet
  { stroke: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   text: '#06b6d4' },  // cyan
  { stroke: '#f97316', bg: 'rgba(249,115,22,0.12)',  text: '#f97316' },  // orange
  { stroke: '#ec4899', bg: 'rgba(236,72,153,0.12)',  text: '#ec4899' },  // pink
];

/** Trả về 2 chữ cái đầu tên (avatar fallback) */
const initials = (name) =>
  (name || '?').split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

/** ── Donut Chart (SVG thuần) ── */
function DonutChart({ contributions }) {
  const cx = 100, cy = 100, r = 76, strokeW = 20;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segments = contributions.map((c, i) => {
    const pct   = c.contributionPct / 100;
    const dash  = pct * circ;
    const gap   = circ - dash;
    const rot   = (offset / 100) * 360;
    offset += c.contributionPct;
    return { ...c, dash, gap, rot, color: PALETTE[i % PALETTE.length].stroke };
  });

  return (
    <div className="relative w-[200px] h-[200px] flex-shrink-0 mx-auto">
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full -rotate-90"
        aria-label="Biểu đồ tỉ lệ đóng góp"
      >
        {/* Track nền */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(0,0,0,0.06)" strokeWidth={strokeW} />
        {/* Segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeLinecap="round"
            transform={`rotate(${seg.rot} ${cx} ${cy})`}
            style={{ transition: `stroke-dasharray 1s ${i * 0.12}s ease` }}
          />
        ))}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-on-surface">
          {contributions.length}
        </span>
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
          thành viên
        </span>
      </div>
    </div>
  );
}

/** ── Horizontal Bar Row ── */
function BarRow({ c, index }) {
  const color  = PALETTE[index % PALETTE.length];
  const barRef = useRef(null);

  // Animate thanh tiến độ khi mount
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.width = `${c.contributionPct}%`;
      });
    });
  }, [c.contributionPct]);

  return (
    <div className="flex items-center gap-4 group">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border-2"
        style={{ background: color.bg, color: color.text, borderColor: color.stroke + '40' }}
      >
        {initials(c.user?.fullName)}
      </div>

      {/* Bar + labels */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-semibold text-on-surface truncate">
            {c.user?.fullName || c.user?.email || 'Ẩn danh'}
          </span>
          <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: color.text }}>
            {c.contributionPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
          <div
            ref={barRef}
            className="h-full rounded-full relative overflow-hidden"
            style={{
              background: `linear-gradient(90deg, ${color.stroke}88, ${color.stroke})`,
              transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          </div>
        </div>
        <div className="flex gap-3 mt-1">
          <span className="text-[11px] text-on-surface-variant">{c.storyPoints} SP</span>
          <span className="text-[11px] text-on-surface-variant">{c.hoursWorked}h</span>
          <span className="text-[11px] text-on-surface-variant capitalize">
            {c.roleInSprint?.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

/** ── Main export ── */
export default function ContributionChart({ contributions = [] }) {
  if (!contributions.length) {
    return (
      <div className="text-center py-10 text-on-surface-variant text-sm">
        Chưa có dữ liệu đóng góp
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Donut */}
      <div className="flex flex-col items-center gap-5 flex-shrink-0">
        <DonutChart contributions={contributions} />
        {/* Legend dưới donut */}
        <div className="flex flex-col gap-1.5 w-full">
          {contributions.map((c, i) => (
            <div key={c.userId || i} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: PALETTE[i % PALETTE.length].stroke }}
              />
              <span className="text-xs text-on-surface-variant truncate max-w-[160px]">
                {c.user?.fullName || 'Ẩn danh'}
              </span>
              <span className="text-xs font-bold ml-auto flex-shrink-0"
                style={{ color: PALETTE[i % PALETTE.length].text }}>
                {c.contributionPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bar list */}
      <div className="flex-1 flex flex-col gap-4 w-full">
        {contributions.map((c, i) => (
          <BarRow key={c.userId || i} c={c} index={i} />
        ))}
      </div>
    </div>
  );
}
