import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, Filter } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "../components/utils/dateUtils";

export default function Logs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [filterUser, setFilterUser] = useState("all");
  const [filterPayer, setFilterPayer] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterLocation, setFilterLocation] = useState("all"); // Changed initial state to "all" for dropdown

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Conditionally fetch users to prevent permission errors for staff
      if (user && (user.app_role === "manager" || user.app_role === "admin")) {
        const allUsers = await base44.entities.User.list();
        setUsers(allUsers);
      } else if (user) {
        setUsers([user]);
      }

      // Load all logs regardless of role for debugging
      const allLogs = await base44.entities.DailyLog.list("-date");
      console.log("All logs loaded in Logs page:", allLogs.length, allLogs);
      setLogs(allLogs);

      const allBreakdowns = await base44.entities.PayerBreakdown.list();
      console.log("All breakdowns loaded:", allBreakdowns.length);
      setBreakdowns(allBreakdowns);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const getFilteredData = () => {
    let filtered = [...logs];

    if (filterUser !== "all") {
      filtered = filtered.filter(log => log.user_id === filterUser);
    }

    // Fix: Compare date strings directly to avoid timezone issues with new Date() for "YYYY-MM-DD" inputs
    if (filterStartDate) {
      filtered = filtered.filter(log => log.date >= filterStartDate);
    }

    // Fix: Compare date strings directly to avoid timezone issues with new Date() for "YYYY-MM-DD" inputs
    if (filterEndDate) {
      filtered = filtered.filter(log => log.date <= filterEndDate);
    }

    if (filterLocation !== "all") {
      filtered = filtered.filter(log =>
        log.location?.toLowerCase() === filterLocation.toLowerCase()
      );
    }

    return filtered.map(log => {
      const logBreakdowns = breakdowns.filter(bd => bd.daily_log_id === log.id);

      let totalSeen = 0;
      let totalPaid = 0;
      let totalCollected = 0;
      const payerDetails = {};

      logBreakdowns.forEach(bd => {
        if (filterPayer === "all" || bd.payer_type === filterPayer) {
          const seen = (bd.new_patients || 0) + (bd.patients_called || 0) + (bd.room_visits || 0) + (bd.walk_ins || 0);
          totalSeen += seen;
          totalPaid += bd.pos_collections_count || 0;
          totalCollected += bd.pos_amount || 0;
          payerDetails[bd.payer_type] = seen;
        }
      });

      if (filterPayer !== "all" && totalSeen === 0) {
        return null;
      }

      return {
        ...log,
        totalSeen,
        totalPaid,
        totalCollected,
        conversionRate: totalSeen > 0 ? (totalPaid / totalSeen) * 100 : 0,
        payerDetails
      };
    }).filter(Boolean);
  };

  const exportToCSV = () => {
    const filteredData = getFilteredData();

    const headers = [
      "Date",
      "User",
      "Location",
      "Status",
      "Total Seen",
      "Total Paid",
      "Conversion Rate",
      "Amount Collected",
      "Commercial",
      "Medicare",
      "Self Pay"
    ];

    const rows = filteredData.map(log => [
      format(parseLocalDate(log.date), "M/d/yyyy"),
      log.user_name,
      log.location || "",
      log.status,
      log.totalSeen,
      log.totalPaid,
      `${log.conversionRate.toFixed(1)}%`,
      `$${log.totalCollected.toFixed(2)}`,
      log.payerDetails.Commercial || 0,
      log.payerDetails.Medicare || 0,
      log.payerDetails.SelfPay || 0
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FC_Productivity_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = getFilteredData();

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Activity Logs</h1>
            <p className="text-slate-600 mt-1">Detailed view of all productivity entries</p>
          </div>
          <Button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              {currentUser?.app_role !== "staff" && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">User</Label>
                  <Select value={filterUser} onValueChange={setFilterUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Payer Type</Label>
                <Select value={filterPayer} onValueChange={setFilterPayer}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Payers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payers</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Medicare">Medicare</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="SelfPay">Self Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Start Date</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">End Date</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>

              {/* Changed Location filter from Input to Select */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Location</Label>
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="RMC">RMC</SelectItem>
                    <SelectItem value="NMC">NMC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Logs ({filteredData.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Location</TableHead> {/* Changed header text */}
                    <TableHead className="text-right">Total Seen</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">
                        {format(parseLocalDate(log.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{log.user_name}</TableCell>
                      <TableCell className="text-slate-600">
                        {log.location || "-"} {/* Changed from location_shift to location */}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {log.totalSeen}
                      </TableCell>
                      <TableCell className="text-right">{log.totalPaid}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium">
                        {log.conversionRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${log.totalCollected.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.status === "submitted"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {log.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                        No logs found matching your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}