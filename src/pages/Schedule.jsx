import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Printer, Edit2, Save, X, Send } from "lucide-react";
import { format, addDays, startOfWeek, differenceInWeeks, isSameWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

const DEFAULT_ROTATION = ["Tracy", "Eileen", "Austin", "Melissa", "Unknown"];
const ROTATION_START_DATE = new Date(2026, 0, 5); // January 5, 2026

export default function Schedule() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [overrides, setOverrides] = useState([]);
  const [editingDay, setEditingDay] = useState(null);
  const [editEmployees, setEditEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const allUsers = await base44.entities.User.list();
      const activeUsers = allUsers.filter(u => u.active_flag !== false);
      setUsers(activeUsers);

      const allOverrides = await base44.entities.ScheduleOverride.list();
      setOverrides(allOverrides);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const getDefaultScheduleForDay = (day) => {
    const weekStart = startOfWeek(day, { weekStartsOn: 1 });
    const weeksFromStart = differenceInWeeks(weekStart, ROTATION_START_DATE);
    const rotationIndex = ((weeksFromStart % 5) + 5) % 5;
    const fridayOffEmployee = DEFAULT_ROTATION[rotationIndex];
    
    const dayOfWeek = day.getDay();
    const isFriday = dayOfWeek === 5;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    return DEFAULT_ROTATION.map(emp => {
      const isFridayOff = emp === fridayOffEmployee;
      const isOff = isFriday && isFridayOff;
      
      let shiftStart = "8:00 AM";
      let shiftEnd = "5:00 PM";
      
      // If this person has Friday off this week and it's Mon-Thu, they work 7am-5pm
      if (isFridayOff && !isFriday && isWeekday) {
        shiftStart = "7:00 AM";
        shiftEnd = "5:00 PM";
      }
      
      return {
        name: emp,
        isOff: !isWeekday || isOff,
        shiftStart: isWeekday && !isOff ? shiftStart : "",
        shiftEnd: isWeekday && !isOff ? shiftEnd : ""
      };
    });
  };

  const getDaySchedule = (day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayOverrides = overrides.filter(o => o.date === dateStr);
    
    if (dayOverrides.length > 0) {
      return DEFAULT_ROTATION.map(emp => {
        const override = dayOverrides.find(o => o.employee_name === emp);
        if (override) {
          return {
            name: emp,
            isOff: override.is_off,
            shiftStart: override.shift_start || "",
            shiftEnd: override.shift_end || "",
            hasOverride: true
          };
        }
        const defaultSched = getDefaultScheduleForDay(day).find(s => s.name === emp);
        return { ...defaultSched, hasOverride: false };
      });
    }
    
    return getDefaultScheduleForDay(day).map(s => ({ ...s, hasOverride: false }));
  };

  const handleEditDay = (day) => {
    if (currentUser?.app_role !== "admin") {
      setMessage({ type: "error", text: "Only admins can edit the schedule" });
      return;
    }
    const schedule = getDaySchedule(day);
    setEditingDay(day);
    setEditEmployees(schedule.map(s => ({
      name: s.name,
      isOff: s.isOff,
      shiftStart: s.shiftStart,
      shiftEnd: s.shiftEnd
    })));
  };

  const updateEmployee = (index, field, value) => {
    const updated = [...editEmployees];
    updated[index] = { ...updated[index], [field]: value };
    setEditEmployees(updated);
  };

  const saveScheduleChange = async () => {
    if (currentUser?.app_role !== "admin") {
      setMessage({ type: "error", text: "Only admins can edit the schedule" });
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(editingDay, "yyyy-MM-dd");
      
      // Get original schedule to compare
      const originalSchedule = getDaySchedule(editingDay);
      
      // Delete existing overrides for this date
      const existingOverrides = overrides.filter(o => o.date === dateStr);
      for (const override of existingOverrides) {
        await base44.entities.ScheduleOverride.delete(override.id);
      }
      
      // Create new overrides and track changes
      const changedEmployees = [];
      for (let i = 0; i < editEmployees.length; i++) {
        const emp = editEmployees[i];
        const original = originalSchedule[i];
        
        await base44.entities.ScheduleOverride.create({
          date: dateStr,
          employee_name: emp.name,
          is_off: emp.isOff,
          shift_start: emp.shiftStart,
          shift_end: emp.shiftEnd
        });
        
        // Check if schedule changed for this employee
        if (emp.isOff !== original.isOff || 
            emp.shiftStart !== original.shiftStart || 
            emp.shiftEnd !== original.shiftEnd) {
          changedEmployees.push(emp);
        }
      }

      // Send notifications only to affected employees
      const activeUsers = users.filter(u => u.active_flag !== false);
      for (const emp of changedEmployees) {
        const user = activeUsers.find(u => 
          (u.display_name || u.full_name) === emp.name
        );
        
        if (user?.email) {
          const scheduleInfo = emp.isOff ? "OFF" : `${emp.shiftStart} - ${emp.shiftEnd}`;
          
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: "Your Schedule Has Been Updated",
            body: `Hi ${user.display_name || user.full_name},\n\nYour schedule for ${format(editingDay, "EEEE, MMM d, yyyy")} has been updated:\n\n${scheduleInfo}\n\nYou can view the full schedule in the app.\n\nBest regards,\nFC Productivity Team`
          });
        }
      }

      const notificationMsg = changedEmployees.length > 0 
        ? `Schedule updated and ${changedEmployees.length} employee(s) notified!`
        : "Schedule updated!";
      
      setMessage({ type: "success", text: notificationMsg });
      setEditingDay(null);
      await loadData();
    } catch (error) {
      console.error("Error saving schedule:", error);
      setMessage({ type: "error", text: "Error updating schedule" });
    }
    setSaving(false);
  };

  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 34);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const exportToCSV = () => {
    const days = getCalendarDays().filter(d => d.getMonth() === currentMonth.getMonth());
    
    const headers = ["Date", "Day", ...DEFAULT_ROTATION];
    const rows = days.map(day => {
      const schedule = getDaySchedule(day);
      return [
        format(day, "MM/dd/yyyy"),
        format(day, "EEEE"),
        ...schedule.map(s => s.isOff ? "OFF" : `${s.shiftStart}-${s.shiftEnd}`)
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Schedule_${format(currentMonth, "yyyy_MM")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const calendarDays = getCalendarDays();
  const today = new Date();

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-schedule, #printable-schedule * {
            visibility: visible;
          }
          #printable-schedule {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {message && (
            <Alert className={message.type === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}>
              <AlertDescription className={message.type === "success" ? "text-emerald-800" : "text-red-800"}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Team Schedule</h1>
              <p className="text-slate-600 mt-1">Daily work schedules with rotating Friday off</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          <div id="printable-schedule">
            <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {format(currentMonth, "MMMM yyyy")}
                  </CardTitle>
                  <div className="flex gap-2 no-print">
                    <Button variant="outline" size="sm" onClick={prevMonth}>
                      ← Prev
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextMonth}>
                      Next →
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                    <div key={day} className="text-center font-semibold text-slate-700 py-2 border-b-2 border-slate-300">
                      {day}
                    </div>
                  ))}
                  
                  {calendarDays.map((day, index) => {
                    const schedule = getDaySchedule(day);
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isToday = isSameDay(day, today);
                    const hasOverride = schedule.some(s => s.hasOverride);

                    return (
                      <div
                        key={index}
                        className={`min-h-32 p-2 border rounded-lg ${
                          !isCurrentMonth
                            ? "bg-slate-50 text-slate-400"
                            : isToday
                            ? "bg-blue-100 border-blue-400"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-sm font-semibold ${isToday ? "text-blue-700" : ""}`}>
                            {format(day, "d")}
                          </span>
                          {hasOverride && isCurrentMonth && (
                            <div className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
                              Modified
                            </div>
                          )}
                        </div>
                        
                        {isCurrentMonth && (
                          <div className="space-y-1 text-xs">
                            {schedule.map((emp, idx) => (
                              <div key={idx} className={emp.isOff ? "text-slate-400" : ""}>
                                <div className="font-semibold truncate">{emp.name}</div>
                                {emp.isOff ? (
                                  <div className="text-red-600">OFF</div>
                                ) : emp.shiftStart ? (
                                  <div className="text-slate-600">{emp.shiftStart}-{emp.shiftEnd}</div>
                                ) : null}
                              </div>
                            ))}
                            
                            {currentUser?.app_role === "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-6 text-xs mt-2 no-print"
                                onClick={() => handleEditDay(day)}
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-3">Default Rotation:</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DEFAULT_ROTATION.map((employee, index) => (
                      <div key={employee} className="px-3 py-2 bg-white rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700">Week {index + 1}: </span>
                        <span className="text-slate-900">{employee}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>• Person with Friday off works 7:00 AM - 5:00 PM Monday-Thursday</p>
                    <p>• Everyone else works 8:00 AM - 5:00 PM Monday-Friday</p>
                    <p>• Rotation starts January 5, 2026 and repeats every 5 weeks</p>
                    <p>• Admins can modify any day's schedule as needed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={!!editingDay} onOpenChange={() => setEditingDay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Schedule - {editingDay && format(editingDay, "EEEE, MMMM d, yyyy")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {editEmployees.map((emp, index) => (
              <div key={index} className="p-3 border border-slate-200 rounded-lg space-y-3">
                <div className="font-semibold text-slate-900">{emp.name}</div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={emp.isOff}
                    onCheckedChange={(checked) => updateEmployee(index, "isOff", checked)}
                  />
                  <Label>Day Off</Label>
                </div>

                {!emp.isOff && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        value={emp.shiftStart}
                        onChange={(e) => updateEmployee(index, "shiftStart", e.target.value)}
                        placeholder="8:00 AM"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">End Time</Label>
                      <Input
                        value={emp.shiftEnd}
                        onChange={(e) => updateEmployee(index, "shiftEnd", e.target.value)}
                        placeholder="5:00 PM"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <Send className="w-4 h-4 inline mr-2" />
              Only employees with schedule changes will be notified via email.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingDay(null)}
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={saveScheduleChange}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}