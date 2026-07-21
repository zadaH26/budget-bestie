import { useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { PALETTE,  formatMoney, parseCsvFile, parsePasteBlock, parseXlsxFile, resolveSourceFamily, rowToExpense, shouldExcludeImportedTransaction, sourceFamilyFromLabel, toISODate, uid } from "../app/appCore";
import type { Expense, RawRow, Recurrence } from "../app/appCore";
import { useBudgetBestie } from "../app/BudgetBestieContext";
import { PageTitle } from "../app/uiComponents";

export function AddExpensePage() {
  const {
    categories,
    dedupeAndAdd,
    dedupePreviewRows,
    importedFileFingerprints,
    resolveCategoryByLearnedRule,
    s,
    setImportedFileFingerprints,
    softLayer,
  } = useBudgetBestie();

    const [amount, setAmount] = useState("");
    const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "cat_other");
    const [date, setDate] = useState(toISODate(new Date()));
    const [notes, setNotes] = useState("");
    const [source, setSource] = useState("Manual");
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<Recurrence>("none");

    const [preview, setPreview] = useState<Array<Omit<Expense, "id" | "createdAt">>>([]);
    const [previewMsg, setPreviewMsg] = useState("");
    const [pasteBlocks, setPasteBlocks] = useState<Array<{ id: string; label: string; text: string }>>([
      { id: uid("pb"), label: "RBC", text: "" },
    ]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isPreviewingPaste, setIsPreviewingPaste] = useState(false);

    function fileFingerprint(file: File) {
      return `${file.name}|${file.size}|${file.lastModified}`;
    }

    function splitFilesByImportHistory(files: File[]) {
      const seen = new Set(importedFileFingerprints);
      const fresh: File[] = [];
      const alreadyImported: File[] = [];

      for (const file of files) {
        if (seen.has(fileFingerprint(file))) alreadyImported.push(file);
        else fresh.push(file);
      }

      return { fresh, alreadyImported };
    }

    function mergeSelectedFiles(nextFiles: File[]) {
      setSelectedFiles((prev) => {
        const map = new Map<string, File>();
        for (const f of prev) map.set(fileFingerprint(f), f);
        for (const f of nextFiles) map.set(fileFingerprint(f), f);
        return [...map.values()];
      });
    }

    function addPasteBox() {
      setPasteBlocks((p) => [...p, { id: uid("pb"), label: `Paste ${p.length + 1}`, text: "" }]);
    }

    async function parsePasteBlocksSmart(blocks: Array<{ id: string; label: string; text: string }>) {
      const all: Array<Omit<Expense, "id" | "createdAt">> = [];

      for (const b of blocks) {
        if (!b.text.trim()) continue;

        const localRows = parsePasteBlock(b.text, b.label).map((row) => ({
          ...row,
          categoryId: resolveCategoryByLearnedRule(row.notes, row.categoryId),
        }));
        all.push(...dedupePreviewRows(localRows));
      }

      const unique = dedupePreviewRows(all);
      const removed = all.length - unique.length;
      return { unique, removed };
    }

    async function previewPaste() {
      setIsPreviewingPaste(true);
      try {
        const { unique, removed } = await parsePasteBlocksSmart(pasteBlocks);
        setPreview(unique);
        setPreviewMsg(
          unique.length
            ? `Parsed ${unique.length} transactions from paste${
                removed > 0 ? ` (${removed} duplicates skipped)` : ""
              }.`
            : "Couldn’t parse paste yet. Upload CSV/XLSX or check statement format."
        );
      } finally {
        setIsPreviewingPaste(false);
      }
    }

    async function parseFilesIntoPreview(files: File[]) {
      const all: Array<Omit<Expense, "id" | "createdAt">> = [];
      let failed = 0;

      for (const f of files) {
        const name = f.name;
        let sourceGroup = sourceFamilyFromLabel(name);
        let rows: RawRow[] = [];
        try {
          if (name.toLowerCase().endsWith(".csv")) rows = await parseCsvFile(f);
          else rows = await parseXlsxFile(f);

          if (sourceGroup === "unknown" || sourceGroup === "rbc") {
            const contentHint = rows
              .slice(0, 120)
              .map((row) => Object.values(row).map((v) => String(v ?? "")).join(" "))
              .join(" ");
            sourceGroup = resolveSourceFamily(name, contentHint);
          }

          for (const r of rows) {
            const exp = rowToExpense(r, name, sourceGroup);
            if (exp) {
              const resolvedCategoryId = resolveCategoryByLearnedRule(exp.notes, exp.categoryId);
              if (resolvedCategoryId === "cat_ccpay" || shouldExcludeImportedTransaction(exp.notes)) continue;
              all.push({
                ...exp,
                categoryId: resolvedCategoryId,
                sourceGroup,
              });
            }
          }
        } catch (err) {
          failed += 1;
          console.error(err);
        }
      }

      const unique = dedupePreviewRows(all);
      const removed = all.length - unique.length;
      return { unique, removed, failed };
    }

    function syncAndAddFromFiles(incoming: Array<Omit<Expense, "id" | "createdAt">>) {
      // Never delete old rows automatically. Add/update only.
      const result = dedupeAndAdd(incoming);
      return {
        added: result.added,
        deleted: 0,
        skippedAsDuplicate: result.skippedAsDuplicate,
        correctedBySign: result.correctedBySign,
      };
    }

    async function addSelectedFilesNow() {
      if (!selectedFiles.length) {
        alert("Choose one or more files first.");
        return;
      }

      setIsImporting(true);
      try {
        const { fresh, alreadyImported } = splitFilesByImportHistory(selectedFiles);
        if (!fresh.length) {
          setPreview([]);
          setPreviewMsg(
            `Skipped ${alreadyImported.length} file${alreadyImported.length === 1 ? "" : "s"} because those exact files were already imported.`
          );
          setSelectedFiles([]);
          return;
        }

        const { unique, removed, failed } = await parseFilesIntoPreview(fresh);
        if (unique.length) {
          const synced = syncAndAddFromFiles(unique);
          setImportedFileFingerprints((prev) => [
            ...prev,
            ...fresh.map((file) => fileFingerprint(file)).filter((fingerprint) => !prev.includes(fingerprint)),
          ]);
          setPreview([]);
          setPreviewMsg(
            `Imported ${synced.added} transaction${synced.added === 1 ? "" : "s"} from ${fresh.length} file${
              fresh.length === 1 ? "" : "s"
            }.${
              removed > 0 || synced.skippedAsDuplicate > 0 || alreadyImported.length > 0
                ? ` Skipped ${removed + synced.skippedAsDuplicate + alreadyImported.length} duplicate item${
                    removed + synced.skippedAsDuplicate + alreadyImported.length === 1 ? "" : "s"
                  }.`
                : ""
            }${synced.correctedBySign > 0 ? ` Repaired sign on ${synced.correctedBySign} transfer transaction${synced.correctedBySign === 1 ? "" : "s"}.` : ""}`
          );
        } else {
          setPreviewMsg(
            failed > 0
              ? "Could not parse selected file(s). Try CSV export from your bank and re-upload."
              : alreadyImported.length
                ? "No new transactions found. Matching files were already imported."
                : "No transactions found in selected files (header mismatch)."
          );
        }
        setSelectedFiles([]);
      } finally {
        setIsImporting(false);
      }
    }

    async function importNow() {
      setIsImporting(true);
      try {
        let rowsToImport = preview;
        let importedFromSelectedFiles = false;
        let freshFiles: File[] = [];
        let alreadyImportedFiles: File[] = [];

        // If preview is empty, try parsing the selected files on Import click too.
        if (!rowsToImport.length && selectedFiles.length) {
          const split = splitFilesByImportHistory(selectedFiles);
          freshFiles = split.fresh;
          alreadyImportedFiles = split.alreadyImported;
          if (!freshFiles.length) {
            setPreview([]);
            setPreviewMsg(
              `Skipped ${alreadyImportedFiles.length} file${alreadyImportedFiles.length === 1 ? "" : "s"} because those exact files were already imported.`
            );
            setSelectedFiles([]);
            return;
          }

          const { unique, removed } = await parseFilesIntoPreview(freshFiles);
          rowsToImport = unique;
          importedFromSelectedFiles = true;
          setPreview(unique);
          setPreviewMsg(
            unique.length
              ? `Parsed ${unique.length} transactions from selected file${
                  freshFiles.length === 1 ? "" : "s"
                }${
                  removed > 0 ? ` (${removed} duplicates skipped)` : ""
                }.`
              : "No transactions found in selected files."
          );
        }

        // If still empty, try paste blocks directly.
        if (!rowsToImport.length) {
          const { unique: uniquePasted } = await parsePasteBlocksSmart(pasteBlocks);
          if (uniquePasted.length) {
            rowsToImport = uniquePasted;
            setPreview(uniquePasted);
            setPreviewMsg(`Parsed ${uniquePasted.length} transactions from paste.`);
          }
        }

        if (!rowsToImport.length) {
          alert("Nothing to import yet. Upload files or paste transactions first.");
          return;
        }

        if (importedFromSelectedFiles) {
          const synced = syncAndAddFromFiles(rowsToImport);
          setImportedFileFingerprints((prev) => [
            ...prev,
            ...freshFiles.map((file) => fileFingerprint(file)).filter((fingerprint) => !prev.includes(fingerprint)),
          ]);
          setPreview([]);
          setPreviewMsg(
            `Imported ${synced.added} transaction${synced.added === 1 ? "" : "s"}.${
              synced.skippedAsDuplicate > 0 || alreadyImportedFiles.length > 0
                ? ` Skipped ${synced.skippedAsDuplicate + alreadyImportedFiles.length} duplicate item${
                    synced.skippedAsDuplicate + alreadyImportedFiles.length === 1 ? "" : "s"
                  }.`
                : ""
            }${synced.correctedBySign > 0 ? ` Repaired sign on ${synced.correctedBySign} transfer transaction${synced.correctedBySign === 1 ? "" : "s"}.` : ""}`
          );
        } else {
          const added = dedupeAndAdd(rowsToImport);
          setPreview([]);
          setPreviewMsg(
            added.skippedAsDuplicate > 0
              ? `Imported ${added.added} transaction${added.added === 1 ? "" : "s"}. Skipped ${added.skippedAsDuplicate} duplicate${
                  added.skippedAsDuplicate === 1 ? "" : "s"
                }.${added.correctedBySign > 0 ? ` Repaired sign on ${added.correctedBySign} transfer transaction${added.correctedBySign === 1 ? "" : "s"}.` : ""}`
              : `Imported ${added.added} transaction${added.added === 1 ? "" : "s"}.${
                  added.correctedBySign > 0
                    ? ` Repaired sign on ${added.correctedBySign} transfer transaction${added.correctedBySign === 1 ? "" : "s"}.`
                    : ""
                }`
          );
        }
        setSelectedFiles([]);
      } finally {
        setIsImporting(false);
      }
    }

    function addManual() {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) return alert("Enter a valid amount");
      const result = dedupeAndAdd([
        {
          amount: -Math.abs(n),
          categoryId,
          date,
          notes: notes.trim() || "Manual entry",
          source: source.trim() || "Manual",
          isRecurring,
          recurrenceFrequency: isRecurring ? recurrenceFrequency : "none",
        },
      ]);
      if (result.added === 0) {
        alert("That transaction already exists, so it was not added again.");
        return;
      }
      setAmount("");
      setNotes("");
      setIsRecurring(false);
      setRecurrenceFrequency("none");
    }

    return (
      <div>
        <PageTitle title="Add Expense" subtitle="Upload files OR paste. Preview shows what will be imported." />

        <div style={s.grid2}>
          {/* Manual */}
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Manual Entry</div>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={s.input} placeholder="Amount (e.g. 12.34)" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select style={s.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? "✨"} {c.name}
                  </option>
                ))}
              </select>
              <input style={s.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input style={s.input} placeholder="Notes (Starbucks, rent…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <input style={s.input} placeholder="Source (RBC, AMEX…)" value={source} onChange={(e) => setSource(e.target.value)} />

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                Recurring expense (subscriptions)
              </label>

              <select
                style={s.select}
                value={recurrenceFrequency}
                onChange={(e) => setRecurrenceFrequency(e.target.value as Recurrence)}
                disabled={!isRecurring}
              >
                <option value="none">none</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>

              <button style={s.btnPrimary} onClick={addManual}>
                <PlusCircle size={16} /> Add
              </button>
            </div>
          </div>

          {/* Import */}
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Import Transactions</div>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 650, marginBottom: 10 }}>
              Upload RBC + AMEX CSV/XLSX files. You can upload multiple files at once.
            </div>

            {/* FILE UPLOAD */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Upload CSV / Excel</div>
              <input
                type="file"
                multiple
                accept=".csv,.xlsx,.xls"
                style={s.input}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  mergeSelectedFiles(files);
                  setPreviewMsg(
                    `Selected ${files.length} new file${files.length === 1 ? "" : "s"}. Click "Add Selected Files" to import.`
                  );
                  // Allow selecting the same file again.
                  e.target.value = "";
                }}
              />
              {selectedFiles.length ? (
                <div style={{ marginTop: 8, fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                  Selected: {selectedFiles.map((f) => f.name).join(", ")}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button style={s.btnPrimary} onClick={addSelectedFilesNow} disabled={!selectedFiles.length || isImporting}>
                  {isImporting ? "Adding..." : "Add Selected Files"}
                </button>
                <button
                  style={s.btnSecondary}
                  onClick={() => setSelectedFiles([])}
                  disabled={!selectedFiles.length || isImporting}
                >
                  Clear Selected
                </button>
              </div>
            </div>

            {/* PASTE */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 900 }}>Paste (optional)</div>
              <button style={s.btnSecondary} onClick={addPasteBox}>
                + Add box
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                padding: 10,
                marginBottom: 10,
                background: softLayer(0.62, 0.85),
              }}
            >
              <div style={{ fontWeight: 850 }}>Local parser is enabled.</div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Amount sign rules: `-$x` or `(x)` treated as inflow/credit; `+$x` treated as outflow/expense.
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {pasteBlocks.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: 18,
                    padding: 12,
                    background: softLayer(0.65, 0.86),
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <input
                      style={{ ...s.input, maxWidth: 220 }}
                      value={b.label}
                      onChange={(e) =>
                        setPasteBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    {pasteBlocks.length > 1 ? (
                      <button style={s.iconBtn} onClick={() => setPasteBlocks((p) => p.filter((x) => x.id !== b.id))} title="Remove">
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>

                  <textarea
                    style={{ ...s.textarea, marginTop: 10 }}
                    value={b.text}
                    onChange={(e) =>
                      setPasteBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))
                    }
                    placeholder="Paste transactions here (RBC/AMEX)…"
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                style={s.btnSecondary}
                onClick={() => void previewPaste()}
                disabled={isImporting || isPreviewingPaste}
              >
                {isPreviewingPaste ? "Parsing..." : "Preview Paste"}
              </button>
              <button style={s.btnPrimary} onClick={importNow} disabled={isImporting || isPreviewingPaste}>
                {isImporting ? "Importing..." : "Import Transactions"}
              </button>
              {previewMsg ? (
                <div style={{ color: PALETTE.muted, fontWeight: 700, fontSize: 12, alignSelf: "center" }}>
                  {previewMsg}
                </div>
              ) : null}
            </div>

            {preview.length ? (
              <div style={{ marginTop: 12, maxHeight: 260, overflow: "auto", display: "grid", gap: 8 }}>
                {preview.slice(0, 80).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: `1px solid ${PALETTE.border}`,
                      background: softLayer(0.78, 0.9),
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.date}</div>
                    <div style={{ color: PALETTE.muted }}>{r.source}</div>
                    <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.notes}
                    </div>
                    <div style={{ fontWeight: 900 }}>{formatMoney(r.amount)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
