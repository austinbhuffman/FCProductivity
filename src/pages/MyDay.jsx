import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Send,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  DollarSign,
  Save,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import PayerSection from "../components/forms/PayerSection";
import WalkInCallInSection from "../components/forms/WalkInCallInSection";

const PAYER_TYPES = ["Commercial", "Medicare", "SelfPay"];

export default function MyDay() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [todayLog, setTodayLog] = useState(null);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [payerData, setPayerData] = useState({});
  const [walkInData, setWalkInData] = useState({});
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [date]);

  // Memoized autoSave function using useCallback to prevent unnecessary re-renders in useEffect
  const autoSave = useCallback(async () => {
    // Don't auto-save if no user, no location, or the log is locked OR already submitted
    if (!user || !user.id || !location) {
      console.log("Auto-save skipped: missing user or location");
      return;
    }
    if (todayLog?.is_locked) {
      console.log("Auto-save skipped: log is locked");
      return;
    }
    if (todayLog?.status === "submitted") {
      console.log("Auto-save skipped: log is already submitted");
      return;
    }

    console.log("Auto-saving...");
    setAutoSaving(true);
    setAutoSaveMessage("");
    setErrors({});

    try {
      let logId = todayLog?.id;
      const logData = {
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        date: date,
        location: location,
        notes: notes,
        status: "draft"
      };

      if (todayLog) {
        await base44.entities.DailyLog.update(todayLog.id, logData);
        console.log("Auto-save: Updated existing log", todayLog.id);
      } else {
        const newLog = await base44.entities.DailyLog.create(logData);
        logId = newLog.id;
        setTodayLog(newLog);
        console.log("Auto-save: Created new log", logId);
      }

      // Delete existing breakdowns - with improved error handling
      try {
        const existingBreakdowns = await base44.entities.PayerBreakdown.filter({ daily_log_id: logId });
        for (const bd of existingBreakdowns) {
          try {
            await base44.entities.PayerBreakdown.delete(bd.id);
          } catch (delError) {
            // Silently ignore "not found" errors as they're expected in some cases
            if (!delError.message?.includes("not found")) {
              console.log("Could not delete breakdown:", bd.id, delError.message);
            }
          }
        }
      } catch (filterError) {
        console.log("Could not filter breakdowns:", filterError);
      }

      // Save payer breakdowns
      for (const payerType of PAYER_TYPES) {
        const data = payerData[payerType];

        if (data && Object.keys(data).length > 0) {
          const breakdownData = {
            daily_log_id: logId,
            payer_type: payerType,
            new_patients: data.new_patients || 0,
            patients_called: data.patients_called || 0,
            room_visits: data.room_visits || 0,
            patients_not_seen: data.patients_not_seen || 0,
            pos_collections_count: data.pos_collections_count || 0,
            pos_amount: data.pos_amount || 0,
            pos_potential: data.pos_potential || 0
          };

          if (payerType !== "SelfPay") {
            breakdownData.single_coverage = data.single_coverage || 0;
            breakdownData.dual_coverage = data.dual_coverage || 0;
            breakdownData.insurance_updates = data.insurance_updates || 0;
          }

          if (payerType === "Medicare") {
            breakdownData.qmb_screening = data.qmb_screening || 0;
            breakdownData.qmb_enrollments = data.qmb_enrollments || 0;
            breakdownData.qmb_paperwork = data.qmb_paperwork || 0;
          }

          if (payerType === "SelfPay") {
            breakdownData.sp_converted_to_insurance = data.sp_converted_to_insurance || 0;
            breakdownData.inpatient_financial_assistance = data.inpatient_financial_assistance || 0;
            breakdownData.walkin_callin_financial_assistance = data.walkin_callin_financial_assistance || 0;
          }

          try {
            await base44.entities.PayerBreakdown.create(breakdownData);
            console.log("Auto-save: Created breakdown for", payerType);
          } catch (createError) {
            console.error("Error creating breakdown for", payerType, createError);
          }
        }
      }

      // Save walk-in data
      try {
        const existingWalkIn = await base44.entities.WalkInCallIn.filter({ daily_log_id: logId });
        for (const wi of existingWalkIn) {
          try {
            await base44.entities.WalkInCallIn.delete(wi.id);
          } catch (delError) {
            if (!delError.message?.includes("not found")) {
              console.log("Could not delete walk-in:", wi.id, delError.message);
            }
          }
        }

        if (walkInData && Object.keys(walkInData).length > 0) {
          await base44.entities.WalkInCallIn.create({
            daily_log_id: logId,
            walk_ins: walkInData.walk_ins || 0,
            pos_collections_count: walkInData.pos_collections_count || 0,
            pos_amount: walkInData.pos_amount || 0
          });
          console.log("Auto-save: Created walk-in record");
        }
      } catch (walkInError) {
        console.log("Could not save walk-in data:", walkInError);
      }

      setAutoSaveMessage("Draft saved");
      setTimeout(() => setAutoSaveMessage(""), 3000);
      console.log("Auto-save completed successfully");
    } catch (error) {
      console.error("Error auto-saving:", error);
      setAutoSaveMessage("Error saving");
      setTimeout(() => setAutoSaveMessage(""), 3000);
    } finally {
      setAutoSaving(false);
    }
  }, [user, date, location, notes, payerData, walkInData, todayLog]);


  // Auto-save functionality with debounce
  useEffect(() => {
    if (loading) return;
    if (!user || !location) return;
    if (todayLog?.is_locked) return;
    if (todayLog?.status === "submitted") return;

    console.log("Setting up auto-save timeout...");
    const timeoutId = setTimeout(() => {
      console.log("Triggering auto-save...");
      autoSave();
    }, 2000);

    return () => {
      console.log("Clearing auto-save timeout");
      clearTimeout(timeoutId);
    };
  }, [user, location, notes, payerData, walkInData, loading, todayLog?.is_locked, todayLog?.status, autoSave]);


  const loadData = async (specificLocation = null) => {
    setLoading(true);
    setAutoSaveMessage("");
    setSuccessMessage("");
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser) {
        console.warn("No user found. Cannot load daily log.");
        setTodayLog(null);
        setLocation("");
        setNotes("");
        setPayerData({});
        setLoading(false);
        return;
      }

      // Load all users if admin
      if (currentUser.app_role === "admin") {
        const users = await base44.entities.User.list();
        setAllUsers(users);
        if (!selectedUserId) {
          setSelectedUserId(currentUser.id);
        }
      } else {
        setSelectedUserId(currentUser.id);
      }

      const targetUserId = selectedUserId || currentUser.id;

      // Get all logs for this user and date (may be multiple if they worked at different locations)
      // Exclude VIM entries from personal daily logs
      const allLogsForDate = (await base44.entities.DailyLog.filter({ user_id: targetUserId, date: date }))
        .filter(log => !log.is_vim_entry);
      console.log("Logs found for user on date:", date, allLogsForDate);

      // Use specific location if provided, otherwise use state
      const locationToCheck = specificLocation !== null ? specificLocation : location;

      // Find log matching current location selection, or the first log if no location selected yet
      let matchingLog = null;
      if (locationToCheck) {
        matchingLog = allLogsForDate.find(log => log.location === locationToCheck);
      } else if (allLogsForDate.length > 0) {
        matchingLog = allLogsForDate[0];
      }

      if (matchingLog) {
        setTodayLog(matchingLog);
        setLocation(matchingLog.location || "");
        setNotes(matchingLog.notes || "");

        const breakdowns = await base44.entities.PayerBreakdown.filter({ daily_log_id: matchingLog.id });
        console.log("Breakdowns found:", breakdowns);
        const payerMap = {};
        breakdowns.forEach(bd => {
          payerMap[bd.payer_type] = bd;
        });
        setPayerData(payerMap);

        const walkInRecords = await base44.entities.WalkInCallIn.filter({ daily_log_id: matchingLog.id });
        if (walkInRecords.length > 0) {
          setWalkInData(walkInRecords[0]);
        } else {
          setWalkInData({});
        }
      } else {
        // Auto-assign location for specific users
        const targetUser = allUsers.find(u => u.id === targetUserId) || currentUser;
        const rmcUsers = ["Amber.Wilson", "Melissa.Weaver", "Austin.Huffman"];
        const userEmail = targetUser.email.split("@")[0];

        if (rmcUsers.includes(userEmail) && !specificLocation) {
          console.log("Auto-assigning RMC location for user:", userEmail);
          setLocation("RMC");
        } else if (specificLocation) {
          setLocation(specificLocation);
        } else {
          setLocation("");
        }

        setTodayLog(null);
        setNotes("");
        setPayerData({});
        setWalkInData({});
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const handlePayerChange = (payerType, data) => {
    setPayerData(prev => ({
      ...prev,
      [payerType]: data
    }));
    setErrors(prev => ({
      ...prev,
      [payerType]: []
    }));
  };

  const validateData = () => {
    const newErrors = {};
    let isValid = true;

    if (!location) {
      newErrors.location = ["Please select a location."];
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const saveLog = async (status) => {
    if (!validateData()) {
      return;
    }

    if (!user || !user.id) {
      alert("You must be logged in to save a log.");
      return;
    }

    setSaving(true);
    setSuccessMessage("");
    setErrors({});
    const isNewDraft = !todayLog?.id && status === "draft";

    try {
      let logId = todayLog?.id;
      const targetUser = allUsers.find(u => u.id === selectedUserId) || user;
      const logData = {
        user_id: targetUser.id,
        user_name: targetUser.display_name || targetUser.full_name,
        date: date,
        location: location,
        notes: notes,
        status: status
      };

      console.log("=== STARTING SAVE PROCESS ===");
      console.log("Saving log with status:", status);
      console.log("Log data:", logData);

      // Create or update the log
      let savedLog;
      if (todayLog) {
        if (todayLog.is_locked) {
          alert("This log is locked and cannot be edited.");
          setSaving(false);
          return;
        }
        savedLog = await base44.entities.DailyLog.update(todayLog.id, logData);
        logId = todayLog.id;
        console.log("✓ Log updated successfully with ID:", logId);
      } else {
        savedLog = await base44.entities.DailyLog.create(logData);
        logId = savedLog.id;
        setTodayLog(savedLog);
        console.log("✓ New log created with ID:", logId);
      }

      console.log("Saved log object:", savedLog);
      console.log("Saved log status:", savedLog.status);

      // Delete existing breakdowns with improved error handling
      console.log("Deleting existing breakdowns for log:", logId);
      try {
        const existingBreakdowns = await base44.entities.PayerBreakdown.filter({ daily_log_id: logId });
        console.log("Found", existingBreakdowns.length, "existing breakdowns");
        
        for (const bd of existingBreakdowns) {
          try {
            await base44.entities.PayerBreakdown.delete(bd.id);
            console.log("✓ Deleted breakdown:", bd.id);
          } catch (delError) {
            // Silently ignore "not found" errors - they may have been deleted by auto-save
            const errorMsg = delError.message || String(delError);
            if (errorMsg.includes("not found")) {
              console.log("ℹ Breakdown already deleted:", bd.id);
            } else {
              console.error("✗ Failed to delete breakdown:", bd.id, errorMsg);
            }
          }
        }
      } catch (filterError) {
        console.error("Error fetching breakdowns:", filterError);
      }

      // Save payer breakdowns
      console.log("Creating new breakdowns...");
      let breakdownsCreated = 0;
      
      for (const payerType of PAYER_TYPES) {
        const data = payerData[payerType];
        console.log(`Processing ${payerType}:`, data);

        if (data && Object.keys(data).length > 0) {
          const breakdownData = {
            daily_log_id: logId,
            payer_type: payerType,
            new_patients: data.new_patients || 0,
            patients_called: data.patients_called || 0,
            room_visits: data.room_visits || 0,
            patients_not_seen: data.patients_not_seen || 0,
            pos_collections_count: data.pos_collections_count || 0,
            pos_amount: data.pos_amount || 0,
            pos_potential: data.pos_potential || 0
          };

          if (payerType !== "SelfPay") {
            breakdownData.single_coverage = data.single_coverage || 0;
            breakdownData.dual_coverage = data.dual_coverage || 0;
            breakdownData.insurance_updates = data.insurance_updates || 0;
          }

          if (payerType === "Medicare") {
            breakdownData.qmb_screening = data.qmb_screening || 0;
            breakdownData.qmb_enrollments = data.qmb_enrollments || 0;
            breakdownData.qmb_paperwork = data.qmb_paperwork || 0;
          }

          if (payerType === "SelfPay") {
            breakdownData.sp_converted_to_insurance = data.sp_converted_to_insurance || 0;
            breakdownData.inpatient_financial_assistance = data.inpatient_financial_assistance || 0;
            breakdownData.walkin_callin_financial_assistance = data.walkin_callin_financial_assistance || 0;
          }

          console.log(`Creating breakdown for ${payerType}:`, breakdownData);
          
          const created = await base44.entities.PayerBreakdown.create(breakdownData);
          console.log(`✓ Breakdown created for ${payerType} with ID:`, created.id);
          breakdownsCreated++;
        } else {
          console.log(`Skipping ${payerType} - no data`);
        }
      }

      console.log(`=== SAVE COMPLETE: Created ${breakdownsCreated} breakdowns ===`);

      // Save walk-in data
      console.log("Saving walk-in data...");
      try {
        const existingWalkIn = await base44.entities.WalkInCallIn.filter({ daily_log_id: logId });
        for (const wi of existingWalkIn) {
          try {
            await base44.entities.WalkInCallIn.delete(wi.id);
            console.log("✓ Deleted walk-in record:", wi.id);
          } catch (delError) {
            const errorMsg = delError.message || String(delError);
            if (errorMsg.includes("not found")) {
              console.log("ℹ Walk-in record already deleted:", wi.id);
            } else {
              console.error("✗ Failed to delete walk-in:", wi.id, errorMsg);
            }
          }
        }

        if (walkInData && Object.keys(walkInData).length > 0) {
          const created = await base44.entities.WalkInCallIn.create({
            daily_log_id: logId,
            walk_ins: walkInData.walk_ins || 0,
            pos_collections_count: walkInData.pos_collections_count || 0,
            pos_amount: walkInData.pos_amount || 0
          });
          console.log("✓ Walk-in record created with ID:", created.id);
        }
      } catch (walkInError) {
        console.error("Error saving walk-in data:", walkInError);
      }

      // Verify the log was saved correctly
      const verifyLog = await base44.entities.DailyLog.filter({ 
        user_id: user.id, 
        date: date 
      });
      console.log("Verification - logs found for this date:", verifyLog.length);
      if (verifyLog.length > 0) {
        console.log("Verification - log status:", verifyLog[0].status);
        console.log("Verification - log ID:", verifyLog[0].id);
      }

      // Format date for display - parse as local date to avoid timezone issues for success messages
      const [year, month, day] = date.split('-').map(Number);
      const localDateForMessage = new Date(year, month - 1, day);

      // Create notification reminder for new drafts
      if (isNewDraft && logId) {
        try {
          await base44.entities.Notification.create({
            user_id: targetUser.id,
            title: "Reminder: Submit Your Daily Log",
            message: `You started a daily log for ${format(localDateForMessage, "MMM d, yyyy")}. Don't forget to submit it!`,
            type: "reminder",
            related_log_id: logId,
            action_url: "/MyDay"
          });
        } catch (notifError) {
          console.error("Error creating notification:", notifError);
        }
      }

      // Set success message and redirect if submitted
              if (status === "submitted") {
                setSuccessMessage(`✓ Log for ${format(localDateForMessage, "MMM dd, yyyy")} submitted successfully! It will now appear on the dashboard.`);
                // Redirect to Team Dashboard
                navigate(createPageUrl("Dashboard"));
                return;
              } else {
                setSuccessMessage("✓ Draft saved successfully!");
              }

              // Reload data to ensure UI is in sync
              await loadData();
      
      console.log("=== SAVE PROCESS COMPLETED SUCCESSFULLY ===");
    } catch (error) {
      console.error("=== ERROR SAVING LOG ===");
      console.error("Error details:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      alert(`Error saving log: ${error.message || 'Unknown error occurred. Please check console and try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const createNewLogForDate = () => {
    setTodayLog(null);
    setNotes("");
    setPayerData({});
    setWalkInData({});
    setSuccessMessage("");
    setAutoSaveMessage("");
  };

  const getTodayStats = () => {
    let totalNewPatients = 0;
    let totalPOS = 0;
    let totalAmount = 0;

    Object.values(payerData).forEach(data => {
      if (data) {
        totalNewPatients += data.new_patients || 0;
        totalPOS += data.pos_collections_count || 0;
        totalAmount += data.pos_amount || 0;
      }
    });

    return { totalNewPatients, totalPOS, totalAmount };
  };

  const stats = getTodayStats();

  const isEditable = user?.app_role === "admin" ? true : !todayLog?.is_locked;
  const isPastDate = date < format(new Date(), "yyyy-MM-dd");
  const isTodayOrFuture = date >= format(new Date(), "yyyy-MM-dd");

  if (loading) {
    return (
      <div className="p-8 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <Skeleton className="h-12 w-64 bg-slate-200" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-32 bg-slate-200" />
          <Skeleton className="h-32 bg-slate-200" />
          <Skeleton className="h-32 bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Please log in to view and manage your daily logs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Format date for display - parse as local date to avoid timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const displayDate = new Date(year, month - 1, day);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{user?.app_role === "admin" ? "Daily Log Entry" : "My Day"}</h1>
            <p className="text-slate-600 mt-1">Log your daily patient activity</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {autoSaving && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Save className="w-4 h-4 animate-pulse" />
                Saving...
              </div>
            )}
            {autoSaveMessage && !autoSaving && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                {autoSaveMessage}
              </div>
            )}
            {todayLog?.is_locked && (
              <Alert className="max-w-sm border-amber-200 bg-amber-50 py-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  This period is locked
                </AlertDescription>
              </Alert>
            )}
             {todayLog?.status === "submitted" && (
              <Alert className="max-w-sm border-blue-200 bg-blue-50 py-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  This log has been submitted.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {successMessage && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {isPastDate && todayLog?.status === "submitted" && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You're viewing a submitted log from {format(displayDate, "MMMM dd, yyyy")}. This log cannot be edited.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                New Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{stats.totalNewPatients}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                POS Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{stats.totalPOS}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total POS Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">
                ${stats.totalAmount.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-slate-900">Entry Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {user?.app_role === "admin" && (
              <div className="space-y-2">
                <Label htmlFor="user-select" className="text-slate-700 font-medium">
                  User *
                </Label>
                <Select
                  value={selectedUserId || ""}
                  onValueChange={(value) => {
                    setSelectedUserId(value);
                    setTodayLog(null);
                    setLocation("");
                    setNotes("");
                    setPayerData({});
                    setSuccessMessage("");
                    loadData();
                  }}
                >
                  <SelectTrigger id="user-select">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name || u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-700 font-medium">
                  Date *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={user?.app_role === "admin" ? undefined : format(new Date(), "yyyy-MM-dd")}
                  className="text-base"
                />
                {todayLog && isPastDate && (
                  <p className="text-xs text-slate-600">
                    Viewing log from {format(displayDate, "MMMM dd, yyyy")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-slate-700 font-medium">
                  Location *
                </Label>
                <Select
                  value={location}
                  onValueChange={(newLocation) => {
                    setLocation(newLocation);
                    loadData(newLocation);
                  }}
                  disabled={!isEditable}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RMC">RMC</SelectItem>
                    <SelectItem value="NMC">NMC</SelectItem>
                  </SelectContent>
                </Select>
                {errors.location && (
                  <p className="text-sm text-red-600">{errors.location[0]}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-700 font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!isEditable}
                placeholder="Any additional notes about today... PLEASE DO NOT ENTER ANY PHI!"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <WalkInCallInSection
          data={walkInData}
          onChange={setWalkInData}
          isLocked={!isEditable}
        />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Payer Breakdown</h2>

          {PAYER_TYPES.map(payerType => (
            <PayerSection
              key={payerType}
              payerType={payerType}
              data={payerData[payerType] || {}}
              onChange={handlePayerChange}
              isLocked={!isEditable}
            />
          ))}
        </div>

        {isEditable && (
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => saveLog("submitted")}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
              {saving ? "Saving..." : todayLog?.status === "submitted" ? "Update Submitted Log" : `Submit Log for ${format(displayDate, "MMM dd")}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}