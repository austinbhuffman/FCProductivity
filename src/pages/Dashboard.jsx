import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { DailyLog, PayerBreakdown, AppSettings } from "@/entities/all";
import { User } from "@/entities/User";
import Confetti from "../components/dashboard/Confetti";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Award,
  Settings,
  Download,
  Printer,
  Target
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import YTDToggle from "../components/dashboard/YTDToggle";
import MetricCard from "../components/dashboard/MetricCard";
import DailyLogTable from "../components/dashboard/DailyLogTable";
import PayerTrendsChart from "../components/dashboard/PayerTrendsChart";
import CollectionRateChart from "../components/dashboard/CollectionRateChart";
import MonthlyUserSummary from "../components/dashboard/MonthlyUserSummary";
import { getFiscalYearDates, calculatePeriodMetrics, parseLocalDate } from "../components/utils/dateUtils";

const PAYER_COLORS = {
  Commercial: "#3b82f6",
  Medicare: "#10b981",
  Other: "#f59e0b",
  SelfPay: "#8b5cf6",
  VIM: "#ec4899"
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState([]);
  const [allBreakdowns, setAllBreakdowns] = useState([]);
  const [allWalkIns, setAllWalkIns] = useState([]);
  const [allPaymentPlans, setAllPaymentPlans] = useState([]);
  const [allPaymentSchedules, setAllPaymentSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [viewMode, setViewMode] = useState("current");
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date()), "yyyy-MM-dd"));
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fiscalStartMonth, setFiscalStartMonth] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShownRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log("Window focused - refreshing dashboard data");
      loadData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user && (user.app_role === "manager" || user.app_role === "admin")) {
        const allUsers = await base44.entities.User.list();
        setUsers(allUsers);
      } else if (user) {
        setUsers([user]);
      }

      const settings = await base44.entities.AppSettings.list();
      if (settings.length > 0) {
        setFiscalStartMonth(settings[0].fiscal_year_start_month || 10);
      } else {
        await base44.entities.AppSettings.create({
          fiscal_year_start_month: 10,
          setting_name: "fiscal_settings"
        });
        setFiscalStartMonth(10);
      }

      const allLogsRaw = await base44.entities.DailyLog.list("-date");
      console.log("=== DASHBOARD DEBUG ===");
      console.log("Total logs loaded:", allLogsRaw.length);

      const submittedLogs = allLogsRaw.filter(log => {
        return log.status === "submitted";
      });
      console.log("Submitted logs after filter:", submittedLogs.length);

      setAllLogs(submittedLogs);

      const breakdowns = await base44.entities.PayerBreakdown.list();
      console.log("Total breakdowns loaded:", breakdowns.length);

      const walkInData = await base44.entities.WalkInCallIn.list();
      console.log("Total walk-in records loaded:", walkInData.length);

      const paymentPlans = await base44.entities.PaymentPlan.list();
      const paymentSchedules = await base44.entities.PaymentPlanSchedule.list();
      console.log("Total payment plans loaded:", paymentPlans.length);
      console.log("Total payment schedules loaded:", paymentSchedules.length);

      setAllPaymentPlans(paymentPlans);
      setAllPaymentSchedules(paymentSchedules);

        // Check if goal is hit and show confetti (only once per session)
        const mtdStart = startOfMonth(new Date());
        const mtdEnd = new Date();
        const mtdLogs = submittedLogs.filter(log => {
          const logDate = parseLocalDate(log.date);
          return logDate >= mtdStart && logDate <= mtdEnd;
        });
        const mtdBreakdowns = breakdowns.filter(bd => mtdLogs.map(l => l.id).includes(bd.daily_log_id));
        const mtdWalkIns = walkInData.filter(wi => mtdLogs.map(l => l.id).includes(wi.daily_log_id));

        let mtdTotal = 0;
        mtdBreakdowns.forEach(bd => { mtdTotal += bd.pos_amount || 0; });
        mtdWalkIns.forEach(wi => { mtdTotal += wi.pos_amount || 0; });

        // Add payment plan collections for MTD
        paymentSchedules.forEach(schedule => {
          if (schedule.status === "successful") {
            const scheduleDate = parseLocalDate(schedule.scheduled_date);
            if (scheduleDate >= mtdStart && scheduleDate <= mtdEnd) {
              mtdTotal += schedule.amount || 0;
            }
          }
        });

        if (mtdTotal >= 30000 && !confettiShownRef.current) {
          confettiShownRef.current = true;
          setShowConfetti(true);

          // Send notifications to all team members about goal achievement
          try {
            const allUsers = await base44.entities.User.list();
            const activeUsers = allUsers.filter(u => u.active_flag !== false);
            const monthYear = format(new Date(), "MMMM yyyy");

            for (const teamMember of activeUsers) {
              // Check if notification already sent this month
              const existingNotif = await base44.entities.Notification.filter({
                user_id: teamMember.id,
                title: `🎉 ${monthYear} Goal Achieved!`
              });

              if (existingNotif.length === 0) {
                await base44.entities.Notification.create({
                  user_id: teamMember.id,
                  title: `🎉 ${monthYear} Goal Achieved!`,
                  message: `Congratulations! The team has reached the $30,000 collection goal for ${monthYear}. Total collected: $${mtdTotal.toFixed(0)}`,
                  type: "success",
                  action_url: "/Dashboard"
                });
              }
            }
          } catch (notifError) {
            console.error("Error sending goal notifications:", notifError);
          }
        }
      
      const submittedLogIds = submittedLogs.map(log => log.id);

      const filteredBreakdowns = breakdowns.filter(bd => submittedLogIds.includes(bd.daily_log_id));
      console.log("Breakdowns for submitted logs:", filteredBreakdowns.length);

      const filteredWalkIns = walkInData.filter(wi => submittedLogIds.includes(wi.daily_log_id));
      console.log("Walk-ins for submitted logs:", filteredWalkIns.length);

      setAllBreakdowns(filteredBreakdowns);
      setAllWalkIns(filteredWalkIns);
      

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setLoading(false);
  };

  const saveFiscalSettings = async () => {
    try {
      const existingSettings = await AppSettings.list();
      if (existingSettings.length > 0) {
        await AppSettings.update(existingSettings[0].id, {
          fiscal_year_start_month: fiscalStartMonth,
          setting_name: "fiscal_settings"
        });
      } else {
        await AppSettings.create({
          fiscal_year_start_month: 10,
          setting_name: "fiscal_settings"
        });
      }
      setShowSettings(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMetrics = (logsToUse, breakdownsToUse, walkInsToUse) => {
              if (viewMode === "current") {
                // Include VIM entries in metrics (excludeVim = false)
                const metrics = calculatePeriodMetrics(breakdownsToUse, logsToUse, parseLocalDate(startDate), parseLocalDate(endDate), false, walkInsToUse);
                return metrics;
              } else {
            const { ytdStart, ytdEnd, pytdStart, pytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);

            const ytdMetrics = calculatePeriodMetrics(breakdownsToUse, logsToUse, ytdStart, ytdEnd, true, walkInsToUse);
            const pytdMetrics = calculatePeriodMetrics(breakdownsToUse, logsToUse, pytdStart, pytdEnd, true, walkInsToUse);

            return { ytd: ytdMetrics, pytd: pytdMetrics };
            }
            };

  const getCollectionPotentialData = (metrics) => {
    if (viewMode === "current") {
      return Object.entries(metrics.payerTotals || {}).map(([payer, data]) => ({
        name: payer === "SelfPay" ? "Self Pay" : payer,
        collected: data.collected || 0,
        newPatients: data.newPatients || 0
      }));
    } else {
      const payerNames = ["Commercial", "Medicare", "Other", "SelfPay"];
      return payerNames.map(payer => ({
        name: payer === "SelfPay" ? "Self Pay" : payer,
        ytdCollected: metrics.ytd?.payerTotals?.[payer]?.collected || 0,
        pytdCollected: metrics.pytd?.payerTotals?.[payer]?.collected || 0,
        ytdNewPatients: metrics.ytd?.payerTotals?.[payer]?.newPatients || 0,
        pytdNewPatients: metrics.pytd?.payerTotals?.[payer]?.newPatients || 0
      }));
    }
  };

  const getPayerMixData = (logsToUse, breakdownsToUse) => {
    // Calculate VIM separately
    const vimLogs = logsToUse.filter(log => {
      const logDate = parseLocalDate(log.date);
      if (viewMode === "current") {
        return log.is_vim_entry && logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
      } else {
        const { ytdStart, ytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);
        return log.is_vim_entry && logDate >= ytdStart && logDate <= ytdEnd;
      }
    });
    
    const vimBreakdowns = breakdownsToUse.filter(bd => 
      vimLogs.map(l => l.id).includes(bd.daily_log_id)
    );
    
    let vimNewPatients = 0;
    vimBreakdowns.forEach(bd => {
      vimNewPatients += bd.new_patients || 0;
    });
    
    // Calculate non-VIM metrics (excluding VIM entries)
    const nonVimLogs = logsToUse.filter(log => !log.is_vim_entry);
    const nonVimLogIds = nonVimLogs.map(l => l.id);
    const nonVimBreakdowns = breakdownsToUse.filter(bd => nonVimLogIds.includes(bd.daily_log_id));
    
    let filteredLogs;
    if (viewMode === "current") {
      filteredLogs = nonVimLogs.filter(log => {
        const logDate = parseLocalDate(log.date);
        return logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
      });
    } else {
      const { ytdStart, ytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);
      filteredLogs = nonVimLogs.filter(log => {
        const logDate = parseLocalDate(log.date);
        return logDate >= ytdStart && logDate <= ytdEnd;
      });
    }
    
    const nonVimMetrics = calculatePeriodMetrics(
      nonVimBreakdowns.filter(bd => filteredLogs.map(l => l.id).includes(bd.daily_log_id)),
      filteredLogs,
      viewMode === "current" ? parseLocalDate(startDate) : getFiscalYearDates(asOfDate, fiscalStartMonth).ytdStart,
      viewMode === "current" ? parseLocalDate(endDate) : getFiscalYearDates(asOfDate, fiscalStartMonth).ytdEnd,
      false
    );
    
    const data = Object.entries(nonVimMetrics.payerTotals || {}).map(([payer, payerData]) => ({
      name: payer === "SelfPay" ? "Self Pay" : payer,
      value: payerData.newPatients,
      color: PAYER_COLORS[payer]
    }));
    
    // Add VIM if it has data
    if (vimNewPatients > 0) {
      data.push({
        name: "VIM",
        value: vimNewPatients,
        color: PAYER_COLORS.VIM
      });
    }
    
    return data;
  };

  const getInsuranceSplitData = (metrics) => {
    if (viewMode === "current") {
      let singleTotal = 0;
      let multipleTotal = 0;

      Object.entries(metrics.payerTotals || {}).forEach(([payer, data]) => {
        if (payer !== "SelfPay") {
          singleTotal += data.single || 0;
          multipleTotal += data.multiple || 0;
        }
      });

      return [
        { name: "Single Insurance", value: singleTotal },
        { name: "Multiple Insurance", value: multipleTotal }
      ];
    } else {
      let ytdSingle = 0;
      let ytdMultiple = 0;
      let pytdSingle = 0;
      let pytdMultiple = 0;

      Object.entries(metrics.ytd.payerTotals || {}).forEach(([payer, data]) => {
        if (payer !== "SelfPay") {
          ytdSingle += data.single || 0;
          ytdMultiple += data.multiple || 0;
        }
      });

      Object.entries(metrics.pytd.payerTotals || {}).forEach(([payer, data]) => {
        if (payer !== "SelfPay") {
          pytdSingle += data.single || 0;
          pytdMultiple += data.multiple || 0;
        }
      });

      return [
        { name: "Single Insurance", YTD: ytdSingle, PYTD: pytdSingle },
        { name: "Multiple Insurance", YTD: ytdMultiple, PYTD: pytdMultiple }
      ];
    }
  };

  const getGoalPeriodMetrics = (logsToUse, breakdownsToUse, walkInsToUse) => {
    // Use the start date's month for the goal period
    const goalStart = startOfMonth(parseLocalDate(startDate));
    const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0); // End of that month

    // Include VIM entries in monthly goal calculation
    const metrics = calculatePeriodMetrics(breakdownsToUse, logsToUse, goalStart, goalEnd, false, walkInsToUse);

    return { metrics, goalStart, goalEnd };
  };

  const getGoalPeriodVimMetrics = (logsToUse, breakdownsToUse) => {
    const goalStart = startOfMonth(parseLocalDate(startDate));
    const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

    const vimLogs = logsToUse.filter(log => {
      const logDate = parseLocalDate(log.date);
      return log.is_vim_entry && logDate >= goalStart && logDate <= goalEnd;
    });

    const vimBreakdowns = breakdownsToUse.filter(bd =>
      vimLogs.map(l => l.id).includes(bd.daily_log_id)
    );

    let totalCollected = 0;
    vimBreakdowns.forEach(bd => {
      totalCollected += bd.pos_amount || 0;
    });

    return { totalCollected, count: vimBreakdowns.length };
  };

  const getMTDMetrics = (logsToUse, breakdownsToUse) => {
    const now = new Date();
    const mtdStart = startOfMonth(now);
    const mtdEnd = now;

    // Include VIM entries in monthly goal calculation
    const metrics = calculatePeriodMetrics(breakdownsToUse, logsToUse, mtdStart, mtdEnd, false);

    return metrics;
  };

  const getMTDVimMetrics = (logsToUse, breakdownsToUse) => {
    const now = new Date();
    const mtdStart = startOfMonth(now);
    const mtdEnd = now;

    const vimLogs = logsToUse.filter(log => {
      const logDate = parseLocalDate(log.date);
      return log.is_vim_entry && logDate >= mtdStart && logDate <= mtdEnd;
    });

    const vimBreakdowns = breakdownsToUse.filter(bd =>
      vimLogs.map(l => l.id).includes(bd.daily_log_id)
    );

    let totalCollected = 0;
    vimBreakdowns.forEach(bd => {
      totalCollected += bd.pos_amount || 0;
    });

    return { totalCollected, count: vimBreakdowns.length };
  };

  const getUserStats = (logsToUse, breakdownsToUse, walkInsToUse) => {
    const userStats = {};

    // Filter out VIM entries from user stats
    // Also check notes field for backward compatibility with old VIM entries
    const nonVimLogs = logsToUse.filter(log => {
      const isVimEntry = log.is_vim_entry || (log.notes && log.notes.includes("Virtual Intake Manager"));
      return !isVimEntry;
    });

    breakdownsToUse.forEach(bd => {
      const log = nonVimLogs.find(l => l.id === bd.daily_log_id);
      if (log) {
        if (!userStats[log.user_id]) {
          userStats[log.user_id] = {
            userId: log.user_id,
            userName: log.user_name,
            newPatients: 0,
            paid: 0,
            collected: 0,
            paymentPlanCollected: 0,
            walkInCollected: 0
          };
        }
        const newPatients = bd.new_patients || 0;
        userStats[log.user_id].newPatients += newPatients;
        userStats[log.user_id].paid += bd.pos_collections_count || 0;
        userStats[log.user_id].collected += bd.pos_amount || 0;
      }
    });

    // Add walk-in collections to user stats
    walkInsToUse.forEach(wi => {
      const log = nonVimLogs.find(l => l.id === wi.daily_log_id);
      if (log) {
        if (!userStats[log.user_id]) {
          userStats[log.user_id] = {
            userId: log.user_id,
            userName: log.user_name,
            newPatients: 0,
            paid: 0,
            collected: 0,
            paymentPlanCollected: 0,
            walkInCollected: 0
          };
        }
        userStats[log.user_id].walkInCollected += wi.pos_amount || 0;
        userStats[log.user_id].collected += wi.pos_amount || 0;
      }
    });

    // Add successful payment plan payments to user stats (attributed to plan creator)
    const countedSchedules = new Set();
    allPaymentSchedules.forEach(schedule => {
      if (schedule.status === "successful" && !countedSchedules.has(schedule.id)) {
        countedSchedules.add(schedule.id);
        const scheduleDate = parseLocalDate(schedule.scheduled_date);
        const isInPeriod = viewMode === "current" 
          ? scheduleDate >= parseLocalDate(startDate) && scheduleDate <= parseLocalDate(endDate)
          : (() => {
              const { ytdStart, ytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);
              return scheduleDate >= ytdStart && scheduleDate <= ytdEnd;
            })();

        if (isInPeriod) {
          // Find the payment plan to get the creator
          const plan = allPaymentPlans.find(p => p.id === schedule.payment_plan_id);
          if (plan) {
            console.log("Adding payment plan schedule:", {
              scheduleId: schedule.id,
              amount: schedule.amount,
              date: schedule.scheduled_date,
              planCreator: plan.created_by_user_name
            });
            if (!userStats[plan.created_by_user_id]) {
              userStats[plan.created_by_user_id] = {
                userId: plan.created_by_user_id,
                userName: plan.created_by_user_name,
                newPatients: 0,
                paid: 0,
                collected: 0,
                paymentPlanCollected: 0
              };
            }
            userStats[plan.created_by_user_id].paymentPlanCollected += schedule.amount || 0;
            userStats[plan.created_by_user_id].collected += schedule.amount || 0;
          }
        }
      }
    });

    return Object.values(userStats).sort((a, b) => b.collected - a.collected);
  };

  const getUserMTDStats = (logsToUse, breakdownsToUse, walkInsToUse) => {
    const now = new Date();
    const mtdStart = startOfMonth(now);
    const mtdEnd = now;

    // Filter out VIM entries from user MTD stats
    // Also check notes field for backward compatibility with old VIM entries
    const mtdLogs = logsToUse.filter(log => {
      const logDate = parseLocalDate(log.date);
      const isVimEntry = log.is_vim_entry || (log.notes && log.notes.includes("Virtual Intake Manager"));
      return logDate >= mtdStart && logDate <= mtdEnd && !isVimEntry;
    });

    const mtdBreakdowns = breakdownsToUse.filter(bd =>
      mtdLogs.map(l => l.id).includes(bd.daily_log_id)
    );

    const mtdWalkIns = walkInsToUse.filter(wi =>
      mtdLogs.map(l => l.id).includes(wi.daily_log_id)
    );

    const userStats = {};

    mtdBreakdowns.forEach(bd => {
      const log = mtdLogs.find(l => l.id === bd.daily_log_id);
      if (log) {
        if (!userStats[log.user_id]) {
          userStats[log.user_id] = {
            userId: log.user_id,
            mtdCollected: 0
          };
        }

        userStats[log.user_id].mtdCollected += bd.pos_amount || 0;
      }
    });

    // Add walk-in collections to MTD stats
    mtdWalkIns.forEach(wi => {
      const log = mtdLogs.find(l => l.id === wi.daily_log_id);
      if (log) {
        if (!userStats[log.user_id]) {
          userStats[log.user_id] = {
            userId: log.user_id,
            mtdCollected: 0
          };
        }
        userStats[log.user_id].mtdCollected += wi.pos_amount || 0;
      }
    });

    // Add successful payment plan payments to MTD stats (attributed to plan creator)
    const countedMTDSchedules = new Set();
    allPaymentSchedules.forEach(schedule => {
      if (schedule.status === "successful" && !countedMTDSchedules.has(schedule.id)) {
        countedMTDSchedules.add(schedule.id);
        const scheduleDate = parseLocalDate(schedule.scheduled_date);
        if (scheduleDate >= mtdStart && scheduleDate <= mtdEnd) {
          // Find the payment plan to get the creator
          const plan = allPaymentPlans.find(p => p.id === schedule.payment_plan_id);
          if (plan) {
            if (!userStats[plan.created_by_user_id]) {
              userStats[plan.created_by_user_id] = {
                userId: plan.created_by_user_id,
                mtdCollected: 0
              };
            }
            userStats[plan.created_by_user_id].mtdCollected += schedule.amount || 0;
          }
        }
      }
    });

    // Log Amber Wilson's final total
    const amberUserId = Object.keys(userStats).find(userId => {
      const log = mtdLogs.find(l => l.user_id === userId);
      return log?.user_name === "Amber Wilson";
    });
    if (amberUserId) {
      console.log("Amber Wilson MTD Total:", userStats[amberUserId].mtdCollected);
      console.log("Amber Wilson MTD Logs Count:", mtdLogs.filter(l => l.user_name === "Amber Wilson").length);
    }

    return userStats;
  };

  const exportToCSV = () => {
    const logsToExport = selectedLocation === "all"
      ? allLogs
      : allLogs.filter(log => log.location === selectedLocation);

    const breakdownsForExport = allBreakdowns.filter(bd =>
      logsToExport.map(l => l.id).includes(bd.daily_log_id)
    );

    let filteredLogs;
    if (viewMode === "current") {
      filteredLogs = logsToExport.filter(log => {
        const logDate = parseLocalDate(log.date);
        return logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
      });
    } else {
      const { ytdStart, ytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);
      filteredLogs = logsToExport.filter(log => {
        const logDate = parseLocalDate(log.date);
        return logDate >= ytdStart && logDate <= ytdEnd;
      });
    }

    filteredLogs.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

    const payerTypes = ["Commercial", "Medicare", "SelfPay"];
    
    payerTypes.forEach(payerType => {
      const headers = [
        "Date",
        "User",
        `${payerType === "SelfPay" ? "Self Pay" : payerType} New Patients`,
        ...(payerType !== "SelfPay" ? ["Single Coverage", "Dual Coverage"] : []),
        "Number of Patients Called",
        "Room Visit",
        "Patients not Seen",
        ...(payerType !== "SelfPay" ? ["Insurance Updates"] : []),
        ...(payerType === "Medicare" ? ["QMB Screening", "QMB Enrollments", "QMB Paperwork"] : []),
        ...(payerType === "SelfPay" ? ["SP Converted to Insurance", "Inpatient Financial Assistance", "Walk-In/Call-In Financial Assistance"] : []),
        "Walk-Ins",
        "# of POS Collection",
        "POS Amount",
        "POS Potential"
      ];

      const rows = filteredLogs.map(log => {
        const breakdown = breakdownsForExport.find(bd => 
          bd.daily_log_id === log.id && bd.payer_type === payerType
        );

        const row = [
          format(parseLocalDate(log.date), "M/d/yyyy"),
          log.user_name || "",
          breakdown?.new_patients || 0,
          ...(payerType !== "SelfPay" ? [
            breakdown?.single_coverage || 0,
            breakdown?.dual_coverage || 0
          ] : []),
          breakdown?.patients_called || 0,
          breakdown?.room_visits || 0,
          breakdown?.patients_not_seen || 0,
          ...(payerType !== "SelfPay" ? [breakdown?.insurance_updates || 0] : []),
          ...(payerType === "Medicare" ? [
            breakdown?.qmb_screening || 0,
            breakdown?.qmb_enrollments || 0,
            breakdown?.qmb_paperwork || 0
          ] : []),
          ...(payerType === "SelfPay" ? [
            breakdown?.sp_converted_to_insurance || 0,
            breakdown?.inpatient_financial_assistance || 0,
            breakdown?.walkin_callin_financial_assistance || 0
          ] : []),
          breakdown?.walk_ins || 0,
          breakdown?.pos_collections_count || 0,
          breakdown?.pos_amount ? breakdown.pos_amount.toFixed(2) : "0.00",
          breakdown?.pos_potential ? breakdown.pos_potential.toFixed(2) : "0.00"
        ];

        return row;
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `FC_${payerType}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const filteredLogsByLocation = selectedLocation === "all"
    ? allLogs
    : allLogs.filter(log => log.location === selectedLocation);

  const filteredBreakdownsByLocation = allBreakdowns.filter(bd =>
    filteredLogsByLocation.map(l => l.id).includes(bd.daily_log_id)
  );
  
  const filteredWalkInsByLocation = allWalkIns.filter(wi =>
    filteredLogsByLocation.map(l => l.id).includes(wi.daily_log_id)
  );

  const metrics = getMetrics(filteredLogsByLocation, filteredBreakdownsByLocation, filteredWalkInsByLocation);
  const currentMetrics = viewMode === "current" ? metrics : metrics.ytd;

  const relevantLogsForUserStats = viewMode === "current"
    ? filteredLogsByLocation.filter(log => {
        const logDate = parseLocalDate(log.date);
        return logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
      })
    : filteredLogsByLocation.filter(log => {
        const { ytdStart, ytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);
        const logDate = parseLocalDate(log.date);
        return logDate >= ytdStart && logDate <= ytdEnd;
      });

  const relevantBreakdownsForUserStats = filteredBreakdownsByLocation.filter(bd =>
    relevantLogsForUserStats.map(l => l.id).includes(bd.daily_log_id)
  );

  const relevantWalkInsForUserStats = filteredWalkInsByLocation.filter(wi =>
    relevantLogsForUserStats.map(l => l.id).includes(wi.daily_log_id)
  );

  const userMTDStats = getUserMTDStats(filteredLogsByLocation, filteredBreakdownsByLocation, filteredWalkInsByLocation);

  const getInsuranceUpdatesData = () => {
    if (viewMode === "current") {
      return [
        { 
          name: "Commercial", 
          updates: currentMetrics.payerTotals?.Commercial?.insurance_updates || 0 
        },
        { 
          name: "Medicare", 
          updates: currentMetrics.payerTotals?.Medicare?.insurance_updates || 0 
        }
      ];
    } else {
      return [
        { 
          name: "Commercial",
          YTD: metrics.ytd?.payerTotals?.Commercial?.insurance_updates || 0,
          PYTD: metrics.pytd?.payerTotals?.Commercial?.insurance_updates || 0
        },
        { 
          name: "Medicare",
          YTD: metrics.ytd?.payerTotals?.Medicare?.insurance_updates || 0,
          PYTD: metrics.pytd?.payerTotals?.Medicare?.insurance_updates || 0
        }
      ];
    }
  };



  if (loading) {
    return (
      <div className="p-8 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <Skeleton className="h-12 w-64 bg-slate-200" />
        <div className="grid md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 bg-slate-200" />)}
        </div>
      </div>
    );
  }

  return (
        <>
          <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
          <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            box-sizing: border-box;
            background-color: white !important;
            color: black !important;
          }
          
          #printable-area h1, 
          #printable-area h2, 
          #printable-area h3,
          #printable-area p, 
          #printable-area div, 
          #printable-area span,
          #printable-area td,
          #printable-area th {
            color: black !important;
          }
          
          #printable-area .border-slate-200 { 
            border-color: #e2e8f0 !important; 
          }
          #printable-area .bg-white\\/80,
          #printable-area .bg-white { 
            background-color: white !important; 
          }
          #printable-area .bg-slate-50 { 
            background-color: #f8fafc !important; 
          }

          .metric-card-title { 
            color: #4b5563 !important; 
          }
          .metric-card-value { 
            color: #1e293b !important; 
          }
          
          .bg-emerald-50 {
            background-color: #d1fae5 !important;
          }
          .text-emerald-700 {
            color: #047857 !important;
          }
          .bg-red-50 {
            background-color: #fee2e2 !important;
          }
          .text-red-700 {
            color: #b91c1c !important;
          }

          .no-print {
            display: none !important;
          }
          
          .recharts-responsive-container {
            width: 100% !important;
            height: 350px !important;
          }
          
          .recharts-wrapper .recharts-cartesian-axis-line,
          .recharts-wrapper .recharts-cartesian-grid-horizontal line,
          .recharts-wrapper .recharts-cartesian-grid-vertical line {
            stroke: #cbd5e1 !important;
          }
          .recharts-wrapper .recharts-label,
          .recharts-wrapper .recharts-tooltip-item,
          .recharts-wrapper .recharts-text,
          .recharts-wrapper .recharts-legend-item-text {
            fill: black !important;
          }
          .recharts-tooltip-wrapper .recharts-default-tooltip {
            background-color: white !important;
            border: 1px solid #cbd5e1 !important;
            color: black !important;
          }
          
          .print-break {
            page-break-before: always;
          }
          
          .recharts-wrapper,
          .recharts-responsive-container {
            page-break-inside: avoid !important;
          }
          
          .grid {
            page-break-inside: avoid;
          }
          
          @page {
            size: landscape;
            margin: 0.5in;
          }
        }
        
        .recharts-wrapper {
          min-height: 300px;
        }
      `}</style>
      
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Team Dashboard</h1>
              <p className="text-slate-600 mt-1">Financial Clearance productivity metrics</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <YTDToggle value={viewMode} onChange={setViewMode} />

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-[120px] bg-white border-slate-300 text-slate-900">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-300">
                    <SelectItem value="all" className="text-slate-900">All Locations</SelectItem>
                    <SelectItem value="RMC" className="text-slate-900">RMC</SelectItem>
                    <SelectItem value="NMC" className="text-slate-900">NMC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {viewMode === "current" ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-40 bg-white border-slate-300 text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-40 bg-white border-slate-300 text-slate-900"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">As of Date</Label>
                  <Input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="w-40 bg-white border-slate-300 text-slate-900"
                  />
                </div>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={handlePrint}
                title="Print Charts"
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <Printer className="w-4 h-4" /> 
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={exportToCSV}
                title="Export to CSV"
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <Download className="w-4 h-4" />
              </Button>

              {currentUser?.app_role !== "staff" && (
                <Dialog open={showSettings} onOpenChange={setShowSettings}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-slate-200 text-slate-900">
                    <DialogHeader>
                      <DialogTitle className="text-slate-900">Fiscal Year Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700">Fiscal Year Start Month</Label>
                        <Select
                          value={fiscalStartMonth.toString()}
                          onValueChange={(v) => setFiscalStartMonth(parseInt(v))}
                        >
                          <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-300">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                              <SelectItem key={month} value={month.toString()} className="text-slate-900">
                                {format(new Date(2024, month - 1, 1), "MMMM")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={saveFiscalSettings} className="w-full bg-blue-600 hover:bg-blue-700">
                        Save Settings
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div id="printable-area">
              <div className="hidden print:block mb-6">
                <h1 className="text-2xl font-bold text-slate-900">FC Productivity Dashboard</h1>
                <p className="text-slate-600">
                  {viewMode === "current" 
                    ? `${format(parseLocalDate(startDate), "MMM dd, yyyy")} - ${format(parseLocalDate(endDate), "MMM dd, yyyy")}`
                    : `Year to Date as of ${format(parseLocalDate(asOfDate), "MMM dd, yyyy")}`
                  }
                  {selectedLocation !== "all" && ` - ${selectedLocation}`}
                </p>
              </div>

              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mb-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    {format(startOfMonth(parseLocalDate(startDate)), "MMMM yyyy")} Collection Goal (All Locations)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900">
                      ${(() => {
                        const { metrics } = getGoalPeriodMetrics(allLogs, allBreakdowns, allWalkIns);
                        const goalStart = startOfMonth(parseLocalDate(startDate));
                        const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

                        let paymentPlanTotal = 0;
                        allPaymentSchedules.forEach(schedule => {
                          if (schedule.status === "successful") {
                            const scheduleDate = parseLocalDate(schedule.scheduled_date);
                            if (scheduleDate >= goalStart && scheduleDate <= goalEnd) {
                              paymentPlanTotal += schedule.amount || 0;
                            }
                          }
                        });

                        return (metrics.totalCollected + paymentPlanTotal).toFixed(0);
                      })()}
                    </span>
                    <span className="text-slate-600">of $30,000 goal</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Progress</span>
                      <span className="font-semibold">
                        {(() => {
                          const { metrics } = getGoalPeriodMetrics(allLogs, allBreakdowns, allWalkIns);
                          const goalStart = startOfMonth(parseLocalDate(startDate));
                          const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

                          let paymentPlanTotal = 0;
                          allPaymentSchedules.forEach(schedule => {
                            if (schedule.status === "successful") {
                              const scheduleDate = parseLocalDate(schedule.scheduled_date);
                              if (scheduleDate >= goalStart && scheduleDate <= goalEnd) {
                                paymentPlanTotal += schedule.amount || 0;
                              }
                            }
                          });

                          const totalWithPlans = metrics.totalCollected + paymentPlanTotal;
                          const progress = (totalWithPlans / 30000) * 100;
                          return progress.toFixed(1);
                        })()}%
                      </span>
                    </div>
                    <Progress 
                      value={(() => {
                        const { metrics } = getGoalPeriodMetrics(allLogs, allBreakdowns, allWalkIns);
                        const goalStart = startOfMonth(parseLocalDate(startDate));
                        const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

                        let paymentPlanTotal = 0;
                        allPaymentSchedules.forEach(schedule => {
                          if (schedule.status === "successful") {
                            const scheduleDate = parseLocalDate(schedule.scheduled_date);
                            if (scheduleDate >= goalStart && scheduleDate <= goalEnd) {
                              paymentPlanTotal += schedule.amount || 0;
                            }
                          }
                        });

                        const totalWithPlans = metrics.totalCollected + paymentPlanTotal;
                        return Math.min((totalWithPlans / 30000) * 100, 100);
                      })()} 
                      className="h-3"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">VIM Collections</p>
                      <p className="text-lg font-bold text-purple-600">
                        ${(() => {
                          const vimMetrics = getGoalPeriodVimMetrics(allLogs, allBreakdowns);
                          return vimMetrics.totalCollected.toFixed(0);
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Walk-Ins</p>
                      <p className="text-lg font-bold text-cyan-600">
                        ${(() => {
                          const goalStart = startOfMonth(parseLocalDate(startDate));
                          const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

                          const goalPeriodWalkIns = allWalkIns.filter(wi => {
                            const log = allLogs.find(l => l.id === wi.daily_log_id);
                            if (!log) return false;
                            const logDate = parseLocalDate(log.date);
                            return logDate >= goalStart && logDate <= goalEnd;
                          });

                          let walkInTotal = 0;
                          goalPeriodWalkIns.forEach(wi => {
                            walkInTotal += wi.pos_amount || 0;
                          });

                          return walkInTotal.toFixed(0);
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Payment Plans</p>
                      <p className="text-lg font-bold text-indigo-600">
                        ${(() => {
                          const goalStart = startOfMonth(parseLocalDate(startDate));
                          const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

                          let paymentPlanTotal = 0;
                          allPaymentSchedules.forEach(schedule => {
                            if (schedule.status === "successful") {
                              const scheduleDate = parseLocalDate(schedule.scheduled_date);
                              if (scheduleDate >= goalStart && scheduleDate <= goalEnd) {
                                paymentPlanTotal += schedule.amount || 0;
                              }
                            }
                          });

                          return paymentPlanTotal.toFixed(0);
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Remaining</p>
                      <p className="text-lg font-bold text-slate-900">
                        ${(() => {
                          const { metrics } = getGoalPeriodMetrics(allLogs, allBreakdowns, allWalkIns);
                          const goalStart = startOfMonth(parseLocalDate(startDate));
                          const goalEnd = new Date(goalStart.getFullYear(), goalStart.getMonth() + 1, 0);

                          let paymentPlanTotal = 0;
                          allPaymentSchedules.forEach(schedule => {
                            if (schedule.status === "successful") {
                              const scheduleDate = parseLocalDate(schedule.scheduled_date);
                              if (scheduleDate >= goalStart && scheduleDate <= goalEnd) {
                                paymentPlanTotal += schedule.amount || 0;
                              }
                            }
                          });

                          const totalWithPlans = metrics.totalCollected + paymentPlanTotal;
                          const remaining = Math.max(30000 - totalWithPlans, 0);
                          return remaining.toFixed(0);
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Team Leaderboard - Top Collectors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getUserStats(relevantLogsForUserStats, relevantBreakdownsForUserStats, relevantWalkInsForUserStats).map((stat, index) => (
                    <div key={stat.userId} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-amber-500 text-white' :
                          index === 1 ? 'bg-slate-400 text-slate-900' :
                          index === 2 ? 'bg-amber-700 text-white' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{stat.userName}</p>
                          <p className="text-sm text-slate-600">
                            {stat.newPatients} new patients • {stat.newPatients > 0 ? ((stat.paid / stat.newPatients) * 100).toFixed(1) : 0}% conversion
                          </p>
                          {stat.walkInCollected > 0 && (
                            <p className="text-xs text-cyan-600 mt-1">
                              Walk-Ins: ${stat.walkInCollected.toFixed(2)}
                            </p>
                          )}
                          {stat.paymentPlanCollected > 0 && (
                            <p className="text-xs text-indigo-600 mt-1">
                              Payment Plans: ${stat.paymentPlanCollected.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">${stat.collected.toFixed(2)}</p>
                        <p className="text-sm text-slate-500">
                          {viewMode === "current" 
                            ? `${format(parseLocalDate(startDate), "MMM d")} - ${format(parseLocalDate(endDate), "MMM d")}`
                            : "YTD collected"}
                        </p>
                        {userMTDStats[stat.userId] && (
                          <p className="text-sm text-blue-600 font-semibold mt-1">
                            MTD: ${userMTDStats[stat.userId].mtdCollected.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {getUserStats(relevantLogsForUserStats, relevantBreakdownsForUserStats, relevantWalkInsForUserStats).length === 0 && (
                    <p className="text-center text-slate-500 py-8">No data for selected period or location</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-4 gap-4 mt-6">
              <MetricCard
                title="New Patients"
                icon={Users}
                ytdValue={viewMode === "current" ? currentMetrics.totalNewPatients : metrics.ytd.totalNewPatients}
                pytdValue={viewMode === "ytd" ? metrics.pytd.totalNewPatients : 0}
                showComparison={viewMode === "ytd"}
              />

              <MetricCard
                title="Conversion Rate"
                icon={TrendingUp}
                ytdValue={viewMode === "current" ? currentMetrics.conversionRate : metrics.ytd.conversionRate}
                pytdValue={viewMode === "ytd" ? metrics.pytd.conversionRate : 0}
                showComparison={viewMode === "ytd"}
                valueFormatter={(v) => `${v.toFixed(1)}%`}
              />

              <MetricCard
                title="Patients Paid"
                icon={Activity}
                ytdValue={viewMode === "current" ? currentMetrics.totalPaid : metrics.ytd.totalPaid}
                pytdValue={viewMode === "ytd" ? metrics.pytd.totalPaid : 0}
                showComparison={viewMode === "ytd"}
              />

              <MetricCard
                title={viewMode === "current" ? "Current Collected" : "Total Collected"}
                icon={DollarSign}
                ytdValue={viewMode === "current" ? currentMetrics.totalCollected : metrics.ytd.totalCollected}
                pytdValue={viewMode === "ytd" ? metrics.pytd.totalCollected : 0}
                showComparison={viewMode === "ytd"}
                valueFormatter={(v) => `$${v.toFixed(2)}`}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    POS Collection vs Potential ({format(parseLocalDate(startDate), "MMM d")} - {format(parseLocalDate(endDate), "MMM d")})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      // Calculate VIM separately
                      const vimLogs = filteredLogsByLocation.filter(log => {
                        const logDate = parseLocalDate(log.date);
                        return log.is_vim_entry && logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
                      });
                      const vimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                        vimLogs.map(l => l.id).includes(bd.daily_log_id)
                      );
                      let vimCollected = 0;
                      let vimPotential = 0;
                      vimBreakdowns.forEach(bd => {
                        vimCollected += bd.pos_amount || 0;
                        vimPotential += bd.pos_potential || 0;
                      });

                      // Calculate non-VIM payer data
                      const nonVimLogs = filteredLogsByLocation.filter(log => !log.is_vim_entry);
                      const nonVimMetrics = calculatePeriodMetrics(
                        filteredBreakdownsByLocation.filter(bd => nonVimLogs.map(l => l.id).includes(bd.daily_log_id)),
                        nonVimLogs,
                        parseLocalDate(startDate),
                        parseLocalDate(endDate),
                        false
                      );

                      const data = Object.entries(nonVimMetrics.payerTotals || {}).map(([payer, payerData]) => ({
                        name: payer === "SelfPay" ? "Self Pay" : payer,
                        collected: payerData.collected || 0,
                        potential: payerData.potential || 0
                      }));

                      if (vimCollected > 0 || vimPotential > 0) {
                        data.push({
                          name: "VIM",
                          collected: vimCollected,
                          potential: vimPotential
                        });
                      }

                      return data;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="name" stroke="#475569" />
                      <YAxis stroke="#475569" />
                      <Tooltip 
                        formatter={(value) => `$${value.toFixed(2)}`}
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} 
                      />
                      <Legend />
                      <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="potential" name="Potential" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-1">Total Collected</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        ${currentMetrics.totalCollected.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-1">Total Potential</p>
                      <p className="text-2xl font-bold text-amber-600">
                        ${currentMetrics.totalPotential.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5" />
                                    VIM Collections ({format(parseLocalDate(startDate), "MMM d")} - {format(parseLocalDate(endDate), "MMM d")})
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                  <div className="text-center mb-4">
                                    <p className="text-5xl font-bold text-purple-600">
                                      ${(() => {
                                        const vimMetrics = getGoalPeriodVimMetrics(allLogs, allBreakdowns);
                                        return vimMetrics.totalCollected.toFixed(0);
                                      })()}
                                    </p>
                                    <p className="text-sm text-slate-600 mt-2">
                                      Total Virtual Intake Manager collections for selected period
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                                    <div className="text-center">
                                      <p className="text-xs text-slate-600 mb-1">% of Monthly Goal</p>
                                      <p className="text-xl font-bold text-purple-600">
                                        {(() => {
                                          const vimMetrics = getGoalPeriodVimMetrics(allLogs, allBreakdowns);
                                          return ((vimMetrics.totalCollected / 30000) * 100).toFixed(1);
                                        })()}%
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-slate-600 mb-1">Total Entries</p>
                                      <p className="text-xl font-bold text-purple-600">
                                        {(() => {
                                          const vimMetrics = getGoalPeriodVimMetrics(allLogs, allBreakdowns);
                                          return vimMetrics.count;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
            </div>

            {currentMetrics.selfPayMetrics && (currentMetrics.selfPayMetrics.insurance_found > 0 || currentMetrics.selfPayMetrics.inpatient_financial_assistance > 0 || currentMetrics.selfPayMetrics.walkin_callin_financial_assistance > 0 || viewMode === "ytd") && (
              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Self-Pay Metrics {viewMode === "ytd" && "(YTD vs PYTD)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-100 rounded-lg border border-blue-200">
                      <p className="text-sm text-slate-600 mb-1">SP Converted to Insurance</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {currentMetrics.selfPayMetrics.insurance_found}
                      </p>
                      {viewMode === "ytd" && (
                        <p className="text-xs text-slate-700 mt-1">
                          PYTD: {metrics.pytd.selfPayMetrics.insurance_found}
                          <span className={`ml-1 ${currentMetrics.selfPayMetrics.insurance_found >= metrics.pytd.selfPayMetrics.insurance_found ? 'text-emerald-600' : 'text-red-600'}`}>
                            ({currentMetrics.selfPayMetrics.insurance_found >= metrics.pytd.selfPayMetrics.insurance_found ? '+' : ''}{currentMetrics.selfPayMetrics.insurance_found - metrics.pytd.selfPayMetrics.insurance_found})
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="text-center p-4 bg-amber-100 rounded-lg border border-amber-200">
                      <p className="text-sm text-slate-600 mb-1">Inpatient Financial Assistance</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {currentMetrics.selfPayMetrics.inpatient_financial_assistance}
                      </p>
                      {viewMode === "ytd" && (
                        <p className="text-xs text-slate-700 mt-1">
                          PYTD: {metrics.pytd.selfPayMetrics.inpatient_financial_assistance}
                          <span className={`ml-1 ${currentMetrics.selfPayMetrics.inpatient_financial_assistance >= metrics.pytd.selfPayMetrics.inpatient_financial_assistance ? 'text-emerald-600' : 'text-red-600'}`}>
                            ({currentMetrics.selfPayMetrics.inpatient_financial_assistance >= metrics.pytd.selfPayMetrics.inpatient_financial_assistance ? '+' : ''}{currentMetrics.selfPayMetrics.inpatient_financial_assistance - metrics.pytd.selfPayMetrics.inpatient_financial_assistance})
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="text-center p-4 bg-purple-100 rounded-lg border border-purple-200">
                      <p className="text-sm text-slate-600 mb-1">Walk-In/Call-In Financial Assistance</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {currentMetrics.selfPayMetrics.walkin_callin_financial_assistance}
                      </p>
                      {viewMode === "ytd" && (
                        <p className="text-xs text-slate-700 mt-1">
                          PYTD: {metrics.pytd.selfPayMetrics.walkin_callin_financial_assistance}
                          <span className={`ml-1 ${currentMetrics.selfPayMetrics.walkin_callin_financial_assistance >= metrics.pytd.selfPayMetrics.walkin_callin_financial_assistance ? 'text-emerald-600' : 'text-red-600'}`}>
                            ({currentMetrics.selfPayMetrics.walkin_callin_financial_assistance >= metrics.pytd.selfPayMetrics.walkin_callin_financial_assistance ? '+' : ''}{currentMetrics.selfPayMetrics.walkin_callin_financial_assistance - metrics.pytd.selfPayMetrics.walkin_callin_financial_assistance})
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="text-center p-4 bg-emerald-100 rounded-lg border border-emerald-200">
                      <p className="text-sm text-slate-600 mb-1">SP Conversion Rate</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {(() => {
                          const spSeen = currentMetrics.payerTotals?.SelfPay?.newPatients || 0;
                          const spConverted = currentMetrics.selfPayMetrics.insurance_found || 0;
                          return spSeen > 0 ? `${((spConverted / spSeen) * 100).toFixed(1)}%` : '0.0%';
                        })()}
                      </p>
                      {viewMode === "ytd" && (() => {
                        const ytdSpSeen = metrics.ytd.payerTotals?.SelfPay?.newPatients || 0;
                        const ytdSpConverted = metrics.ytd.selfPayMetrics.insurance_found || 0;
                        const pytdSpSeen = metrics.pytd.payerTotals?.SelfPay?.newPatients || 0;
                        const pytdSpConverted = metrics.pytd.selfPayMetrics.insurance_found || 0;
                        const ytdRate = ytdSpSeen > 0 ? ((ytdSpConverted / ytdSpSeen) * 100) : 0;
                        const pytdRate = pytdSpSeen > 0 ? ((pytdSpConverted / pytdSpSeen) * 100) : 0;
                        const diff = ytdRate - pytdRate;
                        return (
                          <p className="text-xs text-slate-700 mt-1">
                            PYTD: {pytdRate.toFixed(1)}%
                            <span className={`ml-1 ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ({diff >= 0 ? '+' : ''}{diff.toFixed(1)}%)
                            </span>
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentMetrics.medicareMetrics && (currentMetrics.medicareMetrics.qmb_screening > 0 || currentMetrics.medicareMetrics.qmb_enrollments > 0 || currentMetrics.medicareMetrics.qmb_paperwork > 0 || viewMode === "ytd") && (
              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Medicare QMB Metrics {viewMode === "ytd" && "(YTD vs PYTD)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-emerald-100 rounded-lg border border-emerald-200">
                      <p className="text-sm text-slate-600 mb-1">QMB Screening</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {currentMetrics.medicareMetrics.qmb_screening}
                      </p>
                      {viewMode === "ytd" && (
                        <p className="text-xs text-slate-700 mt-1">
                          PYTD: {metrics.pytd.medicareMetrics.qmb_screening}
                          <span className={`ml-1 ${currentMetrics.medicareMetrics.qmb_screening >= metrics.pytd.medicareMetrics.qmb_screening ? 'text-emerald-600' : 'text-red-600'}`}>
                            ({currentMetrics.medicareMetrics.qmb_screening >= metrics.pytd.medicareMetrics.qmb_screening ? '+' : ''}{currentMetrics.medicareMetrics.qmb_screening - metrics.pytd.medicareMetrics.qmb_screening})
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="text-center p-4 bg-blue-100 rounded-lg border border-blue-200">
                      <p className="text-sm text-slate-600 mb-1">QMB Enrollments</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {currentMetrics.medicareMetrics.qmb_enrollments}
                      </p>
                      {viewMode === "ytd" && (
                        <p className="text-xs text-slate-700 mt-1">
                          PYTD: {metrics.pytd.medicareMetrics.qmb_enrollments}
                          <span className={`ml-1 ${currentMetrics.medicareMetrics.qmb_enrollments >= metrics.pytd.medicareMetrics.qmb_enrollments ? 'text-emerald-600' : 'text-red-600'}`}>
                            ({currentMetrics.medicareMetrics.qmb_enrollments >= metrics.pytd.medicareMetrics.qmb_enrollments ? '+' : ''}{currentMetrics.medicareMetrics.qmb_enrollments - metrics.pytd.medicareMetrics.qmb_enrollments})
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="text-center p-4 bg-purple-100 rounded-lg border border-purple-200">
                      <p className="text-sm text-slate-600 mb-1">QMB Paperwork</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {currentMetrics.medicareMetrics.qmb_paperwork}
                      </p>
                      {viewMode === "ytd" && (
                        <p className="text-xs text-slate-700 mt-1">
                          PYTD: {metrics.pytd.medicareMetrics.qmb_paperwork}
                          <span className={`ml-1 ${currentMetrics.medicareMetrics.qmb_paperwork >= metrics.pytd.medicareMetrics.qmb_paperwork ? 'text-emerald-600' : 'text-red-600'}`}>
                            ({currentMetrics.medicareMetrics.qmb_paperwork >= metrics.pytd.medicareMetrics.qmb_paperwork ? '+' : ''}{currentMetrics.medicareMetrics.qmb_paperwork - metrics.pytd.medicareMetrics.qmb_paperwork})
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">Payer Mix</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={getPayerMixData(filteredLogsByLocation, filteredBreakdownsByLocation)}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getPayerMixData(filteredLogsByLocation, filteredBreakdownsByLocation).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid #e2e8f0', 
                          color: '#1e293b' 
                        }} 
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Conversion Rate by Payer {viewMode === "ytd" && "(YTD vs PYTD)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={(() => {
                      if (viewMode === "current") {
                        return Object.entries(currentMetrics.payerTotals || {}).map(([payer, data]) => {
                          const conversionRate = data.newPatients > 0 ? (data.paid / data.newPatients) * 100 : 0;
                          return {
                            name: payer === "SelfPay" ? "Self Pay" : payer,
                            rate: conversionRate
                          };
                        });
                      } else {
                        const payerNames = ["Commercial", "Medicare", "SelfPay"];
                        return payerNames.map(payer => {
                          const ytdData = metrics.ytd?.payerTotals?.[payer];
                          const pytdData = metrics.pytd?.payerTotals?.[payer];
                          const ytdRate = ytdData?.newPatients > 0 ? (ytdData.paid / ytdData.newPatients) * 100 : 0;
                          const pytdRate = pytdData?.newPatients > 0 ? (pytdData.paid / pytdData.newPatients) * 100 : 0;
                          return {
                            name: payer === "SelfPay" ? "Self Pay" : payer,
                            YTD: ytdRate,
                            PYTD: pytdRate
                          };
                        });
                      }
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="name" stroke="#475569" />
                      <YAxis stroke="#475569" label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value) => `${value.toFixed(1)}%`}
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} 
                      />
                      {viewMode === "ytd" && <Legend />}
                      <Bar dataKey={viewMode === "current" ? "rate" : "YTD"} fill="#10b981" radius={[8, 8, 0, 0]} />
                      {viewMode === "ytd" && (
                        <Bar dataKey="PYTD" fill="#6ee7b7" radius={[8, 8, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Insurance Updates {viewMode === "ytd" && "(YTD vs PYTD)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={getInsuranceUpdatesData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="name" stroke="#475569" />
                    <YAxis stroke="#475569" />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} />
                    {viewMode === "ytd" && <Legend />}
                    <Bar dataKey={viewMode === "current" ? "updates" : "YTD"} fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    {viewMode === "ytd" && (
                      <Bar dataKey="PYTD" fill="#c4b5fd" radius={[8, 8, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="print-break"></div> 

            <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Collections by Payer {viewMode === "ytd" && "(YTD vs PYTD)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={(() => {
                      if (viewMode === "current") {
                        // Calculate VIM separately
                        const vimLogs = filteredLogsByLocation.filter(log => {
                          const logDate = parseLocalDate(log.date);
                          return log.is_vim_entry && logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
                        });
                        const vimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                          vimLogs.map(l => l.id).includes(bd.daily_log_id)
                        );
                        let vimCollected = 0;
                        let vimNewPatients = 0;
                        vimBreakdowns.forEach(bd => {
                          vimCollected += bd.pos_amount || 0;
                          vimNewPatients += bd.new_patients || 0;
                        });

                        // Calculate non-VIM payer data
                        const nonVimLogs = filteredLogsByLocation.filter(log => !log.is_vim_entry);
                        const nonVimMetrics = calculatePeriodMetrics(
                          filteredBreakdownsByLocation.filter(bd => nonVimLogs.map(l => l.id).includes(bd.daily_log_id)),
                          nonVimLogs,
                          parseLocalDate(startDate),
                          parseLocalDate(endDate),
                          false
                        );

                        const data = Object.entries(nonVimMetrics.payerTotals || {}).map(([payer, payerData]) => ({
                          name: payer === "SelfPay" ? "Self Pay" : payer,
                          collected: payerData.collected || 0,
                          newPatients: payerData.newPatients || 0
                        }));

                        if (vimCollected > 0 || vimNewPatients > 0) {
                          data.push({
                            name: "VIM",
                            collected: vimCollected,
                            newPatients: vimNewPatients
                          });
                        }

                        return data;
                      } else {
                        // YTD mode - calculate VIM for both periods
                        const { ytdStart, ytdEnd, pytdStart, pytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);

                        const ytdVimLogs = filteredLogsByLocation.filter(log => {
                          const logDate = parseLocalDate(log.date);
                          return log.is_vim_entry && logDate >= ytdStart && logDate <= ytdEnd;
                        });
                        const ytdVimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                          ytdVimLogs.map(l => l.id).includes(bd.daily_log_id)
                        );
                        let ytdVimCollected = 0;
                        let ytdVimNewPatients = 0;
                        ytdVimBreakdowns.forEach(bd => {
                          ytdVimCollected += bd.pos_amount || 0;
                          ytdVimNewPatients += bd.new_patients || 0;
                        });

                        const pytdVimLogs = filteredLogsByLocation.filter(log => {
                          const logDate = parseLocalDate(log.date);
                          return log.is_vim_entry && logDate >= pytdStart && logDate <= pytdEnd;
                        });
                        const pytdVimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                          pytdVimLogs.map(l => l.id).includes(bd.daily_log_id)
                        );
                        let pytdVimCollected = 0;
                        let pytdVimNewPatients = 0;
                        pytdVimBreakdowns.forEach(bd => {
                          pytdVimCollected += bd.pos_amount || 0;
                          pytdVimNewPatients += bd.new_patients || 0;
                        });

                        const payerNames = ["Commercial", "Medicare", "SelfPay"];
                        const data = payerNames.map(payer => ({
                          name: payer === "SelfPay" ? "Self Pay" : payer,
                          ytdCollected: metrics.ytd?.payerTotals?.[payer]?.collected || 0,
                          pytdCollected: metrics.pytd?.payerTotals?.[payer]?.collected || 0,
                          ytdNewPatients: metrics.ytd?.payerTotals?.[payer]?.newPatients || 0,
                          pytdNewPatients: metrics.pytd?.payerTotals?.[payer]?.newPatients || 0
                        }));

                        if (ytdVimCollected > 0 || pytdVimCollected > 0) {
                          data.push({
                            name: "VIM",
                            ytdCollected: ytdVimCollected,
                            pytdCollected: pytdVimCollected,
                            ytdNewPatients: ytdVimNewPatients,
                            pytdNewPatients: pytdVimNewPatients
                          });
                        }

                        return data;
                      }
                    })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="name" stroke="#475569" />
                    <YAxis stroke="#475569" />
                    <Tooltip 
                      formatter={(value) => `$${value.toFixed(2)}`} 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #e2e8f0', 
                        color: '#1e293b' 
                      }} 
                    />
                    <Legend />
                    {viewMode === "current" ? (
                      <>
                        <Bar dataKey="collected" name="Amount Collected" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="newPatients" name="New Patients" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="ytdCollected" name="YTD Collected" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdCollected" name="PYTD Collected" fill="#6ee7b7" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="ytdNewPatients" name="YTD New Patients" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdNewPatients" name="PYTD New Patients" fill="#93c5fd" radius={[8, 8, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="print-break"></div>

            <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Walk-In Activity {viewMode === "ytd" && "(YTD vs PYTD)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={(() => {
                    if (viewMode === "current") {
                      return [{
                        name: "Walk-Ins",
                        count: currentMetrics.walkInMetrics?.totalWalkIns || 0,
                        posCollections: currentMetrics.walkInMetrics?.totalPosCount || 0,
                        posAmount: currentMetrics.walkInMetrics?.totalPosAmount || 0
                      }];
                    } else {
                      return [{
                        name: "Walk-Ins",
                        ytdCount: metrics.ytd?.walkInMetrics?.totalWalkIns || 0,
                        ytdPosCollections: metrics.ytd?.walkInMetrics?.totalPosCount || 0,
                        ytdPosAmount: metrics.ytd?.walkInMetrics?.totalPosAmount || 0,
                        pytdCount: metrics.pytd?.walkInMetrics?.totalWalkIns || 0,
                        pytdPosCollections: metrics.pytd?.walkInMetrics?.totalPosCount || 0,
                        pytdPosAmount: metrics.pytd?.walkInMetrics?.totalPosAmount || 0
                      }];
                    }
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="name" stroke="#475569" />
                    <YAxis stroke="#475569" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name.includes("Amount") || name.includes("amount")) {
                          return `$${value.toFixed(2)}`;
                        }
                        return value;
                      }}
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} 
                    />
                    <Legend />
                    {viewMode === "current" ? (
                      <>
                        <Bar dataKey="count" name="Walk-In Count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="posCollections" name="POS Collections" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="posAmount" name="POS Amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="ytdCount" name="YTD Walk-Ins" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdCount" name="PYTD Walk-Ins" fill="#a5b4fc" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="ytdPosCollections" name="YTD POS Collections" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdPosCollections" name="PYTD POS Collections" fill="#c4b5fd" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="ytdPosAmount" name="YTD POS Amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdPosAmount" name="PYTD POS Amount" fill="#6ee7b7" radius={[8, 8, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-1">Total Walk-Ins</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {currentMetrics.walkInMetrics?.totalWalkIns || 0}
                    </p>
                    {viewMode === "ytd" && (
                      <p className="text-xs text-slate-500 mt-1">
                        PYTD: {metrics.pytd?.walkInMetrics?.totalWalkIns || 0}
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-1">POS Collections</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {currentMetrics.walkInMetrics?.totalPosCount || 0}
                    </p>
                    {viewMode === "ytd" && (
                      <p className="text-xs text-slate-500 mt-1">
                        PYTD: {metrics.pytd?.walkInMetrics?.totalPosCount || 0}
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-1">Total Amount</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      ${(currentMetrics.walkInMetrics?.totalPosAmount || 0).toFixed(2)}
                    </p>
                    {viewMode === "ytd" && (
                      <p className="text-xs text-slate-500 mt-1">
                        PYTD: ${(metrics.pytd?.walkInMetrics?.totalPosAmount || 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    POS Potential vs Amount Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={(() => {
                        if (viewMode === "current") {
                          // Calculate VIM separately
                          const vimLogs = filteredLogsByLocation.filter(log => {
                            const logDate = parseLocalDate(log.date);
                            return log.is_vim_entry && logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
                          });
                          const vimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                            vimLogs.map(l => l.id).includes(bd.daily_log_id)
                          );
                          let vimCollected = 0;
                          let vimPotential = 0;
                          vimBreakdowns.forEach(bd => {
                            vimCollected += bd.pos_amount || 0;
                            vimPotential += bd.pos_potential || 0;
                          });

                          // Calculate non-VIM payer data
                          const nonVimLogs = filteredLogsByLocation.filter(log => !log.is_vim_entry);
                          const nonVimMetrics = calculatePeriodMetrics(
                            filteredBreakdownsByLocation.filter(bd => nonVimLogs.map(l => l.id).includes(bd.daily_log_id)),
                            nonVimLogs,
                            parseLocalDate(startDate),
                            parseLocalDate(endDate),
                            false
                          );

                          const data = Object.entries(nonVimMetrics.payerTotals || {}).map(([payer, payerData]) => ({
                            name: payer === "SelfPay" ? "Self Pay" : payer,
                            potential: payerData.potential || 0,
                            collected: payerData.collected || 0
                          }));

                          if (vimCollected > 0 || vimPotential > 0) {
                            data.push({
                              name: "VIM",
                              potential: vimPotential,
                              collected: vimCollected
                            });
                          }

                          return data;
                        } else {
                          // YTD mode - calculate VIM for both periods
                          const { ytdStart, ytdEnd, pytdStart, pytdEnd } = getFiscalYearDates(asOfDate, fiscalStartMonth);

                          const ytdVimLogs = filteredLogsByLocation.filter(log => {
                            const logDate = parseLocalDate(log.date);
                            return log.is_vim_entry && logDate >= ytdStart && logDate <= ytdEnd;
                          });
                          const ytdVimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                            ytdVimLogs.map(l => l.id).includes(bd.daily_log_id)
                          );
                          let ytdVimCollected = 0;
                          let ytdVimPotential = 0;
                          ytdVimBreakdowns.forEach(bd => {
                            ytdVimCollected += bd.pos_amount || 0;
                            ytdVimPotential += bd.pos_potential || 0;
                          });

                          const pytdVimLogs = filteredLogsByLocation.filter(log => {
                            const logDate = parseLocalDate(log.date);
                            return log.is_vim_entry && logDate >= pytdStart && logDate <= pytdEnd;
                          });
                          const pytdVimBreakdowns = filteredBreakdownsByLocation.filter(bd => 
                            pytdVimLogs.map(l => l.id).includes(bd.daily_log_id)
                          );
                          let pytdVimCollected = 0;
                          let pytdVimPotential = 0;
                          pytdVimBreakdowns.forEach(bd => {
                            pytdVimCollected += bd.pos_amount || 0;
                            pytdVimPotential += bd.pos_potential || 0;
                          });

                          const payerNames = ["Commercial", "Medicare", "SelfPay"];
                          const data = payerNames.map(payer => ({
                            name: payer === "SelfPay" ? "Self Pay" : payer,
                            ytdPotential: metrics.ytd?.payerTotals?.[payer]?.potential || 0,
                            ytdCollected: metrics.ytd?.payerTotals?.[payer]?.collected || 0,
                            pytdPotential: metrics.pytd?.payerTotals?.[payer]?.potential || 0,
                            pytdCollected: metrics.pytd?.payerTotals?.[payer]?.collected || 0
                          }));

                          if (ytdVimCollected > 0 || pytdVimCollected > 0) {
                            data.push({
                              name: "VIM",
                              ytdPotential: ytdVimPotential,
                              ytdCollected: ytdVimCollected,
                              pytdPotential: pytdVimPotential,
                              pytdCollected: pytdVimCollected
                            });
                          }

                          return data;
                        }
                      })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="name" stroke="#475569" />
                      <YAxis stroke="#475569" />
                      <Tooltip 
                        formatter={(value) => `$${value.toFixed(2)}`}
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} 
                      />
                      <Legend />
                      {viewMode === "current" ? (
                        <>
                          <Bar dataKey="potential" name="POS Potential" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="collected" name="Amount Collected" fill="#10b981" radius={[8, 8, 0, 0]} />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="ytdPotential" name="YTD Potential" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="ytdCollected" name="YTD Collected" fill="#10b981" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="pytdPotential" name="PYTD Potential" fill="#fbbf24" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="pytdCollected" name="PYTD Collected" fill="#6ee7b7" radius={[8, 8, 0, 0]} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Single vs Dual Coverage (Commercial & Medicare)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={(() => {
                      if (viewMode === "current") {
                        return ["Commercial", "Medicare"].map(payer => ({
                          name: payer,
                          single: currentMetrics.payerTotals?.[payer]?.single || 0,
                          dual: currentMetrics.payerTotals?.[payer]?.multiple || 0
                        }));
                      } else {
                        return ["Commercial", "Medicare"].map(payer => ({
                          name: payer,
                          ytdSingle: metrics.ytd?.payerTotals?.[payer]?.single || 0,
                          ytdDual: metrics.ytd?.payerTotals?.[payer]?.multiple || 0,
                          pytdSingle: metrics.pytd?.payerTotals?.[payer]?.single || 0,
                          pytdDual: metrics.pytd?.payerTotals?.[payer]?.multiple || 0
                        }));
                      }
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="name" stroke="#475569" />
                      <YAxis stroke="#475569" />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} />
                      <Legend />
                      {viewMode === "current" ? (
                        <>
                          <Bar dataKey="single" name="Single Coverage" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="dual" name="Dual Coverage" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="ytdSingle" name="YTD Single" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="ytdDual" name="YTD Dual" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="pytdSingle" name="PYTD Single" fill="#93c5fd" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="pytdDual" name="PYTD Dual" fill="#c4b5fd" radius={[8, 8, 0, 0]} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Self-Pay: Insurance Conversion vs Financial Assistance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={(() => {
                    if (viewMode === "current") {
                      return [{
                        name: "Self-Pay Outcomes",
                        converted: currentMetrics.selfPayMetrics?.insurance_found || 0,
                        inpatient: currentMetrics.selfPayMetrics?.inpatient_financial_assistance || 0,
                        walkinCallin: currentMetrics.selfPayMetrics?.walkin_callin_financial_assistance || 0
                      }];
                    } else {
                      return [{
                        name: "Self-Pay Outcomes",
                        ytdConverted: metrics.ytd?.selfPayMetrics?.insurance_found || 0,
                        ytdInpatient: metrics.ytd?.selfPayMetrics?.inpatient_financial_assistance || 0,
                        ytdWalkinCallin: metrics.ytd?.selfPayMetrics?.walkin_callin_financial_assistance || 0,
                        pytdConverted: metrics.pytd?.selfPayMetrics?.insurance_found || 0,
                        pytdInpatient: metrics.pytd?.selfPayMetrics?.inpatient_financial_assistance || 0,
                        pytdWalkinCallin: metrics.pytd?.selfPayMetrics?.walkin_callin_financial_assistance || 0
                      }];
                    }
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="name" stroke="#475569" />
                    <YAxis stroke="#475569" />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} />
                    <Legend />
                    {viewMode === "current" ? (
                      <>
                        <Bar dataKey="converted" name="Converted to Insurance" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="inpatient" name="Inpatient FA" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="walkinCallin" name="Walk-In/Call-In FA" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="ytdConverted" name="YTD Converted" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="ytdInpatient" name="YTD Inpatient FA" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="ytdWalkinCallin" name="YTD Walk-In/Call-In FA" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdConverted" name="PYTD Converted" fill="#93c5fd" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdInpatient" name="PYTD Inpatient FA" fill="#fbbf24" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pytdWalkinCallin" name="PYTD Walk-In/Call-In FA" fill="#c4b5fd" radius={[8, 8, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="print-break"></div>

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              <PayerTrendsChart 
                logs={allLogs} 
                breakdowns={allBreakdowns}
                monthsToShow={6}
              />
              <CollectionRateChart 
                logs={allLogs} 
                breakdowns={allBreakdowns}
                monthsToShow={6}
              />
            </div>

            <div className="mt-6">
              <MonthlyUserSummary 
                logs={allLogs}
                breakdowns={allBreakdowns}
                users={users}
                paymentPlans={allPaymentPlans}
                paymentSchedules={allPaymentSchedules}
                walkIns={allWalkIns}
              />
            </div>

            {currentUser?.app_role === "admin" && (
              <div className="mt-6">
                <DailyLogTable 
                  logs={filteredLogsByLocation}
                  breakdowns={filteredBreakdownsByLocation}
                  users={users}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            )}
            </div>
            </div>
            </div>
            </>
            );
            }