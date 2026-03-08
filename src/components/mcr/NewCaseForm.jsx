import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, subDays } from "date-fns";
import { generateCaseId } from "./mcrUtils";

const BENEFIT_PERIODS = [
  "Deductible Days",
  "Coinsurance Days",
  "Lifetime Reserve Days",
  "Beyond Lifetime Reserve Days",
];

// Calculate benefit_period_start_date from admission date, benefit period, and days remaining
function calcBenefitStartDate(admissionDate, benefitPeriod, daysRemaining) {
  if (!admissionDate || !benefitPeriod || daysRemaining === "" || daysRemaining === null) return "";
  const days = parseInt(daysRemaining);
  if (isNaN(days)) return "";

  // Determine max days in the period bucket
  let periodMax;
  if (benefitPeriod === "Deductible Days") periodMax = 60;
  else if (benefitPeriod === "Coinsurance Days") periodMax = 90;
  else if (benefitPeriod === "Lifetime Reserve Days") periodMax = 150; // 90 + 60 LRD
  else periodMax = 151; // beyond

  // days elapsed = periodMax - daysRemaining
  const daysElapsed = periodMax - days;
  if (daysElapsed < 0) return "";

  // benefit period start = admission - (daysElapsed - 1) roughly
  // Actually: currentDay = daysElapsed + 1 (1-indexed), so offset from admission
  // We store admission_date and days_remaining directly instead
  return subDays(new Date(admissionDate), daysElapsed - 1).toISOString().split("T")[0];
}

export default function NewCaseForm({ onSaved, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [customIdMode, setCustomIdMode] = useState(false);
  const [caseIdError, setCaseIdError] = useState("");
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [isPsych, setIsPsych] = useState(false);
  const [form, setForm] = useState({
    custom_case_id: "",
    admission_date: "",
    assigned_counselor: "",
    benefit_period: "",
    days_remaining: "",
  });

  useEffect(() => {
    base44.entities.User.list().then(all => {
      setUsers(all.filter(u => u.active_flag !== false));
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isValid = form.admission_date && form.benefit_period && form.days_remaining !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setCaseIdError("");

    const today = format(new Date(), "yyyy-MM-dd");
    let caseId;
    if (customIdMode && form.custom_case_id.trim()) {
      caseId = form.custom_case_id.trim();
    } else {
      // Generate sequential ID based on existing cases this year
      const year = new Date().getFullYear();
      const allCases = await base44.entities.MCRCase.list("-created_date", 1000);
      const prefix = isPsych ? `MCR-PSYCH-` : `MCR-${year}-`;
      const nums = new Set(
        allCases
          .filter(c => c.case_id && c.case_id.startsWith(prefix))
          .map(c => parseInt(c.case_id.replace(prefix, ""), 10))
          .filter(n => !isNaN(n))
      );
      let nextNum = 1;
      while (nums.has(nextNum)) nextNum++;
      caseId = `${prefix}${String(nextNum).padStart(4, "0")}`;
    }

    // Check for duplicate case ID
    const existing = await base44.entities.MCRCase.filter({ case_id: caseId });
    if (existing.length > 0) {
      setCaseIdError(`Case ID "${caseId}" is already in use. Please enter a different ID.`);
      setSaving(false);
      return;
    }

    // Derive benefit_period_start_date from admission + period + days remaining
    const bpsd = calcBenefitStartDate(form.admission_date, form.benefit_period, form.days_remaining);

    await base44.entities.MCRCase.create({
      case_id: caseId,
      benefit_period_start_date: bpsd || form.admission_date,
      admission_date: form.admission_date,
      assigned_counselor: form.assigned_counselor || undefined,
      benefit_period_category: form.benefit_period,
      days_remaining_at_entry: parseInt(form.days_remaining),
      case_status: "Active",
      lrd_previously_used: 0,
      form_status: "Not Needed",
      last_census_verified: today,
      still_inpatient: "Yes",
    });

    setSaving(false);
    setCreatedCaseId(caseId);
  };

  if (createdCaseId) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>Case Created!</DialogTitle>
        </DialogHeader>
        <div className="py-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-slate-600 text-sm text-center">New MCR case has been successfully created.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-4 text-center">
            <p className="text-xs text-blue-600 uppercase font-semibold tracking-wide mb-1">Assigned Case ID</p>
            <p className="font-mono font-bold text-2xl text-blue-700">{createdCaseId}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSaved} className="w-full">Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>New MCR Case</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">

        {/* Case ID */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Case ID</Label>
            <button
              type="button"
              className="text-xs text-blue-600 underline"
              onClick={() => setCustomIdMode(m => !m)}
            >
              {customIdMode ? "Use auto-generated ID" : "Enter custom ID"}
            </button>
          </div>
          {customIdMode ? (
            <div className="space-y-1">
              <Input
                placeholder="e.g. MCR-2026-0042 or your own format"
                value={form.custom_case_id}
                onChange={e => { set("custom_case_id", e.target.value); setCaseIdError(""); }}
                className={caseIdError ? "border-red-500" : ""}
              />
              {caseIdError && <p className="text-xs text-red-600">{caseIdError}</p>}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border bg-slate-50 text-sm text-slate-500 font-mono">
              {isPsych
                ? "Auto-generated (MCR-PSYCH-0001, 0002, ...)"
                : `Auto-generated (MCR-${new Date().getFullYear()}-0001, 0002, ...)`}
            </div>
          )}
        </div>

        {/* Psych Patient */}
        <div className="flex items-center gap-3 p-3 rounded-md border bg-purple-50 border-purple-200">
          <input
            id="psych"
            type="checkbox"
            checked={isPsych}
            onChange={e => setIsPsych(e.target.checked)}
            className="w-4 h-4 accent-purple-600"
          />
          <Label htmlFor="psych" className="cursor-pointer text-purple-800 font-medium">
            Psych Patient
          </Label>
          {isPsych && (
            <span className="ml-auto text-xs font-mono text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
              ID: MCR-PSYCH-XXXX
            </span>
          )}
        </div>

        {/* Admission Date - Required */}
        <div className="space-y-1.5">
          <Label htmlFor="admit">Admission Date <span className="text-red-500">*</span></Label>
          <Input
            id="admit"
            type="date"
            required
            value={form.admission_date}
            onChange={e => set("admission_date", e.target.value)}
          />
        </div>

        {/* Benefit Period */}
        <div className="space-y-1.5">
          <Label>Benefit Period <span className="text-red-500">*</span></Label>
          <Select value={form.benefit_period} onValueChange={v => set("benefit_period", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select benefit period..." />
            </SelectTrigger>
            <SelectContent>
              {BENEFIT_PERIODS.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Days Remaining */}
        <div className="space-y-1.5">
          <Label htmlFor="days_rem">Days Remaining <span className="text-red-500">*</span></Label>
          <Input
            id="days_rem"
            type="number"
            min="0"
            max="365"
            placeholder="e.g. 45"
            value={form.days_remaining}
            onChange={e => set("days_remaining", e.target.value)}
          />
        </div>

        {/* Assigned Counselor */}
        <div className="space-y-1.5">
          <Label>Assigned Counselor <span className="text-slate-400 text-xs">(optional)</span></Label>
          <Select value={form.assigned_counselor} onValueChange={v => set("assigned_counselor", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select counselor..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.display_name || u.full_name}>
                  {u.display_name || u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
          Defaults set automatically: Case Status = Active, LRD Used = 0, Form Status = Not Needed, Last Verified = Today.
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !isValid}>
          {saving ? "Creating..." : "Create Case"}
        </Button>
      </DialogFooter>
    </form>
  );
}