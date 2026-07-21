import type React from "react";
import { NavLink } from "react-router-dom";
import { PALETTE, colorWithAlpha, makeStyles } from "./appCore";

/** ---------- Small UI Components ---------- */
export function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const s = makeStyles();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3" style={s.pageHeader}>
      <div className="min-w-0">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${PALETTE.accent} 0%, ${colorWithAlpha(PALETTE.accent, 0.18)} 100%)`,
              boxShadow: `0 8px 18px ${colorWithAlpha(PALETTE.accent, 0.28)}`,
              flex: "0 0 auto",
            }}
          />
          <div className="bb-page-title text-balance" style={s.h1}>
            {title}
          </div>
        </div>
        {subtitle ? <div className="max-w-3xl text-pretty" style={s.sub}>{subtitle}</div> : null}
      </div>
      <div className="flex max-w-full flex-wrap justify-end gap-2">{right}</div>
    </div>
  );
}

export function RailItem({
  to,
  icon,
  title,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  const s = makeStyles();
  const activeStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${colorWithAlpha("#111111", 0.95)} 0%, ${colorWithAlpha("#050505", 0.95)} 100%)`,
    color: "#f6f6f6",
    border: `1px solid ${colorWithAlpha(PALETTE.accent, 0.35)}`,
    boxShadow: `0 8px 18px ${colorWithAlpha(PALETTE.accent, 0.24)}`,
  };
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={title}
      onClick={onClick}
      className="bb-nav-link group"
      style={({ isActive }) => (isActive ? { ...s.railBtn, ...activeStyle } : s.railBtn)}
    >
      {icon}
      <span>{title}</span>
    </NavLink>
  );
}

export function TopTabItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  const s = makeStyles();
  const activeStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${colorWithAlpha("#111111", 0.96)} 0%, ${colorWithAlpha("#050505", 0.96)} 100%)`,
    color: "#f6f6f6",
    border: `1px solid ${colorWithAlpha(PALETTE.accent, 0.35)}`,
    boxShadow: `0 8px 18px ${colorWithAlpha(PALETTE.accent, 0.22)}`,
  };
  return (
    <NavLink
      to={to}
      end={to === "/"}
      style={({ isActive }) => (isActive ? { ...s.topTab, ...activeStyle } : s.topTab)}
    >
      {label}
    </NavLink>
  );
}
