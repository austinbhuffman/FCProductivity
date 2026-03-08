import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, parseISO, isValid } from "date-fns";

const fmt = (d) => {
  if (!d) return "—";
  try { return format(parseISO(d), "MM/dd/yyyy"); } catch { return d; }
};

const alertBadge = (level) => {
  const base = "px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap";
  if (level.startsWith("⚫")) return <span className={`${base} bg-slate-800 text-white`}>{level}</span>;
  if (level.startsWith("🔴")) return <span className={`${base} bg-red-100 text-red-800`}>{level}</span>;
  if (level.startsWith("🟡")) return <span className={`${base} bg-yellow-100 text-yellow-800`}>{level}</span>;
  return <span className={`${base} bg-green-100 text-green-800`}>{level}</span>;
};

const formBadge = (status) => {
  const base = "px-2 py-0.5 rounded text-xs font-semibold";
  if (status === "Signed Opt-In") return <span className={`${base} bg-green-100 text-green-800`}>{status}</span>;
  if (status === "Signed Opt-Out") return <span className={`${base} bg-slate-100 text-slate-700`}>{status}</span>;
  if (status === "Pending") return <span className={`${base} bg-amber-100 text-amber-800`}>{status}</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>{status || "Not Needed"}</span>;
};

const PAGE_SIZE = 10;

export default function CaseTable({ cases, columns, onAction, actionButtons }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const colDefs = {
    case_id: { label: "Case ID", render: c => <span className="font-mono font-semibold text-blue-700 whitespace-nowrap">{c.case_id}</span> },
    _day: { label: "Day", render: c => {
      const d = c._day;
      let label;
      if (d <= 60) { label = `${d}/60`; }
      else if (d <= 90) { label = `${d - 60}/30`; }
      else { label = `${d - 90}/60`; }
      return <span className="font-bold whitespace-nowrap text-xs">{label}</span>;
    }},
    _dayCategory: { label: "Category", render: c => <span className="text-xs whitespace-nowrap">{c._dayCategory}</span> },
    _alertLevel: { label: "Alert", render: c => alertBadge(c._alertLevel) },
    form_status: { label: "Form Status", render: c => (
      <div className="flex flex-col gap-0.5">
        {formBadge(c.form_status)}
        {c.form_status === "Signed Opt-In" && (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.form_uploaded === "Yes" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {c.form_uploaded === "Yes" ? "Uploaded" : "Not Uploaded"}
          </span>
        )}
      </div>
    )},
    form_given_date: { label: "Form Given", render: c => <span className="whitespace-nowrap text-xs">{fmt(c.form_given_date)}</span> },
    assigned_counselor: { label: "Counselor", render: c => <span className="whitespace-nowrap text-xs">{c.assigned_counselor || "—"}</span> },
    last_census_verified: { label: "Last Verified", render: c => <span className="whitespace-nowrap text-xs">{fmt(c.last_census_verified)}</span> },
    _censusReviewOverdue: { label: "Overdue?", render: c => c._censusReviewOverdue ? <span className="text-red-600 font-semibold text-xs whitespace-nowrap">Yes</span> : <span className="text-green-600 text-xs">No</span> },
    case_status: { label: "Status", render: c => <span className="whitespace-nowrap text-xs">{c.case_status}</span> },
    _lrdRemaining: { label: "LRD", render: c => <span className="font-semibold whitespace-nowrap text-xs">{c._lrdRemaining}</span> },
    _lifetimeStartDate: { label: "LRD Start", render: c => {
      if (!c._lifetimeStartDate) return <span className="text-slate-400">—</span>;
      const isAlreadyLRD = c.benefit_period_category === "Lifetime Reserve Days" || c.benefit_period_category === "Beyond Lifetime Reserve Days";
      if (isAlreadyLRD) return <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">In LRD</span>;
      const date = c._lifetimeStartDate;
      const isPast = new Date(date) <= new Date();
      return <span className={`text-xs font-semibold whitespace-nowrap ${isPast ? "text-red-700" : "text-blue-700"}`}>{fmt(date)}</span>;
    }},
    _nextCategoryDate: { label: "Next Cat. Date", render: c => {
      if (!c._nextCategoryDate) return <span className="text-slate-400">—</span>;
      const isPast = new Date(c._nextCategoryDate) <= new Date();
      return <span className={`text-xs font-semibold whitespace-nowrap ${isPast ? "text-red-700" : "text-blue-700"}`}>{fmt(c._nextCategoryDate)}</span>;
    }},
    _daysRemainingInPeriod: { label: "Days Left in Period", render: c => {
      const val = c._daysRemainingInPeriod;
      if (val == null) return <span className="text-slate-400">—</span>;
      const color = val <= 5 ? "text-red-700 font-bold" : val <= 15 ? "text-amber-700 font-semibold" : "text-green-700 font-semibold";
      return <span className={color}>{val}</span>;
    }},
  };

  if (!cases.length) {
    return <p className="text-center text-slate-400 py-8 text-sm">No cases in this queue.</p>;
  }

  const visibleCases = cases.slice(0, visible);
  const hasMore = visible < cases.length;

  return (
    <div className="w-full">
      <Table className="w-full text-xs">
        <TableHeader>
          <TableRow className="bg-slate-50">
            {columns.map(col => (
              <TableHead key={col} className="text-xs font-semibold text-slate-600 whitespace-nowrap px-2 py-1.5">
                {colDefs[col]?.label || col}
              </TableHead>
            ))}
            {actionButtons && <TableHead className="text-xs font-semibold text-slate-600 px-2 py-1.5">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleCases.map(c => (
            <TableRow key={c.id} className="hover:bg-slate-50 transition-colors">
              {columns.map(col => (
                <TableCell key={col} className="py-1.5 text-xs px-2">
                  {colDefs[col]?.render(c) ?? "—"}
                </TableCell>
              ))}
              {actionButtons && (
                <TableCell className="py-1.5 px-2">
                  <div className="flex flex-wrap gap-1">
                    {actionButtons.map(btn => (
                      <Button
                        key={btn.label}
                        size="sm"
                        variant={btn.variant || "outline"}
                        className={`text-xs h-6 px-2 whitespace-nowrap ${btn.className || ""}`}
                        onClick={() => onAction(c, btn.action)}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasMore && (
        <div className="flex justify-center pt-3 pb-1">
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-slate-600 border-slate-300"
            onClick={() => setVisible(v => v + PAGE_SIZE)}
          >
            Load More ({cases.length - visible} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}