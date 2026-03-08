import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  Lock, 
  Unlock, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Pencil,
  Download,
  Trash2
} from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import DailyReportGenerator from "../components/reports/DailyReportGenerator";

export default function TeamMembers() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [lockStartDate, setLockStartDate] = useState("");
  const [lockEndDate, setLockEndDate] = useState("");
  const [locking, setLocking] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const allUsers = await base44.entities.User.list();
      setUsers(allUsers);

      const thisWeekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
      const thisWeekEnd = format(endOfWeek(new Date()), "yyyy-MM-dd");
      setLockStartDate(thisWeekStart);
      setLockEndDate(thisWeekEnd);
      setExportStartDate(thisWeekStart);
      setExportEndDate(thisWeekEnd);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const lockPeriod = async () => {
    if (!lockStartDate || !lockEndDate) {
      setMessage({ type: "error", text: "Please select both start and end dates" });
      return;
    }

    setLocking(true);
    try {
      const logsToLock = await base44.entities.DailyLog.list();
      const filteredLogs = logsToLock.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= new Date(lockStartDate) && logDate <= new Date(lockEndDate);
      });

      for (const log of filteredLogs) {
        await base44.entities.DailyLog.update(log.id, { is_locked: true });
        await base44.entities.AuditLog.create({
          user_id: currentUser.id,
          user_name: currentUser.display_name || currentUser.full_name,
          action: "lock",
          entity_type: "DailyLog",
          entity_id: log.id,
          notes: `Locked period from ${lockStartDate} to ${lockEndDate}`
        });
      }

      setMessage({ 
        type: "success", 
        text: `Successfully locked ${filteredLogs.length} logs from ${format(new Date(lockStartDate), "MMM dd")} to ${format(new Date(lockEndDate), "MMM dd")}` 
      });
    } catch (error) {
      console.error("Error locking period:", error);
      setMessage({ type: "error", text: "Error locking period. Please try again." });
    }
    setLocking(false);
  };

  const unlockPeriod = async () => {
    if (!lockStartDate || !lockEndDate) {
      setMessage({ type: "error", text: "Please select both start and end dates" });
      return;
    }

    setLocking(true);
    try {
      const logsToUnlock = await base44.entities.DailyLog.list();
      const filteredLogs = logsToUnlock.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= new Date(lockStartDate) && logDate <= new Date(lockEndDate);
      });

      for (const log of filteredLogs) {
        await base44.entities.DailyLog.update(log.id, { is_locked: false });
        await base44.entities.AuditLog.create({
          user_id: currentUser.id,
          user_name: currentUser.display_name || currentUser.full_name,
          action: "unlock",
          entity_type: "DailyLog",
          entity_id: log.id,
          notes: `Unlocked period from ${lockStartDate} to ${lockEndDate}`
        });
      }

      setMessage({ 
        type: "success", 
        text: `Successfully unlocked ${filteredLogs.length} logs from ${format(new Date(lockStartDate), "MMM dd")} to ${format(new Date(lockEndDate), "MMM dd")}` 
      });
    } catch (error) {
      console.error("Error unlocking period:", error);
      setMessage({ type: "error", text: "Error unlocking period. Please try again." });
    }
    setLocking(false);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditName(user.display_name || user.full_name);
    setEditRole(user.app_role || "staff");
    setEditActive(user.active_flag !== false);
    setShowEditDialog(true);
  };

  const saveUserChanges = async () => {
    if (!editName.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty" });
      return;
    }

    setSaving(true);
    try {
      await base44.entities.User.update(editingUser.id, { 
        display_name: editName,
        app_role: editRole,
        active_flag: editActive
      });
      
      await base44.entities.AuditLog.create({
        user_id: currentUser.id,
        user_name: currentUser.display_name || currentUser.full_name,
        action: "update",
        entity_type: "User",
        entity_id: editingUser.id,
        before_data: { 
          display_name: editingUser.display_name || editingUser.full_name,
          app_role: editingUser.app_role,
          active_flag: editingUser.active_flag
        },
        after_data: { 
          display_name: editName,
          app_role: editRole,
          active_flag: editActive
        },
        notes: `Updated user: name from "${editingUser.display_name || editingUser.full_name}" to "${editName}", role from "${editingUser.app_role || 'staff'}" to "${editRole}", active status from "${editingUser.active_flag !== false ? 'Active' : 'Inactive'}" to "${editActive ? 'Active' : 'Inactive'}"`
      });

      setMessage({ 
        type: "success", 
        text: `Successfully updated ${editName}'s information` 
      });
      
      setShowEditDialog(false);
      await loadData();
    } catch (error) {
      console.error("Error updating user:", error);
      setMessage({ type: "error", text: "Error updating user. Please try again." });
    }
    setSaving(false);
  };

  const deleteUser = async (user) => {
    if (!confirm(`Are you sure you want to permanently delete ${user.display_name || user.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await base44.entities.AuditLog.create({
        user_id: currentUser.id,
        user_name: currentUser.display_name || currentUser.full_name,
        action: "delete",
        entity_type: "User",
        entity_id: user.id,
        before_data: { 
          display_name: user.display_name || user.full_name,
          email: user.email,
          app_role: user.app_role,
          active_flag: user.active_flag
        },
        notes: `Deleted user: ${user.display_name || user.full_name} (${user.email})`
      });

      await base44.entities.User.delete(user.id);

      setMessage({ 
        type: "success", 
        text: `Successfully deleted ${user.display_name || user.full_name}` 
      });
      
      await loadData();
    } catch (error) {
      console.error("Error deleting user:", error);
      setMessage({ type: "error", text: "Error deleting user. Please try again." });
    }
  };

  const exportCollectionsByDate = async () => {
    if (!exportStartDate || !exportEndDate) {
      setMessage({ type: "error", text: "Please select both start and end dates for export" });
      return;
    }

    setExporting(true);
    try {
      const allLogs = await base44.entities.DailyLog.list("-date");
      const submittedLogs = allLogs.filter(log => log.status === "submitted");
      const breakdowns = await base44.entities.PayerBreakdown.list();

      // Filter logs by date range
      const filteredLogs = submittedLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= new Date(exportStartDate) && logDate <= new Date(exportEndDate);
      });

      // Get unique dates and users
      const dates = [...new Set(filteredLogs.map(log => log.date))].sort();
      const userMap = {};
      filteredLogs.forEach(log => {
        if (!userMap[log.user_id]) {
          userMap[log.user_id] = log.user_name || "Unknown";
        }
      });
      const userIds = Object.keys(userMap);

      // Build data matrix: date x user -> collection amount
      const dataMatrix = {};
      const userTotals = {};
      userIds.forEach(uid => { userTotals[uid] = 0; });

      filteredLogs.forEach(log => {
        const logBreakdowns = breakdowns.filter(bd => bd.daily_log_id === log.id);
        let dayTotal = 0;
        logBreakdowns.forEach(bd => { dayTotal += bd.pos_amount || 0; });

        if (!dataMatrix[log.date]) dataMatrix[log.date] = {};
        dataMatrix[log.date][log.user_id] = (dataMatrix[log.date][log.user_id] || 0) + dayTotal;
        userTotals[log.user_id] += dayTotal;
      });

      // Build CSV
      const headers = ["Date", ...userIds.map(uid => userMap[uid]), "Daily Total"];
      const rows = dates.map(date => {
        let dailyTotal = 0;
        const row = [format(new Date(date), "M/d/yyyy")];
        userIds.forEach(uid => {
          const val = dataMatrix[date]?.[uid] || 0;
          row.push(val.toFixed(2));
          dailyTotal += val;
        });
        row.push(dailyTotal.toFixed(2));
        return row;
      });

      // Add totals row
      let grandTotal = 0;
      const totalsRow = ["TOTAL"];
      userIds.forEach(uid => {
        totalsRow.push(userTotals[uid].toFixed(2));
        grandTotal += userTotals[uid];
      });
      totalsRow.push(grandTotal.toFixed(2));
      rows.push(totalsRow);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Collections_by_Date_${format(new Date(exportStartDate), "yyyyMMdd")}_${format(new Date(exportEndDate), "yyyyMMdd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: "success", text: "Export downloaded successfully" });
    } catch (error) {
      console.error("Error exporting:", error);
      setMessage({ type: "error", text: "Error exporting data. Please try again." });
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (currentUser?.app_role === "staff") {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You don't have permission to access this page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Members</h1>
          <p className="text-slate-600 mt-1">Manage team and lock periods</p>
        </div>

        {message && (
          <Alert className={message.type === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}>
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === "success" ? "text-emerald-800" : "text-red-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {currentUser?.app_role !== "staff" && <DailyReportGenerator />}

        <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Collections by Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Download a report showing collections by date with totals for each user.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Start Date</Label>
                <Input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">End Date</Label>
                <Input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={exportCollectionsByDate}
              disabled={exporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Exporting..." : "Download Collections Report"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Period Locking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Lock past periods to prevent staff from editing their logs. Managers can still edit with audit logging.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Start Date</Label>
                <Input
                  type="date"
                  value={lockStartDate}
                  onChange={(e) => setLockStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">End Date</Label>
                <Input
                  type="date"
                  value={lockEndDate}
                  onChange={(e) => setLockEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={lockPeriod}
                disabled={locking}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800"
              >
                <Lock className="w-4 h-4" />
                {locking ? "Locking..." : "Lock Period"}
              </Button>
              <Button
                onClick={unlockPeriod}
                disabled={locking}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                {locking ? "Unlocking..." : "Unlock Period"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.display_name || user.full_name}</TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        user.app_role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : user.app_role === "manager"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                      }`}>
                        {user.app_role || "staff"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.active_flag !== false 
                          ? "bg-emerald-100 text-emerald-800" 
                          : "bg-slate-100 text-slate-800"
                      }`}>
                        {user.active_flag !== false ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteUser(user)}
                          className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Display Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-active">Status</Label>
                <Select value={editActive ? "active" : "inactive"} onValueChange={(v) => setEditActive(v === "active")}>
                  <SelectTrigger id="edit-active">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser && (
                <div className="text-sm text-slate-600 pt-2 border-t">
                  <p>Email: {editingUser.email}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={saveUserChanges}
                disabled={saving}
                className="bg-blue-900 hover:bg-blue-800"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}