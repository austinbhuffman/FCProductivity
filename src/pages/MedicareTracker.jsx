import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Shield, Search, LogOut } from "lucide-react";
import { enrichCase, isFormSigned, getAlertPriority } from "@/components/mcr/mcrUtils";
import { sendMCRNotifications, notifyAllUsersUrgentCase } from "@/components/mcr/mcrNotifications";
import SummaryCards from "@/components/mcr/SummaryCards";
import CaseTable from "@/components/mcr/CaseTable";
import NewCaseForm from "@/components/mcr/NewCaseForm";
import CaseDetailDialog from "@/components/mcr/CaseDetailDialog";

const TODAY = format(new Date(), "yyyy-MM-dd");

export default function MedicareTracker() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevUrgentIdsRef = useRef(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [caseTypeTab, setCaseTypeTab] = useState("mcr");
  const [dischargeCase, setDischargeCase] = useState(null);
  const [dischargeDate, setDischargeDate] = useState(TODAY);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const raw = await base44.entities.MCRCase.list("-created_date", 500);
    const enriched = raw.map(enrichCase);
    setCases(enriched);
    setLoading(false);

    // Detect cases that just became urgent and notify all users
    const currentUrgentIds = new Set(
      enriched
        .filter(c => c.case_status === "Active" && c._day >= 86 && !isFormSigned(c.form_status))
        .map(c => c.case_id)
    );
    if (prevUrgentIdsRef.current !== null) {
      for (const caseId of currentUrgentIds) {
        if (!prevUrgentIdsRef.current.has(caseId)) {
          notifyAllUsersUrgentCase(caseId);
        }
      }
    }
    prevUrgentIdsRef.current = currentUrgentIds;
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  const refresh = () => loadCases();

  const quickAction = async (c, action) => {
    if (action === "__discharge__") { openDischarge(c); return; }
    let updates = {};
    if (action === "verify") {
      updates = { last_census_verified: TODAY, still_inpatient: "Yes" };
    } else if (action === "close") {
      updates = { still_inpatient: "No", case_status: "Closed" };
    } else if (action === "formGiven") {
      updates = { form_given_date: TODAY, form_status: isFormSigned(c.form_status) ? c.form_status : "Pending" };
    } else if (action === "signOptIn") {
      updates = { form_status: "Signed Opt-In", form_returned_date: TODAY };
    } else if (action === "signOptOut") {
      updates = { form_status: "Signed Opt-Out", form_returned_date: TODAY };
    }
    await base44.entities.MCRCase.update(c.id, updates);
    // Update only the affected case in local state (no full reload = no scroll jump)
    setCases(prev => prev.map(existing =>
      existing.id === c.id ? enrichCase({ ...existing, ...updates }) : existing
    ));
  };

  const activeCases = cases.filter(c =>
    c.case_status === "Active" &&
    (!activeSearch || c.case_id?.toLowerCase().includes(activeSearch.toLowerCase()))
  );
  const closedCases = cases.filter(c => c.case_status !== "Active");

  const isPsych = (c) => c.case_id?.toUpperCase().includes("PSYCH");
  const psychActive = activeCases.filter(isPsych);
  const mcrActive = activeCases.filter(c => !isPsych(c));

  const urgentCases = activeCases
    .filter(c => c._day >= 86 && !isFormSigned(c.form_status))
    .sort((a, b) => b._day - a._day);

  const monitorCases = activeCases
    .filter(c => c._day >= 75 && c._day <= 85)
    .sort((a, b) => b._day - a._day);

  const allActiveSorted = [...activeCases].sort((a, b) => {
    const pa = getAlertPriority(a._alertLevel);
    const pb = getAlertPriority(b._alertLevel);
    if (pa !== pb) return pa - pb;
    return b._day - a._day;
  });

  const CATEGORIES = [
    { key: "Deductible Days", label: "📘 Deductible Days (Days 1–60)", color: "blue" },
    { key: "Coinsurance Days", label: "🟠 Coinsurance Days (Days 61–90)", color: "orange" },
    { key: "Lifetime Reserve Days", label: "🔴 Lifetime Reserve Days (Days 91–150)", color: "red" },
    { key: "Beyond Lifetime Reserve Days", label: "⚫ Beyond Lifetime Reserve Days", color: "slate" },
  ];

  const colorMap = {
    blue:   { border: "border-blue-300",   bg: "bg-blue-50",   titleColor: "text-blue-700",   badgeBg: "bg-blue-600" },
    orange: { border: "border-orange-300", bg: "bg-orange-50", titleColor: "text-orange-700", badgeBg: "bg-orange-500" },
    red:    { border: "border-red-300",    bg: "bg-red-50",    titleColor: "text-red-700",    badgeBg: "bg-red-600" },
    slate:  { border: "border-slate-300",  bg: "bg-slate-100", titleColor: "text-slate-700",  badgeBg: "bg-slate-600" },
  };

  // Determine the current category for a case (may have advanced since entry)
  function getCurrentCategory(c) {
    if (c._day >= 91) return "Lifetime Reserve Days";
    if (c._day >= 61) return "Coinsurance Days";
    return "Deductible Days";
  }

  const overdueCases = activeCases
    .filter(c => c._censusReviewOverdue)
    .sort((a, b) => {
      if (!a.last_census_verified) return -1;
      if (!b.last_census_verified) return 1;
      return a.last_census_verified.localeCompare(b.last_census_verified);
    });

  const filteredArchive = closedCases.filter(c =>
    !archiveSearch || c.case_id?.toLowerCase().includes(archiveSearch.toLowerCase())
  );

  const dischargeBtn = { label: "🏥 Discharge", action: "__discharge__", className: "bg-orange-500 hover:bg-orange-600 text-white border-0" };

  const urgentActions = [
    { label: "✅ Verify Today", action: "verify", className: "bg-green-600 hover:bg-green-700 text-white border-0" },
    dischargeBtn,
    { label: "📋 Form Given", action: "formGiven", className: "bg-blue-600 hover:bg-blue-700 text-white border-0" },
    { label: "✔ Opt-In", action: "signOptIn", className: "bg-emerald-600 hover:bg-emerald-700 text-white border-0" },
    { label: "✘ Opt-Out", action: "signOptOut", className: "bg-slate-600 hover:bg-slate-700 text-white border-0" },
    { label: "🔒 Close", action: "close", className: "bg-red-100 hover:bg-red-200 text-red-700 border-red-200" },
  ];

  const reviewActions = [
    { label: "✅ Verify Today", action: "verify", className: "bg-green-600 hover:bg-green-700 text-white border-0" },
    dischargeBtn,
    { label: "🔒 Close", action: "close", className: "bg-red-100 hover:bg-red-200 text-red-700 border-red-200" },
  ];

  const openDetail = (c) => setSelectedCase(c);

  const openDischarge = (c) => {
    setDischargeDate(TODAY);
    setDischargeCase(c);
  };

  const confirmDischarge = async () => {
    if (!dischargeCase || !dischargeDate) return;
    await base44.entities.MCRCase.update(dischargeCase.id, {
      discharge_date: dischargeDate,
      still_inpatient: "No",
      case_status: "Closed",
    });
    setDischargeCase(null);
    await loadCases();
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Medicare Benefit Period & LRD Tracker</h1>
              <p className="text-xs text-slate-500">Financial Clearance · No PHI stored · Internal operational tracking only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowNewCase(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-3.5 h-3.5" /> New MCR Case
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards cases={cases} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="h-10 text-sm pl-9 w-72 border-2 border-blue-300 focus:border-blue-500 bg-white shadow-sm font-medium placeholder:text-slate-400"
                placeholder="Search by Case ID..."
                value={activeSearch}
                onChange={e => setActiveSearch(e.target.value)}
              />
            </div>
            {activeSearch && (
              <button onClick={() => setActiveSearch("")} className="text-xs text-slate-500 underline">Clear</button>
            )}
          </div>
          <TabsList className="mb-2">
            <TabsTrigger value="active">Active Queues</TabsTrigger>
            <TabsTrigger value="archive">Closed / Archived</TabsTrigger>
          </TabsList>

          {/* ACTIVE TAB */}
          <TabsContent value="active" className="space-y-4">

            {/* MCR / PSYCH sub-tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setCaseTypeTab("mcr")}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-colors ${caseTypeTab === "mcr" ? "bg-blue-600 text-white border-blue-600 shadow" : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"}`}
              >
                MCR Cases <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${caseTypeTab === "mcr" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"}`}>{mcrActive.length}</span>
              </button>
              <button
                onClick={() => setCaseTypeTab("psych")}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-colors ${caseTypeTab === "psych" ? "bg-purple-600 text-white border-purple-600 shadow" : "bg-white text-slate-600 border-slate-300 hover:border-purple-400"}`}
              >
                PSYCH MCR Cases <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${caseTypeTab === "psych" ? "bg-purple-500 text-white" : "bg-slate-100 text-slate-600"}`}>{psychActive.length}</span>
              </button>
            </div>

            {/* ── MCR SECTION ── */}
            {caseTypeTab === "mcr" && (<div className="space-y-4">

              {/* URGENT - MCR */}
              {(() => {
                const list = mcrActive.filter(c => c._day >= 86 && !isFormSigned(c.form_status)).sort((a, b) => b._day - a._day);
                return (
                  <Card className="border-red-300 shadow-sm">
                    <CardHeader className="pb-2 bg-red-50 rounded-t-lg border-b border-red-200">
                      <CardTitle className="text-red-700 text-base flex items-center justify-between">
                        🔴 Urgent: Form Action Needed
                        <Badge className="bg-red-600 text-white">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={list} columns={["case_id", "_day", "_dayCategory", "_alertLevel", "form_status", "form_given_date", "assigned_counselor", "last_census_verified", "_censusReviewOverdue"]} actionButtons={urgentActions} onAction={quickAction} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* MONITOR - MCR */}
              {(() => {
                const list = mcrActive.filter(c => c._day >= 75 && c._day <= 85).sort((a, b) => b._day - a._day);
                return (
                  <Card className="border-yellow-300 shadow-sm">
                    <CardHeader className="pb-2 bg-yellow-50 rounded-t-lg border-b border-yellow-200">
                      <CardTitle className="text-yellow-700 text-base flex items-center justify-between">
                        🟡 Monitor: Days 75–85
                        <Badge className="bg-yellow-500 text-white">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={list} columns={["case_id", "_day", "_alertLevel", "assigned_counselor", "last_census_verified"]} actionButtons={[{ label: "✅ Verify Today", action: "verify", className: "bg-green-600 hover:bg-green-700 text-white border-0" }, dischargeBtn, { label: "🔒 Close", action: "close", className: "bg-red-100 hover:bg-red-200 text-red-700 border-red-200" }]} onAction={quickAction} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* WEEKLY REVIEW - MCR */}
              {(() => {
                const list = mcrActive.filter(c => c._censusReviewOverdue).sort((a, b) => { if (!a.last_census_verified) return -1; if (!b.last_census_verified) return 1; return a.last_census_verified.localeCompare(b.last_census_verified); });
                return (
                  <Card className="border-amber-300 shadow-sm">
                    <CardHeader className="pb-2 bg-amber-50 rounded-t-lg border-b border-amber-200">
                      <CardTitle className="text-amber-700 text-base flex items-center justify-between">
                        ⚠️ Weekly Census Review Needed
                        <Badge className="bg-amber-500 text-white">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={list} columns={["case_id", "_day", "_alertLevel", "assigned_counselor", "last_census_verified", "_censusReviewOverdue"]} actionButtons={reviewActions} onAction={quickAction} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* BY CATEGORY - MCR */}
              {CATEGORIES.map(cat => {
                const catCases = mcrActive.filter(c => {
                  if (cat.key === "Beyond Lifetime Reserve Days") return c.benefit_period_category === "Beyond Lifetime Reserve Days";
                  if (cat.key === "Lifetime Reserve Days") return getCurrentCategory(c) === "Lifetime Reserve Days" && c.benefit_period_category !== "Beyond Lifetime Reserve Days";
                  return getCurrentCategory(c) === cat.key;
                }).sort((a, b) => b._day - a._day);
                const s = colorMap[cat.color];
                return (
                  <Card key={`mcr-${cat.key}`} className={`${s.border} shadow-sm`}>
                    <CardHeader className={`pb-2 ${s.bg} rounded-t-lg border-b ${s.border}`}>
                      <CardTitle className={`${s.titleColor} text-base flex items-center justify-between`}>
                        {cat.label}
                        <Badge className={`${s.badgeBg} text-white`}>{catCases.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={catCases} columns={["case_id", "_day", "_alertLevel", "_nextCategoryDate", "_lifetimeStartDate", "form_status", "_lrdRemaining", "assigned_counselor", "last_census_verified", "_censusReviewOverdue"]} actionButtons={[{ label: "Edit", action: "__detail__", variant: "outline" }, { label: "✅ Verify", action: "verify", className: "bg-green-600 hover:bg-green-700 text-white border-0" }, dischargeBtn]} onAction={(c, action) => { if (action === "__detail__") openDetail(c); else quickAction(c, action); }} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>)}

            {/* ── PSYCH SECTION ── */}
            {caseTypeTab === "psych" && (<div className="space-y-4">

              {/* URGENT - PSYCH */}
              {(() => {
                const list = psychActive.filter(c => c._day >= 86 && !isFormSigned(c.form_status)).sort((a, b) => b._day - a._day);
                return (
                  <Card className="border-red-300 shadow-sm">
                    <CardHeader className="pb-2 bg-red-50 rounded-t-lg border-b border-red-200">
                      <CardTitle className="text-red-700 text-base flex items-center justify-between">
                        🔴 Urgent: Form Action Needed
                        <Badge className="bg-red-600 text-white">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={list} columns={["case_id", "_day", "_dayCategory", "_alertLevel", "form_status", "form_given_date", "assigned_counselor", "last_census_verified", "_censusReviewOverdue"]} actionButtons={urgentActions} onAction={quickAction} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* MONITOR - PSYCH */}
              {(() => {
                const list = psychActive.filter(c => c._day >= 75 && c._day <= 85).sort((a, b) => b._day - a._day);
                return (
                  <Card className="border-yellow-300 shadow-sm">
                    <CardHeader className="pb-2 bg-yellow-50 rounded-t-lg border-b border-yellow-200">
                      <CardTitle className="text-yellow-700 text-base flex items-center justify-between">
                        🟡 Monitor: Days 75–85
                        <Badge className="bg-yellow-500 text-white">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={list} columns={["case_id", "_day", "_alertLevel", "assigned_counselor", "last_census_verified"]} actionButtons={[{ label: "✅ Verify Today", action: "verify", className: "bg-green-600 hover:bg-green-700 text-white border-0" }, dischargeBtn, { label: "🔒 Close", action: "close", className: "bg-red-100 hover:bg-red-200 text-red-700 border-red-200" }]} onAction={quickAction} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* WEEKLY REVIEW - PSYCH */}
              {(() => {
                const list = psychActive.filter(c => c._censusReviewOverdue).sort((a, b) => { if (!a.last_census_verified) return -1; if (!b.last_census_verified) return 1; return a.last_census_verified.localeCompare(b.last_census_verified); });
                return (
                  <Card className="border-amber-300 shadow-sm">
                    <CardHeader className="pb-2 bg-amber-50 rounded-t-lg border-b border-amber-200">
                      <CardTitle className="text-amber-700 text-base flex items-center justify-between">
                        ⚠️ Weekly Census Review Needed
                        <Badge className="bg-amber-500 text-white">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={list} columns={["case_id", "_day", "_alertLevel", "assigned_counselor", "last_census_verified", "_censusReviewOverdue"]} actionButtons={reviewActions} onAction={quickAction} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* BY CATEGORY - PSYCH */}
              {CATEGORIES.map(cat => {
                const catCases = psychActive.filter(c => {
                  if (cat.key === "Beyond Lifetime Reserve Days") return c.benefit_period_category === "Beyond Lifetime Reserve Days";
                  if (cat.key === "Lifetime Reserve Days") return getCurrentCategory(c) === "Lifetime Reserve Days" && c.benefit_period_category !== "Beyond Lifetime Reserve Days";
                  return getCurrentCategory(c) === cat.key;
                }).sort((a, b) => b._day - a._day);
                const s = colorMap[cat.color];
                return (
                  <Card key={`psych-${cat.key}`} className={`${s.border} shadow-sm`}>
                    <CardHeader className={`pb-2 ${s.bg} rounded-t-lg border-b ${s.border}`}>
                      <CardTitle className={`${s.titleColor} text-base flex items-center justify-between`}>
                        {cat.label}
                        <Badge className={`${s.badgeBg} text-white`}>{catCases.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <CaseTable cases={catCases} columns={["case_id", "_day", "_alertLevel", "_nextCategoryDate", "_lifetimeStartDate", "form_status", "_lrdRemaining", "assigned_counselor", "last_census_verified", "_censusReviewOverdue"]} actionButtons={[{ label: "Edit", action: "__detail__", variant: "outline" }, { label: "✅ Verify", action: "verify", className: "bg-green-600 hover:bg-green-700 text-white border-0" }, dischargeBtn]} onAction={(c, action) => { if (action === "__detail__") openDetail(c); else quickAction(c, action); }} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>)}

          </TabsContent>

          {/* ARCHIVE TAB */}
          <TabsContent value="archive" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-200">
                <CardTitle className="text-slate-700 text-base flex items-center justify-between">
                  Closed / Archived Cases
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-7 text-xs w-48"
                      placeholder="Search by Case ID..."
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                    />
                    <Badge variant="outline">{filteredArchive.length}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <CaseTable
                  cases={filteredArchive}
                  columns={["case_id", "_day", "_dayCategory", "form_status", "_lrdRemaining", "assigned_counselor", "last_census_verified", "case_status"]}
                  actionButtons={[
                    { label: "Edit", action: "__detail__", variant: "outline" },
                  ]}
                  onAction={(c, action) => {
                    if (action === "__detail__") openDetail(c);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Case Dialog */}
      <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
        <DialogContent className="max-w-md">
          <NewCaseForm
            onSaved={() => { setShowNewCase(false); loadCases(); }}
            onCancel={() => setShowNewCase(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={!!dischargeCase} onOpenChange={open => { if (!open) setDischargeCase(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-orange-500" />
              Discharge Patient
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-600">
              Case: <span className="font-mono font-bold text-blue-700">{dischargeCase?.case_id}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="discharge-date">Discharge Date</Label>
              <Input
                id="discharge-date"
                type="date"
                value={dischargeDate}
                onChange={e => setDischargeDate(e.target.value)}
                max={TODAY}
              />
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-xs text-orange-800">
              This will set the discharge date and automatically close the case.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDischargeCase(null)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={confirmDischarge}
              disabled={!dischargeDate}
            >
              Confirm Discharge & Close Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={open => { if (!open) setSelectedCase(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedCase && (
            <CaseDetailDialog
              mcr={selectedCase}
              onSaved={() => { setSelectedCase(null); loadCases(); }}
              onCancel={() => setSelectedCase(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}