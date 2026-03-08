import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enrichCase } from "./mcrUtils";

const COUNSELORS = ["Adcox, Tracy", "Chisenall, Nicholas", "Hoover, Eileen", "Huffman, Austin", "Weaver, Melissa"];
const FORM_STATUSES = ["Not Needed", "Pending", "Signed Opt-In", "Signed Opt-Out"];
const CASE_STATUSES = ["Active", "Closed", "Archived"];

export default function CaseDetailDialog({ mcr, onSaved, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ ...mcr });
  const enriched = enrichCase(form);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDelete = async () => {
    setDeleting(true);

    // Determine the prefix and number of the case being deleted
    // Supports formats: MCR-2026-0003, MCR-PSYCH-0003
    const caseId = mcr.case_id || "";
    const match = caseId.match(/^(MCR-(?:PSYCH-)?\d{4}-)(\d+)$/) || caseId.match(/^(MCR-PSYCH-)(\d+)$/);

    await base44.entities.MCRCase.delete(mcr.id);

    if (match) {
      const prefix = match[1];
      const deletedNum = parseInt(match[2], 10);

      // Find all cases with the same prefix and a higher number
      const allCases = await base44.entities.MCRCase.list("-created_date", 1000);
      const toRenumber = allCases
        .filter(c => {
          if (!c.case_id) return false;
          const m = c.case_id.match(new RegExp(`^${prefix.replace(/-/g, "\\-")}(\\d+)$`));
          return m && parseInt(m[1], 10) > deletedNum;
        })
        .sort((a, b) => {
          const numA = parseInt(a.case_id.replace(prefix, ""), 10);
          const numB = parseInt(b.case_id.replace(prefix, ""), 10);
          return numA - numB;
        });

      // Renumber each one down by 1
      for (const c of toRenumber) {
        const currentNum = parseInt(c.case_id.replace(prefix, ""), 10);
        const newId = `${prefix}${String(currentNum - 1).padStart(4, "0")}`;
        await base44.entities.MCRCase.update(c.id, { case_id: newId });
      }
    }

    setDeleting(false);
    onSaved();
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.MCRCase.update(mcr.id, {
      benefit_period_start_date: form.benefit_period_start_date,
      admission_date: form.admission_date || undefined,
      discharge_date: form.discharge_date || undefined,
      assigned_counselor: form.assigned_counselor || undefined,
      last_census_verified: form.last_census_verified || undefined,
      lrd_previously_used: parseInt(form.lrd_previously_used) || 0,
      form_status: form.form_status,
      form_given_date: form.form_given_date || undefined,
      form_returned_date: form.form_returned_date || undefined,
      form_uploaded: form.form_uploaded || "",
      verified_by: form.verified_by || undefined,
      case_status: form.case_status,
      still_inpatient: form.still_inpatient || "",
      notes: form.notes || undefined,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="font-mono text-blue-700">{mcr.case_id}</span>
          <span className="text-sm font-normal text-slate-500">– Edit Case</span>
        </DialogTitle>
      </DialogHeader>

      {/* Calculated display */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Medicare Day</p>
          <p className="text-2xl font-bold text-slate-800">{enriched._day}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Category</p>
          <p className="text-xs font-medium">{enriched._dayCategory}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Alert</p>
          <p className="text-xs font-semibold">{enriched._alertLevel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">LRD Remaining</p>
          <p className="text-lg font-bold text-purple-700">{enriched._lrdRemaining}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Days Left in Period</p>
          <p className={`text-lg font-bold ${enriched._daysRemainingInPeriod != null && enriched._daysRemainingInPeriod <= 5 ? "text-red-700" : enriched._daysRemainingInPeriod != null && enriched._daysRemainingInPeriod <= 15 ? "text-amber-700" : "text-green-700"}`}>
            {enriched._daysRemainingInPeriod ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">LRD Start Date</p>
          <p className="text-sm font-bold text-blue-700">
            {enriched._lifetimeStartDate
              ? (enriched.benefit_period_category === "Lifetime Reserve Days" || enriched.benefit_period_category === "Beyond Lifetime Reserve Days"
                ? "Already in LRD"
                : format(new Date(enriched._lifetimeStartDate), "MM/dd/yyyy"))
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Form Required?</p>
          <p className="text-xs font-semibold">{enriched._lifetimeFormRequired ? "✅ Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Census Overdue?</p>
          <p className={`text-xs font-semibold ${enriched._censusReviewOverdue ? "text-red-600" : "text-green-600"}`}>
            {enriched._censusReviewOverdue ? "⚠️ Yes" : "No"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Benefit Period Start <span className="text-red-500">*</span></Label>
          <Input type="date" value={form.benefit_period_start_date || ""} onChange={e => set("benefit_period_start_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Admission Date</Label>
          <Input type="date" value={form.admission_date || ""} onChange={e => set("admission_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Discharge Date</Label>
          <Input type="date" value={form.discharge_date || ""} onChange={e => set("discharge_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Last Census Verified</Label>
          <Input type="date" value={form.last_census_verified || ""} onChange={e => set("last_census_verified", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Assigned Counselor</Label>
          <Select value={form.assigned_counselor || ""} onValueChange={v => set("assigned_counselor", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{COUNSELORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Case Status</Label>
          <Select value={form.case_status || "Active"} onValueChange={v => set("case_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CASE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Still Inpatient?</Label>
          <Select value={form.still_inpatient || ""} onValueChange={v => set("still_inpatient", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">LRD Previously Used</Label>
          <Input type="number" min="0" max="60" value={form.lrd_previously_used ?? 0} onChange={e => set("lrd_previously_used", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Form Status</Label>
          <Select value={form.form_status || "Not Needed"} onValueChange={v => set("form_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FORM_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Verified By (initials)</Label>
          <Input maxLength={10} value={form.verified_by || ""} onChange={e => set("verified_by", e.target.value)} placeholder="e.g. MG" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Form Given Date</Label>
          <Input type="date" value={form.form_given_date || ""} onChange={e => set("form_given_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Form Returned Date</Label>
          <Input type="date" value={form.form_returned_date || ""} onChange={e => set("form_returned_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Form Uploaded?</Label>
          <Select value={form.form_uploaded || ""} onValueChange={v => set("form_uploaded", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={form.notes || ""}
          onChange={e => set("notes", e.target.value)}
          placeholder="Operational notes only..."
          className="h-20"
        />
        <p className="text-xs text-red-500 font-medium">⚠ Do not enter patient identifiers (name, MRN, DOB, SSN, account #, room #, or diagnosis).</p>
      </div>

      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <p className="font-semibold mb-2">Are you sure you want to permanently delete case <span className="font-mono">{mcr.case_id}</span>?</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Yes, Delete"}
            </Button>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 mr-auto" onClick={() => setConfirmDelete(true)} disabled={saving || deleting}>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Case
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving || deleting}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || deleting}>{saving ? "Saving..." : "Save Changes"}</Button>
      </DialogFooter>
    </div>
  );
}