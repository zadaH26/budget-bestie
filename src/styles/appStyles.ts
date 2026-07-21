import type React from "react";
import { PALETTE, UI_THEME } from "../utils/theme";
import { colorWithAlpha } from "../utils/dateMoney";

export function makeStyles(): Record<string, React.CSSProperties> {
  const isDark = UI_THEME.isDark;
  const cardRadius = Math.max(16, Math.min(30, UI_THEME.radius + 5));
  const controlRadius = Math.max(12, Math.min(24, UI_THEME.radius + 1));
  const navRadius = Math.max(14, Math.min(26, UI_THEME.radius + 2));
  const luxuryLine = isDark ? "rgba(255,255,255,0.085)" : "rgba(255,255,255,0.88)";
  const luxuryHairline = isDark ? colorWithAlpha(PALETTE.accent, 0.22) : colorWithAlpha(PALETTE.accent, 0.18);
  const cardSurface = isDark ? colorWithAlpha(PALETTE.card, 0.92) : colorWithAlpha("#ffffff", UI_THEME.glass / 100);
  const pageBackground = isDark
    ? `radial-gradient(circle at 13% 7%, ${colorWithAlpha(PALETTE.accent, 0.3)} 0%, transparent 28%), radial-gradient(circle at 78% 18%, ${colorWithAlpha(PALETTE.accent, 0.12)} 0%, transparent 22%), radial-gradient(circle at 86% 86%, ${colorWithAlpha(PALETTE.accent, 0.16)} 0%, transparent 33%), linear-gradient(140deg, ${colorWithAlpha(PALETTE.bg, 1)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.99)} 52%, ${colorWithAlpha(PALETTE.panel, 0.98)} 100%)`
    : `radial-gradient(circle at 14% 7%, ${colorWithAlpha(PALETTE.accent, 0.24)} 0%, transparent 28%), radial-gradient(circle at 82% 13%, rgba(255,255,255,0.72) 0%, transparent 18%), radial-gradient(circle at 86% 86%, ${colorWithAlpha(PALETTE.accent, 0.16)} 0%, transparent 30%), linear-gradient(140deg, ${colorWithAlpha(PALETTE.bg, 0.98)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.98)} 44%, ${colorWithAlpha(PALETTE.panel, 0.94)} 100%)`;
  const brandSurface = isDark
    ? `linear-gradient(145deg, ${colorWithAlpha(PALETTE.card, 0.92)} 0%, ${colorWithAlpha(PALETTE.panel, 0.72)} 100%)`
    : `linear-gradient(145deg, ${colorWithAlpha("#ffffff", 0.94)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.76)} 100%)`;
  const cardBackground = isDark
    ? `linear-gradient(150deg, ${colorWithAlpha(PALETTE.card, 0.96)} 0%, ${colorWithAlpha(PALETTE.panel, 0.88)} 64%, ${colorWithAlpha(PALETTE.panel2, 0.82)} 100%)`
    : `linear-gradient(150deg, ${cardSurface} 0%, ${colorWithAlpha(PALETTE.card, 0.98)} 54%, ${colorWithAlpha(PALETTE.panel2, 0.72)} 100%)`;
  const cardShadow = isDark
    ? `0 ${12 + UI_THEME.shadow}px ${30 + UI_THEME.shadow}px rgba(0, 0, 0, ${(0.32 + UI_THEME.shadow * 0.006).toFixed(3)}), inset 0 1px 0 ${luxuryLine}`
    : `0 ${14 + UI_THEME.shadow}px ${34 + UI_THEME.shadow}px rgba(42, 28, 58, ${(0.06 + UI_THEME.shadow * 0.0042).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,0.9)`;
  const controlBg = isDark ? colorWithAlpha(PALETTE.card, 0.8) : colorWithAlpha("#ffffff", 0.92);
  const controlInset = isDark ? "inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.92)";
  const secondaryBtnBg = isDark
    ? `linear-gradient(145deg, ${colorWithAlpha(PALETTE.card, 0.9)} 0%, ${colorWithAlpha(PALETTE.panel, 0.78)} 100%)`
    : `linear-gradient(145deg, ${colorWithAlpha("#ffffff", 0.97)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.82)} 100%)`;
  const iconBtnBg = isDark ? colorWithAlpha(PALETTE.card, 0.84) : colorWithAlpha("#ffffff", 0.92);
  const txCardBg = isDark ? colorWithAlpha(PALETTE.card, 0.9) : colorWithAlpha("#ffffff", 0.9);
  const primaryBtnShadow = isDark
    ? `0 12px 28px ${colorWithAlpha(PALETTE.accent, 0.28)}, inset 0 1px 0 rgba(255,255,255,0.18)`
    : `0 16px 34px ${colorWithAlpha(PALETTE.accent, 0.28)}, inset 0 1px 0 rgba(255,255,255,0.35)`;

  return {
    page: {
      minHeight: "100vh",
      width: "100%",
      background: pageBackground,
      color: PALETTE.text,
      overflowX: "clip",
      textRendering: "optimizeLegibility",
      letterSpacing: "-0.006em",
    },
    shell: {
      display: "grid",
      gridTemplateColumns: "clamp(260px, 19vw, 308px) minmax(0, 1fr)",
      gap: 22,
      padding: 22,
      width: "100%",
      maxWidth: 1760,
      margin: "16px auto",
      alignItems: "stretch",
      boxSizing: "border-box",
      minHeight: "calc(100vh - 32px)",
      background: isDark
        ? `linear-gradient(145deg, ${colorWithAlpha(PALETTE.panel2, 0.86)} 0%, ${colorWithAlpha(PALETTE.card, 0.34)} 100%)`
        : `linear-gradient(145deg, ${colorWithAlpha("#ffffff", 0.42)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.86)} 44%, ${colorWithAlpha(PALETTE.panel, 0.72)} 100%)`,
      border: `1px solid ${luxuryHairline}`,
      borderRadius: 38,
      boxShadow: isDark
        ? "0 30px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)"
        : `0 38px 80px ${colorWithAlpha(PALETTE.accent, 0.18)}, inset 0 1px 0 rgba(255,255,255,0.78)`,
      backdropFilter: "blur(28px) saturate(1.18)",
    },
    sidebar: {
      background: isDark
        ? `linear-gradient(180deg, ${colorWithAlpha(PALETTE.card, 0.68)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.54)} 56%, ${colorWithAlpha(PALETTE.card, 0.58)} 100%)`
        : `linear-gradient(180deg, ${colorWithAlpha("#ffffff", 0.72)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.62)} 54%, ${colorWithAlpha("#ffffff", 0.56)} 100%)`,
      border: `1px solid ${luxuryHairline}`,
      borderRadius: 30,
      padding: 16,
      position: "relative",
      minHeight: "calc(100vh - 76px)",
      height: "auto",
      alignSelf: "stretch",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      overflow: "visible",
      boxSizing: "border-box",
      backdropFilter: "blur(24px) saturate(1.12)",
      boxShadow: isDark
        ? "0 18px 36px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)"
        : "0 20px 38px rgba(54, 43, 52, 0.09), inset 0 1px 0 rgba(255,255,255,0.78)",
      minWidth: 0,
      alignItems: "stretch",
    },
    sidebarInner: {
      position: "sticky",
      top: 20,
      minHeight: "calc(100vh - 72px)",
      maxHeight: "calc(100vh - 40px)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      overflow: "auto",
      zIndex: 1,
      scrollbarGutter: "stable",
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px",
      background: brandSurface,
      border: `1px solid ${luxuryHairline}`,
      borderRadius: 22,
      marginBottom: 8,
      boxShadow: isDark ? "0 12px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)" : "0 12px 24px rgba(44, 28, 56, 0.07), inset 0 1px 0 rgba(255,255,255,0.88)",
    },
    brandIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      display: "grid",
      placeItems: "center",
      background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 34%), linear-gradient(145deg, ${colorWithAlpha(PALETTE.accent, 0.42)} 0%, ${colorWithAlpha(PALETTE.accent, 0.2)} 100%)`,
      fontSize: 20,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.62), 0 10px 18px rgba(0,0,0,0.08)",
    },
    brandTitle: { fontWeight: 940, fontSize: 17, letterSpacing: 0.1, lineHeight: 1.05, fontFamily: UI_THEME.headingFontStack },
    brandSub: { fontSize: 12, color: PALETTE.muted, fontWeight: 640 },

    main: {
      background: "transparent",
      border: "none",
      borderRadius: 26,
      padding: 0,
      minHeight: "calc(100vh - 76px)",
      overflow: "visible",
      boxSizing: "border-box",
      boxShadow: "none",
      backdropFilter: "none",
    },

    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "11px 13px",
      borderRadius: navRadius,
      textDecoration: "none",
      color: PALETTE.text,
      fontWeight: 760,
      fontSize: 14.2,
      transition: "all 220ms ease",
    },
    railNav: {
      width: "100%",
      display: "grid",
      gap: 8,
      justifyItems: "stretch",
    },
    railBtn: {
      width: "100%",
      minHeight: 54,
      borderRadius: 18,
      border: `1px solid ${isDark ? colorWithAlpha(PALETTE.text, 0.1) : colorWithAlpha(PALETTE.text, 0.08)}`,
      background: isDark ? colorWithAlpha(PALETTE.card, 0.82) : colorWithAlpha("#ffffff", 0.88),
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 12px",
      color: PALETTE.text,
      textDecoration: "none",
      boxShadow: isDark ? "0 10px 20px rgba(0,0,0,0.28)" : "0 10px 20px rgba(51, 38, 47, 0.065)",
      transition: "all 220ms ease",
      fontWeight: 850,
      fontSize: 14,
      letterSpacing: 0.05,
    },
    topBar: {
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      alignItems: "center",
      gap: 14,
      marginBottom: 12,
      background: isDark
        ? `linear-gradient(145deg, ${colorWithAlpha(PALETTE.card, 0.88)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.78)} 100%)`
        : `linear-gradient(145deg, ${colorWithAlpha("#ffffff", 0.82)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.74)} 100%)`,
      border: `1px solid ${luxuryHairline}`,
      borderRadius: 30,
      padding: 14,
      boxShadow: isDark
        ? "0 18px 38px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)"
        : `0 20px 44px rgba(61, 47, 58, 0.09), 0 0 0 1px ${colorWithAlpha("#ffffff", 0.32)} inset`,
      backdropFilter: "blur(26px) saturate(1.16)",
      overflow: "hidden",
    },
    topTabs: {
      display: "flex",
      gap: 8,
      justifyContent: "center",
      flexWrap: "wrap",
    },
    topTab: {
      padding: "12px 20px",
      borderRadius: 16,
      textDecoration: "none",
      border: `1px solid ${PALETTE.border}`,
      background: isDark ? colorWithAlpha(PALETTE.card, 0.8) : colorWithAlpha("#ffffff", 0.88),
      color: PALETTE.text,
      fontWeight: 820,
      fontSize: 14,
      letterSpacing: 0.05,
    },
    topActions: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    iconPill: {
      width: 46,
      height: 46,
      borderRadius: 16,
      border: `1px solid ${luxuryHairline}`,
      background: isDark ? colorWithAlpha(PALETTE.card, 0.82) : colorWithAlpha("#ffffff", 0.9),
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      color: PALETTE.text,
      boxShadow: isDark ? "0 10px 20px rgba(0,0,0,0.26)" : "0 10px 20px rgba(35, 25, 45, 0.08)",
    },
    avatarPill: {
      width: 46,
      height: 46,
      borderRadius: 16,
      border: `1px solid ${luxuryHairline}`,
      background: `linear-gradient(145deg, ${colorWithAlpha(PALETTE.accent, 0.3)} 0%, ${colorWithAlpha(PALETTE.accent, 0.14)} 100%)`,
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
      color: PALETTE.text,
    },

    pageHeader: { display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 20, flexWrap: "wrap" },
    h1: { fontSize: 27, fontWeight: 950, letterSpacing: -0.15, lineHeight: 1.05, fontFamily: UI_THEME.headingFontStack },
    sub: { fontSize: 13.5, color: PALETTE.muted, fontWeight: 700, marginTop: 7, lineHeight: 1.5 },

    grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 },
    grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 },

    card: {
      background: cardBackground,
      border: `1px solid ${luxuryHairline}`,
      borderRadius: cardRadius,
      padding: 18,
      boxShadow: cardShadow,
      backdropFilter: "blur(22px) saturate(1.1)",
    },

    input: {
      width: "100%",
      minHeight: 48,
      padding: "12px 15px",
      borderRadius: controlRadius,
      border: `1px solid ${isDark ? colorWithAlpha(PALETTE.text, 0.12) : colorWithAlpha(PALETTE.text, 0.1)}`,
      background: controlBg,
      fontWeight: 700,
      fontSize: 14,
      lineHeight: 1.25,
      color: PALETTE.text,
      outline: "none",
      boxSizing: "border-box",
      boxShadow: controlInset,
    },
    select: {
      width: "100%",
      minHeight: 48,
      padding: "12px 15px",
      borderRadius: controlRadius,
      border: `1px solid ${isDark ? colorWithAlpha(PALETTE.text, 0.12) : colorWithAlpha(PALETTE.text, 0.1)}`,
      background: controlBg,
      fontWeight: 700,
      fontSize: 14,
      lineHeight: 1.25,
      color: PALETTE.text,
      outline: "none",
      boxSizing: "border-box",
      boxShadow: controlInset,
    },
    textarea: {
      width: "100%",
      minHeight: 140,
      padding: "12px 15px",
      borderRadius: controlRadius,
      border: `1px solid ${isDark ? colorWithAlpha(PALETTE.text, 0.12) : colorWithAlpha(PALETTE.text, 0.1)}`,
      background: controlBg,
      fontWeight: 650,
      color: PALETTE.text,
      outline: "none",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: 12.5,
      lineHeight: 1.55,
      boxSizing: "border-box",
      boxShadow: controlInset,
    },
    btnPrimary: {
      minHeight: 46,
      padding: "11px 16px",
      borderRadius: controlRadius,
      border: `1px solid ${colorWithAlpha(PALETTE.accent, 0.7)}`,
      background: `radial-gradient(circle at 30% 15%, rgba(255,255,255,0.35) 0%, transparent 34%), linear-gradient(145deg, ${PALETTE.accent} 0%, ${colorWithAlpha(PALETTE.accent, 0.82)} 100%)`,
      cursor: "pointer",
      fontWeight: 900,
      color: "#fffaf7",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      whiteSpace: "nowrap",
      boxSizing: "border-box",
      boxShadow: primaryBtnShadow,
      transition: "all 220ms ease",
      letterSpacing: 0.05,
    },
    btnSecondary: {
      minHeight: 46,
      padding: "11px 16px",
      borderRadius: controlRadius,
      border: `1px solid ${isDark ? colorWithAlpha(PALETTE.text, 0.12) : colorWithAlpha(PALETTE.text, 0.1)}`,
      background: secondaryBtnBg,
      cursor: "pointer",
      fontWeight: 840,
      color: PALETTE.text,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      whiteSpace: "nowrap",
      boxSizing: "border-box",
      boxShadow: isDark ? "0 10px 20px rgba(0,0,0,0.22)" : "0 10px 22px rgba(16, 24, 30, 0.075)",
      transition: "all 220ms ease",
      letterSpacing: 0.05,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: Math.max(12, controlRadius - 1),
      border: `1px solid ${isDark ? colorWithAlpha(PALETTE.text, 0.12) : colorWithAlpha(PALETTE.text, 0.1)}`,
      background: iconBtnBg,
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      transition: "all 220ms ease",
      boxShadow: isDark ? "0 7px 14px rgba(0,0,0,0.2)" : "0 7px 14px rgba(16, 24, 30, 0.06)",
    },
    deleteLabel: {
      fontWeight: 830,
      fontSize: 11.5,
      color: PALETTE.muted,
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    deleteInput: {
      width: "100%",
      minHeight: 46,
      display: "block",
      fontSize: 15,
      fontWeight: 760,
      boxSizing: "border-box",
    },
    deleteBtn: {
      width: "100%",
      minHeight: 46,
      justifyContent: "center",
      fontSize: 14,
      fontWeight: 860,
      boxSizing: "border-box",
    },
    deleteDangerBtn: {
      width: "100%",
      minHeight: 46,
      justifyContent: "center",
      fontSize: 14,
      fontWeight: 900,
      boxSizing: "border-box",
    },
    txCard: {
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
      padding: 16,
      borderRadius: cardRadius,
      border: `1px solid ${luxuryHairline}`,
      background: txCardBg,
      boxShadow: `0 ${6 + UI_THEME.shadow}px ${16 + UI_THEME.shadow}px rgba(14, 22, 30, ${(0.04 + UI_THEME.shadow * 0.0036).toFixed(3)})`,
      backdropFilter: "blur(12px)",
    },
    txLeft: { display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 },
    txIcon: { width: 46, height: 46, borderRadius: controlRadius, display: "grid", placeItems: "center" },
    txTitle: {
      fontWeight: 880,
      fontSize: 14.5,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      width: "100%",
      lineHeight: 1.3,
    },
    txMeta: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      fontSize: 12,
      color: PALETTE.muted,
      fontWeight: 700,
      marginTop: 4,
      alignItems: "center",
      lineHeight: 1.35,
    },
    txRight: { display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" },
  };
}
