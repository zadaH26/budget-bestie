/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { APP_FONT_OPTIONS, COLOR_SWATCHES, DARK_PALETTE, DEFAULT_UI_GLASS, DEFAULT_UI_MOTION_MS, DEFAULT_UI_RADIUS, DEFAULT_UI_SHADOW, HEADING_FONT_OPTIONS, LIGHT_PALETTE, PALETTE,  clampNumber, colorWithAlpha, normalizeAccountId, sanitizeAppFont, sanitizeHeadingFont, sanitizeHexColor } from "../app/appCore";
import type { AppFontId, HeadingFontId, ThemePreset } from "../app/appCore";
import { useBudgetBestie } from "../app/BudgetBestieContext";
import { PageTitle } from "../app/uiComponents";
import { PremiumRange } from "../components/PremiumRange";

export function PersonalizePage() {
  const {
    activeThemePresetId,
    allThemePresets,
    appFont,
    appTitle,
    brandIcon,
    colorAccent,
    colorBg,
    colorCard,
    colorPanel,
    colorPanel2,
    headingFont,
    s,
    setAppFont,
    setAppTitle,
    setBrandIcon,
    setColorAccent,
    setColorBg,
    setColorCard,
    setColorPanel,
    setColorPanel2,
    setCustomThemes,
    setHeadingFont,
    setThemeMode,
    setUiGlass,
    setUiMotionMs,
    setUiRadius,
    setUiShadow,
    themeMode,
    uiGlass,
    uiMotionMs,
    uiRadius,
    uiShadow,
  } = useBudgetBestie();

    const basePalette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
    const iconPresets = ["💜", "💎", "💰", "🏦", "🧠", "📊", "✨", "🚀", "🌸", "🎯", "🦋", "🔥"];
    const [draftBrandIcon, setDraftBrandIcon] = useState(brandIcon);
    const [draftAppTitle, setDraftAppTitle] = useState(appTitle);
    const [draftAppFont, setDraftAppFont] = useState<AppFontId>(appFont);
    const [draftHeadingFont, setDraftHeadingFont] = useState<HeadingFontId>(headingFont);
    const [draftUiRadius, setDraftUiRadius] = useState(uiRadius);
    const [draftUiShadow, setDraftUiShadow] = useState(uiShadow);
    const [draftUiGlass, setDraftUiGlass] = useState(uiGlass);
    const [draftUiMotionMs, setDraftUiMotionMs] = useState(uiMotionMs);
    const [customThemeName, setCustomThemeName] = useState("");
    const [customThemeNotice, setCustomThemeNotice] = useState("");

    useEffect(() => {
      setDraftBrandIcon(brandIcon);
      setDraftAppTitle(appTitle);
      setDraftAppFont(appFont);
      setDraftHeadingFont(headingFont);
      setDraftUiRadius(uiRadius);
      setDraftUiShadow(uiShadow);
      setDraftUiGlass(uiGlass);
      setDraftUiMotionMs(uiMotionMs);
    }, [brandIcon, appTitle, appFont, headingFont, uiRadius, uiShadow, uiGlass, uiMotionMs]);

    const brandDirty =
      draftBrandIcon !== brandIcon ||
      draftAppTitle !== appTitle ||
      draftAppFont !== appFont ||
      draftHeadingFont !== headingFont ||
      draftUiRadius !== uiRadius ||
      draftUiShadow !== uiShadow ||
      draftUiGlass !== uiGlass ||
      draftUiMotionMs !== uiMotionMs;

    function resetColorsToThemeDefaults() {
      setColorAccent(basePalette.accent);
      setColorBg(basePalette.bg);
      setColorPanel(basePalette.panel);
      setColorPanel2(basePalette.panel2);
      setColorCard(basePalette.card);
    }

    function applyThemeMode(nextMode: "light" | "dark") {
      const nextBase = nextMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
      setThemeMode(nextMode);
      setColorAccent(nextBase.accent);
      setColorBg(nextBase.bg);
      setColorPanel(nextBase.panel);
      setColorPanel2(nextBase.panel2);
      setColorCard(nextBase.card);
    }

    function applyThemePreset(preset: ThemePreset) {
      setThemeMode(preset.mode);
      setColorAccent(preset.accent);
      setColorBg(preset.bg);
      setColorPanel(preset.panel);
      setColorPanel2(preset.panel2);
      setColorCard(preset.card);
    }

    function saveCurrentThemeAsCustom() {
      const name = customThemeName.trim().replace(/\s+/g, " ").slice(0, 36);
      if (!name) {
        setCustomThemeNotice("Type a theme name first.");
        return;
      }
      const nextMode: "light" | "dark" = themeMode === "dark" ? "dark" : "light";
      const nextBase = nextMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
      const normalized = normalizeAccountId(name) || `theme_${Date.now().toString(36)}`;
      const desiredId = `custom_${normalized}`;

      setCustomThemes((prev) => {
        const existing = prev.find((theme) => theme.id === desiredId || theme.label.toLowerCase() === name.toLowerCase());
        const nextPreset: ThemePreset = {
          id: existing?.id ?? desiredId,
          label: name,
          note: "",
          mode: nextMode,
          accent: sanitizeHexColor(colorAccent, nextBase.accent),
          bg: sanitizeHexColor(colorBg, nextBase.bg),
          panel: sanitizeHexColor(colorPanel, nextBase.panel),
          panel2: sanitizeHexColor(colorPanel2, nextBase.panel2),
          card: sanitizeHexColor(colorCard, nextBase.card),
        };
        if (existing) return prev.map((theme) => (theme.id === existing.id ? nextPreset : theme));
        return [...prev, nextPreset].slice(-24);
      });

      setCustomThemeName("");
      setCustomThemeNotice(`Saved "${name}"`);
    }

    function saveBrandingDraft() {
      setBrandIcon(draftBrandIcon);
      setAppTitle(draftAppTitle.slice(0, 48));
      setAppFont(sanitizeAppFont(draftAppFont));
      setHeadingFont(sanitizeHeadingFont(draftHeadingFont));
      setUiRadius(clampNumber(draftUiRadius, 8, 28, DEFAULT_UI_RADIUS));
      setUiShadow(clampNumber(draftUiShadow, 0, 24, DEFAULT_UI_SHADOW));
      setUiGlass(clampNumber(draftUiGlass, 70, 100, DEFAULT_UI_GLASS));
      setUiMotionMs(clampNumber(draftUiMotionMs, 80, 420, DEFAULT_UI_MOTION_MS));
    }

    return (
      <div>
        <PageTitle
          title="Personalize"
          subtitle="Make this account your own: app name, fonts, colors, corners, shadows, and motion are saved per account."
        />

        <div style={s.grid2}>
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Brand</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Brand icon
                </div>
                <input
                  style={s.input}
                  value={draftBrandIcon}
                  onChange={(e) => setDraftBrandIcon(e.target.value)}
                  placeholder="💜"
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {iconPresets.map((icon) => (
                    <button
                      key={icon}
                      style={draftBrandIcon === icon ? s.btnPrimary : s.btnSecondary}
                      onClick={() => setDraftBrandIcon(icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginTop: 6 }}>
                  Pick a preset or type/paste any emoji(s) you want.
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  App name
                </div>
                <input
                  style={s.input}
                  value={draftAppTitle}
                  onChange={(e) => setDraftAppTitle(e.target.value.slice(0, 48))}
                  placeholder="My Budget Hub"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  App font
                </div>
                <select
                  style={s.select}
                  value={draftAppFont}
                  onChange={(e) => setDraftAppFont(sanitizeAppFont(e.target.value))}
                >
                  {APP_FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Heading font
                </div>
                <select
                  style={s.select}
                  value={draftHeadingFont}
                  onChange={(e) => setDraftHeadingFont(sanitizeHeadingFont(e.target.value))}
                >
                  {HEADING_FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Layout controls (full custom)</div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Corner radius: {draftUiRadius}px</div>
                  <PremiumRange
                    type="range"
                    min={8}
                    max={28}
                    step={1}
                    value={draftUiRadius}
                    onChange={(e) => setDraftUiRadius(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Shadow depth: {draftUiShadow}</div>
                  <PremiumRange
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={draftUiShadow}
                    onChange={(e) => setDraftUiShadow(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Glass effect: {draftUiGlass}%</div>
                  <PremiumRange
                    type="range"
                    min={70}
                    max={100}
                    step={1}
                    value={draftUiGlass}
                    onChange={(e) => setDraftUiGlass(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                    Motion speed: {draftUiMotionMs}ms
                  </div>
                  <PremiumRange
                    type="range"
                    min={80}
                    max={420}
                    step={10}
                    value={draftUiMotionMs}
                    onChange={(e) => setDraftUiMotionMs(Number(e.target.value))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btnPrimary} onClick={saveBrandingDraft} disabled={!brandDirty}>
                  Save Branding
                </button>
                <button
                  style={s.btnSecondary}
                  onClick={() => {
                    setDraftBrandIcon(brandIcon);
                    setDraftAppTitle(appTitle);
                    setDraftAppFont(appFont);
                    setDraftHeadingFont(headingFont);
                    setDraftUiRadius(uiRadius);
                    setDraftUiShadow(uiShadow);
                    setDraftUiGlass(uiGlass);
                    setDraftUiMotionMs(uiMotionMs);
                  }}
                  disabled={!brandDirty}
                >
                  Cancel
                </button>
              </div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Brand edits apply when you click Save Branding.
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Colors</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Theme mode</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    style={themeMode === "light" ? s.btnPrimary : s.btnSecondary}
                    onClick={() => applyThemeMode("light")}
                  >
                    Light
                  </button>
                  <button
                    style={themeMode === "dark" ? s.btnPrimary : s.btnSecondary}
                    onClick={() => applyThemeMode("dark")}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Themes</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {allThemePresets.map((preset) => {
                    const selected = activeThemePresetId === preset.id;
                    const displayLabel = preset.id.startsWith("custom_") ? `${preset.label} (Saved)` : preset.label;
                    return (
                      <button
                        key={preset.id}
                        style={{
                          ...(selected ? s.btnPrimary : s.btnSecondary),
                          width: "100%",
                          justifyContent: "space-between",
                          textAlign: "left",
                        }}
                        onClick={() => applyThemePreset(preset)}
                      >
                        <span>{displayLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Save current colors as theme</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    style={s.input}
                    value={customThemeName}
                    onChange={(e) => {
                      setCustomThemeName(e.target.value.slice(0, 36));
                      if (customThemeNotice) setCustomThemeNotice("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveCurrentThemeAsCustom();
                      }
                    }}
                    placeholder="Theme name (ex: Soft Pink)"
                  />
                  <button style={s.btnPrimary} onClick={saveCurrentThemeAsCustom}>
                    Save As Theme
                  </button>
                </div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                  Your saved themes are account-specific and stay after refresh.
                </div>
                {customThemeNotice ? (
                  <div style={{ fontSize: 12, color: PALETTE.good, fontWeight: 800 }}>{customThemeNotice}</div>
                ) : null}
              </div>

              {[
                { label: "Accent", value: colorAccent, set: setColorAccent },
                { label: "Background", value: colorBg, set: setColorBg },
                { label: "Sidebar panel", value: colorPanel, set: setColorPanel },
                { label: "Main panel", value: colorPanel2, set: setColorPanel2 },
                { label: "Card", value: colorCard, set: setColorCard },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "grid", gap: 8 }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "120px 56px 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: PALETTE.muted }}>{item.label}</div>
                    <input
                      type="color"
                      value={item.value}
                      onInput={(e) => item.set((e.target as HTMLInputElement).value)}
                      onChange={(e) => item.set(e.target.value)}
                      style={{ width: 52, height: 36, border: "none", background: "transparent", padding: 0 }}
                    />
                    <input
                      style={s.input}
                      value={item.value}
                      onChange={(e) => item.set(e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      overflowX: "auto",
                      padding: "2px 1px 4px",
                      scrollbarWidth: "thin",
                    }}
                  >
                    {COLOR_SWATCHES.map((swatch) => {
                      const selected = item.value.toLowerCase() === swatch.toLowerCase();
                      return (
                        <button
                          key={`${item.label}-${swatch}`}
                          onClick={() => item.set(swatch)}
                          title={swatch}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            border: selected ? `2px solid ${PALETTE.text}` : `1px solid ${PALETTE.border}`,
                            background: swatch,
                            flex: "0 0 auto",
                            cursor: "pointer",
                            boxShadow: selected ? `0 0 0 2px ${colorWithAlpha(PALETTE.accent, 0.24)}` : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Scroll the color dots sideways for smoother color picking.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btnSecondary} onClick={resetColorsToThemeDefaults}>
                  Reset Colors To Theme
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Preview</div>
          <div
            style={{
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 18,
              padding: 14,
              background: PALETTE.panel,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: colorWithAlpha(PALETTE.accent, 0.2),
                }}
              >
                {draftBrandIcon || "💜"}
              </div>
              <div>
                <div className="bb-section-title" style={{ fontWeight: 950 }}>
                  {draftAppTitle || "Budget Bestie"}
                </div>
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                background: PALETTE.card,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontWeight: 800 }}>Accent</span>
              <span
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: colorWithAlpha(PALETTE.accent, 0.18),
                  fontWeight: 900,
                }}
              >
                {PALETTE.accent}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
