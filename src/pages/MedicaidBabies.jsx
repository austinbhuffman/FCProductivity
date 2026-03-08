import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Save, Baby, AlertCircle, Lock, BarChart3, TrendingUp, Download, ChevronLeft, ChevronRight, CheckCircle2, ClipboardList } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, lastDayOfMonth, isSameDay } from "date-fns";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function MedicaidBabies() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedUserId, setSelectedUserId] = useState("");
  const [log, setLog] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [allLogs, setAllLogs] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardMonth, setDashboardMonth] = useState(new Date());
  const [monthEndRecord, setMonthEndRecord] = useState(null);
  const [monthEndPending, setMonthEndPending] = useState(0);
  const [monthEndApproved, setMonthEndApproved] = useState(0);
  const [monthEndNotes, setMonthEndNotes] = useState("");
  const [savingMonthEnd, setSavingMonthEnd] = useState(false);

  // Form data
  const [totalBabies, setTotalBabies] = useState(0);
  const [changeForms, setChangeForms] = useState(0);
  const [momMcdApplications, setMomMcdApplications] = useState(0);
  const [commercialBabies, setCommercialBabies] = useState(0);
  const [babyNameUpdates, setBabyNameUpdates] = useState(0);
  const [allkidsMcdApplications, setAllkidsMcdApplications] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadInitialData();
    loadDashboardData();
    loadMonthEndRecord(new Date());
    loadMonthEndChartData(new Date()).then(data => setDashboardData(prev => prev ? { ...prev, monthEndChartData: data } : null));
  }, []);

  useEffect(() => {
    if (user && selectedDate) {
      const userIdToLoad = user.app_role === "admin" && selectedUserId ? selectedUserId : user.id;
      if (userIdToLoad) {
        loadLog(userIdToLoad, selectedDate);
      }
    }
  }, [selectedDate, selectedUserId, user]);

  const loadInitialData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setSelectedUserId(currentUser.id);

      if (currentUser.app_role === "admin" || currentUser.app_role === "manager") {
        const users = await base44.entities.User.list();
        const activeUsers = users.filter(u => u.active_flag !== false);
        setAllUsers(activeUsers);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading initial data:", error);
      setMessage({ type: "error", text: "Error loading data" });
      setLoading(false);
    }
  };

  const loadLog = async (userId, date) => {
    try {
      const logs = await base44.entities.MedicaidBabyLog.filter({ user_id: userId, date });
      
      if (logs.length > 0) {
        const existingLog = logs[0];
        setLog(existingLog);
        setTotalBabies(existingLog.total_babies || 0);
        setChangeForms(existingLog.change_forms || 0);
        setMomMcdApplications(existingLog.mom_mcd_applications || 0);
        setCommercialBabies(existingLog.commercial_babies || 0);
        setBabyNameUpdates(existingLog.baby_name_updates || 0);
        setAllkidsMcdApplications(existingLog.allkids_mcd_applications || 0);
        setNotes(existingLog.notes || "");
      } else {
        resetForm();
      }
    } catch (error) {
      console.error("Error loading log:", error);
      setMessage({ type: "error", text: "Error loading log" });
    }
  };

  const resetForm = () => {
    setLog(null);
    setTotalBabies(0);
    setChangeForms(0);
    setMomMcdApplications(0);
    setCommercialBabies(0);
    setBabyNameUpdates(0);
    setAllkidsMcdApplications(0);
    setNotes("");
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const userIdToUse = user.app_role === "admin" && selectedUserId ? selectedUserId : user.id;
      const userNameToUse = user.app_role === "admin" && selectedUserId 
        ? allUsers.find(u => u.id === selectedUserId)?.display_name || allUsers.find(u => u.id === selectedUserId)?.full_name 
        : user.display_name || user.full_name;

      const logData = {
        user_id: userIdToUse,
        user_name: userNameToUse,
        date: selectedDate,
        total_babies: totalBabies,
        change_forms: changeForms,
        mom_mcd_applications: momMcdApplications,
        commercial_babies: commercialBabies,
        baby_name_updates: babyNameUpdates,
        allkids_mcd_applications: allkidsMcdApplications,
        notes: notes,
        status: "submitted"
      };

      if (log) {
        const updatedLog = await base44.entities.MedicaidBabyLog.update(log.id, logData);
        setLog(updatedLog);
      } else {
        const newLog = await base44.entities.MedicaidBabyLog.create(logData);
        setLog(newLog);
      }

      setMessage({ type: "success", text: "Log saved successfully!" });
      await loadDashboardData();
    } catch (error) {
      console.error("Error saving log:", error);
      setMessage({ type: "error", text: "Error saving log. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const loadMonthEndChartData = async (monthRef) => {
    const ref = monthRef || dashboardMonth;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(ref, i);
      const monthStr = format(d, "yyyy-MM");
      months.push({ monthStr, label: format(d, "MMM yyyy") });
    }
    const records = await base44.entities.MonthEndSubmission.list().catch(() => []);
    return months.map(({ monthStr, label }) => {
      const r = records.find(x => x.month === monthStr);
      return { month: label, pending: r?.pending_submissions || 0, approved: r?.approved_submissions || 0 };
    });
  };

  const loadDashboardData = async (monthRef) => {
    const refMonth = monthRef || dashboardMonth;
    try {
      const logs = await base44.entities.MedicaidBabyLog.filter({ status: "submitted" });
      setAllLogs(logs);

      // Calculate last 6 months data centered around refMonth
      const monthsData = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(refMonth, i);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        
        const monthLogs = logs.filter(log => {
          const logDate = new Date(log.date);
          return logDate >= monthStart && logDate <= monthEnd;
        });

        const totals = {
          month: format(date, "MMM yyyy"),
          totalBabies: monthLogs.reduce((sum, l) => sum + (l.total_babies || 0), 0),
          changeForms: monthLogs.reduce((sum, l) => sum + (l.change_forms || 0), 0),
          momMcdApplications: monthLogs.reduce((sum, l) => sum + (l.mom_mcd_applications || 0), 0),
          commercialBabies: monthLogs.reduce((sum, l) => sum + (l.commercial_babies || 0), 0),
          babyNameUpdates: monthLogs.reduce((sum, l) => sum + (l.baby_name_updates || 0), 0),
          allkidsMcdApplications: monthLogs.reduce((sum, l) => sum + (l.allkids_mcd_applications || 0), 0)
        };

        monthsData.push(totals);
      }

      // Current (selected) month totals
      const currentMonthLogs = logs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= startOfMonth(refMonth) && logDate <= endOfMonth(refMonth);
      });

      const mtdTotals = {
        totalBabies: currentMonthLogs.reduce((sum, l) => sum + (l.total_babies || 0), 0),
        changeForms: currentMonthLogs.reduce((sum, l) => sum + (l.change_forms || 0), 0),
        momMcdApplications: currentMonthLogs.reduce((sum, l) => sum + (l.mom_mcd_applications || 0), 0),
        commercialBabies: currentMonthLogs.reduce((sum, l) => sum + (l.commercial_babies || 0), 0),
        babyNameUpdates: currentMonthLogs.reduce((sum, l) => sum + (l.baby_name_updates || 0), 0),
        allkidsMcdApplications: currentMonthLogs.reduce((sum, l) => sum + (l.allkids_mcd_applications || 0), 0)
      };

      const monthEndChartData = await loadMonthEndChartData(refMonth);
      setDashboardData({ monthsData, mtdTotals, monthEndChartData });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const handleMonthChange = (direction) => {
    const newMonth = direction === "prev" ? subMonths(dashboardMonth, 1) : addMonths(dashboardMonth, 1);
    setDashboardMonth(newMonth);
    loadDashboardData(newMonth);
    loadMonthEndRecord(newMonth);
  };

  const loadMonthEndRecord = async (monthRef) => {
    const ref = monthRef || new Date();
    const monthStr = format(ref, "yyyy-MM");
    const records = await base44.entities.MonthEndSubmission.filter({ month: monthStr }).catch(() => []);
    if (records.length > 0) {
      const r = records[0];
      setMonthEndRecord(r);
      setMonthEndPending(r.pending_submissions || 0);
      setMonthEndApproved(r.approved_submissions || 0);
      setMonthEndNotes(r.notes || "");
    } else {
      setMonthEndRecord(null);
      setMonthEndPending(0);
      setMonthEndApproved(0);
      setMonthEndNotes("");
    }
  };

  const handleSaveMonthEnd = async () => {
    setSavingMonthEnd(true);
    const monthStr = format(dashboardMonth, "yyyy-MM");
    const data = {
      month: monthStr,
      submitted_by_user_id: user.id,
      submitted_by_user_name: user.display_name || user.full_name,
      pending_submissions: monthEndPending,
      approved_submissions: monthEndApproved,
      notes: monthEndNotes,
      status: "submitted"
    };
    if (monthEndRecord) {
      await base44.entities.MonthEndSubmission.update(monthEndRecord.id, data);
    } else {
      const created = await base44.entities.MonthEndSubmission.create(data);
      setMonthEndRecord(created);
    }
    setSavingMonthEnd(false);
    setMessage({ type: "success", text: "Month-end submission saved!" });
  };

  const isLastDayOfMonth = isSameDay(new Date(), lastDayOfMonth(dashboardMonth));

  const exportToExcel = () => {
    if (!allLogs.length) return;

    // Build rows for the selected dashboard month range (6 months)
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(dashboardMonth, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthLogs = allLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= monthStart && logDate <= monthEnd;
      });

      monthLogs.forEach(log => {
        rows.push({
          "Date": log.date,
          "User": log.user_name || "",
          "Total Babies": log.total_babies || 0,
          "Change Forms": log.change_forms || 0,
          "Mom MCD Applications": log.mom_mcd_applications || 0,
          "Commercial Babies": log.commercial_babies || 0,
          "Baby Name Updates": log.baby_name_updates || 0,
          "AllKids MCD Applications": log.allkids_mcd_applications || 0,
          "Notes": log.notes || ""
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medicaid Babies");
    XLSX.writeFile(wb, `MedicaidBabies_${format(dashboardMonth, "yyyy-MM")}.xlsx`);
  };

  const isLocked = log?.is_locked;
  const isSubmitted = log?.status === "submitted";

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))` }}>
          <Baby className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: `hsl(var(--foreground))` }}>Medicaid Babies</h1>
          <p className="text-sm" style={{ color: `hsl(var(--muted-foreground))` }}>Track Medicaid applications and baby registrations</p>
        </div>
      </div>

      {message.text && (
        <Alert className={message.type === "error" ? "border-destructive" : "border-success"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
            <Calendar className="w-5 h-5" />
            Daily Log Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user?.app_role === "admin" && (
              <div className="space-y-2">
                <Label style={{ color: `hsl(var(--foreground))` }}>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))` }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id} style={{ color: `hsl(var(--foreground))` }}>
                        {u.display_name || u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>
          </div>

          {isLocked && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>This log has been locked by a manager and cannot be edited.</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>Total Babies</Label>
              <Input
                type="number"
                min="0"
                value={totalBabies}
                onChange={(e) => setTotalBabies(parseInt(e.target.value) || 0)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>Change Forms</Label>
              <Input
                type="number"
                min="0"
                value={changeForms}
                onChange={(e) => setChangeForms(parseInt(e.target.value) || 0)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>Mom Medicaid Application</Label>
              <Input
                type="number"
                min="0"
                value={momMcdApplications}
                onChange={(e) => setMomMcdApplications(parseInt(e.target.value) || 0)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>Commercial Babies</Label>
              <Input
                type="number"
                min="0"
                value={commercialBabies}
                onChange={(e) => setCommercialBabies(parseInt(e.target.value) || 0)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>Baby Name Updates Only</Label>
              <Input
                type="number"
                min="0"
                value={babyNameUpdates}
                onChange={(e) => setBabyNameUpdates(parseInt(e.target.value) || 0)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: `hsl(var(--foreground))` }}>AllKids MCD Applications</Label>
              <Input
                type="number"
                min="0"
                value={allkidsMcdApplications}
                onChange={(e) => setAllkidsMcdApplications(parseInt(e.target.value) || 0)}
                disabled={isLocked}
                style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label style={{ color: `hsl(var(--foreground))` }}>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              disabled={isLocked}
              className="h-24"
              style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t" style={{ borderColor: `hsl(var(--border))` }}>
            <Button
              onClick={handleSave}
              disabled={saving || isLocked}
              style={{ background: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))`, color: 'white' }}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Section */}
      {dashboardData && (
        <>
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow" style={{ background: `linear-gradient(to bottom right, hsl(var(--success)), hsl(var(--primary)))` }}>
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: `hsl(var(--foreground))` }}>Dashboard</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border px-2 py-1" style={{ borderColor: `hsl(var(--border))` }}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange("prev")}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium w-28 text-center" style={{ color: `hsl(var(--foreground))` }}>
                  {format(dashboardMonth, "MMMM yyyy")}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange("next")}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={exportToExcel} className="flex items-center gap-2" style={{ borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}>
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
            </div>
          </div>

          {/* Current Month Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: `hsl(var(--muted-foreground))` }}>Total Babies (MTD)</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: `hsl(var(--primary))` }}>
                    {dashboardData.mtdTotals.totalBabies}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: `hsl(var(--muted-foreground))` }}>Change Forms</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: `hsl(var(--accent))` }}>
                    {dashboardData.mtdTotals.changeForms}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: `hsl(var(--muted-foreground))` }}>Mom MCD Apps</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: `hsl(var(--primary))` }}>
                    {dashboardData.mtdTotals.momMcdApplications}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: `hsl(var(--muted-foreground))` }}>Commercial Babies</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: `hsl(var(--success))` }}>
                    {dashboardData.mtdTotals.commercialBabies}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: `hsl(var(--muted-foreground))` }}>Name Updates</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: `hsl(var(--warning))` }}>
                    {dashboardData.mtdTotals.babyNameUpdates}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: `hsl(var(--muted-foreground))` }}>AllKids MCD</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: `hsl(var(--destructive))` }}>
                    {dashboardData.mtdTotals.allkidsMcdApplications}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Month-End Submission Section */}
          <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }} className={`border-2 ${isLastDayOfMonth ? "border-amber-400" : ""}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
                <ClipboardList className="w-5 h-5" />
                Month-End Submission Report
                {isLastDayOfMonth && (
                  <span className="ml-2 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Due Today</span>
                )}
                {monthEndRecord && (
                  <span className="ml-2 text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Submitted
                  </span>
                )}
              </CardTitle>
              <p className="text-sm" style={{ color: `hsl(var(--muted-foreground))` }}>
                Record the total Pending and Approved submissions for the end of {format(dashboardMonth, "MMMM yyyy")}.
                This section is only submitted once on the last day of the month.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: `hsl(var(--foreground))` }}>Pending Submissions</Label>
                  <Input
                    type="number"
                    min="0"
                    value={monthEndPending}
                    onChange={(e) => setMonthEndPending(parseInt(e.target.value) || 0)}
                    style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: `hsl(var(--foreground))` }}>Approved Submissions</Label>
                  <Input
                    type="number"
                    min="0"
                    value={monthEndApproved}
                    onChange={(e) => setMonthEndApproved(parseInt(e.target.value) || 0)}
                    style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: `hsl(var(--foreground))` }}>Notes (Optional)</Label>
                <Textarea
                  value={monthEndNotes}
                  onChange={(e) => setMonthEndNotes(e.target.value)}
                  placeholder="Add any notes about month-end submissions..."
                  className="h-20"
                  style={{ backgroundColor: `hsl(var(--background))`, borderColor: `hsl(var(--border))`, color: `hsl(var(--foreground))` }}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveMonthEnd}
                  disabled={savingMonthEnd}
                  style={{ background: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))`, color: 'white' }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingMonthEnd ? "Saving..." : monthEndRecord ? "Update Submission" : "Submit Month-End Report"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Approved vs Pending Chart */}
          {dashboardData?.monthEndChartData && (
            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
                  <BarChart3 className="w-5 h-5" />
                  Approved vs Pending Submissions (Month-End)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.monthEndChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Legend />
                    <Bar dataKey="approved" fill="hsl(var(--success))" name="Approved" />
                    <Bar dataKey="pending" fill="hsl(var(--warning))" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
                  <TrendingUp className="w-5 h-5" />
                  Total Babies Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.monthsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Line type="monotone" dataKey="totalBabies" stroke="hsl(var(--primary))" strokeWidth={2} name="Total Babies" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
                  <BarChart3 className="w-5 h-5" />
                  Applications by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.monthsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="changeForms" fill="hsl(var(--accent))" name="Change Forms" />
                    <Bar dataKey="momMcdApplications" fill="hsl(var(--primary))" name="Mom MCD Apps" />
                    <Bar dataKey="allkidsMcdApplications" fill="hsl(var(--destructive))" name="AllKids MCD" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
                  <BarChart3 className="w-5 h-5" />
                  Commercial vs Name Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.monthsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="commercialBabies" fill="hsl(var(--success))" name="Commercial Babies" />
                    <Bar dataKey="babyNameUpdates" fill="hsl(var(--warning))" name="Name Updates" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: `hsl(var(--card-foreground))` }}>
                  <TrendingUp className="w-5 h-5" />
                  All Categories Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.monthsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="totalBabies" stroke="hsl(var(--primary))" name="Total Babies" />
                    <Line type="monotone" dataKey="changeForms" stroke="hsl(var(--accent))" name="Change Forms" />
                    <Line type="monotone" dataKey="momMcdApplications" stroke="#8b5cf6" name="Mom MCD Apps" />
                    <Line type="monotone" dataKey="commercialBabies" stroke="hsl(var(--success))" name="Commercial" />
                    <Line type="monotone" dataKey="babyNameUpdates" stroke="hsl(var(--warning))" name="Name Updates" />
                    <Line type="monotone" dataKey="allkidsMcdApplications" stroke="hsl(var(--destructive))" name="AllKids" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}