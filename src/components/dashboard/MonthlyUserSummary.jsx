import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, TrendingUp, Users, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { parseLocalDate, calculatePeriodMetrics } from "../utils/dateUtils";

export default function MonthlyUserSummary({ logs, breakdowns, users, paymentPlans, paymentSchedules, walkIns }) {
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.
  
  const getMonthData = () => {
    const targetDate = subMonths(new Date(), selectedMonth);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    
    // Filter out VIM entries from user stats
    const nonVimLogs = logs.filter(log => !log.is_vim_entry);
    const monthLogs = nonVimLogs.filter(log => {
      const logDate = parseLocalDate(log.date);
      return logDate >= monthStart && logDate <= monthEnd;
    });
    
    const monthBreakdowns = breakdowns.filter(bd => 
      monthLogs.map(l => l.id).includes(bd.daily_log_id)
    );

    const monthWalkIns = (walkIns || []).filter(wi => 
      monthLogs.map(l => l.id).includes(wi.daily_log_id)
    );
    
    const userStats = {};
    
    monthBreakdowns.forEach(bd => {
      const log = monthLogs.find(l => l.id === bd.daily_log_id);
      if (log) {
        if (!userStats[log.user_id]) {
          userStats[log.user_id] = {
            userId: log.user_id,
            userName: log.user_name,
            newPatients: 0,
            paid: 0,
            collected: 0,
            paymentPlanCollected: 0,
            daysWorked: new Set()
          };
        }
        userStats[log.user_id].newPatients += bd.new_patients || 0;
        userStats[log.user_id].paid += bd.pos_collections_count || 0;
        userStats[log.user_id].collected += bd.pos_amount || 0;
        userStats[log.user_id].daysWorked.add(log.date);
      }
    });

    // Add walk-in collections to user stats
    monthWalkIns.forEach(wi => {
      const log = monthLogs.find(l => l.id === wi.daily_log_id);
      if (log) {
        if (!userStats[log.user_id]) {
          userStats[log.user_id] = {
            userId: log.user_id,
            userName: log.user_name,
            newPatients: 0,
            paid: 0,
            collected: 0,
            paymentPlanCollected: 0,
            daysWorked: new Set()
          };
        }
        userStats[log.user_id].collected += wi.pos_amount || 0;
      }
    });
    
    // Add payment plan collections
    paymentSchedules.forEach(schedule => {
      if (schedule.status === "successful") {
        const scheduleDate = parseLocalDate(schedule.scheduled_date);
        if (scheduleDate >= monthStart && scheduleDate <= monthEnd) {
          const plan = paymentPlans.find(p => p.id === schedule.payment_plan_id);
          if (plan) {
            if (!userStats[plan.created_by_user_id]) {
              userStats[plan.created_by_user_id] = {
                userId: plan.created_by_user_id,
                userName: plan.created_by_user_name,
                newPatients: 0,
                paid: 0,
                collected: 0,
                paymentPlanCollected: 0,
                daysWorked: new Set()
              };
            }
            userStats[plan.created_by_user_id].paymentPlanCollected += schedule.amount || 0;
            userStats[plan.created_by_user_id].collected += schedule.amount || 0;
          }
        }
      }
    });
    
    // Convert Set to count
    Object.values(userStats).forEach(stat => {
      stat.daysWorked = stat.daysWorked.size;
    });
    
    return {
      monthName: format(monthStart, "MMMM yyyy"),
      stats: Object.values(userStats).sort((a, b) => b.collected - a.collected)
    };
  };
  
  const monthData = getMonthData();
  
  const monthOptions = [
    { value: 0, label: format(new Date(), "MMMM yyyy") },
    { value: 1, label: format(subMonths(new Date(), 1), "MMMM yyyy") },
    { value: 2, label: format(subMonths(new Date(), 2), "MMMM yyyy") },
    { value: 3, label: format(subMonths(new Date(), 3), "MMMM yyyy") },
    { value: 4, label: format(subMonths(new Date(), 4), "MMMM yyyy") },
    { value: 5, label: format(subMonths(new Date(), 5), "MMMM yyyy") }
  ];
  
  return (
    <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Monthly User Performance Summary
          </CardTitle>
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[200px] bg-white border-slate-300 text-slate-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-300">
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value.toString()} className="text-slate-900">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {monthData.stats.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No data available for {monthData.monthName}</p>
        ) : (
          <div className="space-y-3">
            {monthData.stats.map((stat, index) => (
              <div key={stat.userId} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-amber-500 text-white' :
                      index === 1 ? 'bg-slate-400 text-slate-900' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{stat.userName}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Users className="w-3 h-3" />
                          <span>{stat.newPatients} new</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <TrendingUp className="w-3 h-3" />
                          <span>{stat.newPatients > 0 ? ((stat.paid / stat.newPatients) * 100).toFixed(1) : 0}% conv.</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <DollarSign className="w-3 h-3" />
                          <span>${stat.collected.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          <span>{stat.daysWorked} days</span>
                        </div>
                      </div>
                      {stat.paymentPlanCollected > 0 && (
                        <p className="text-xs text-purple-600 mt-1">
                          Payment Plans: ${stat.paymentPlanCollected.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-600">${stat.collected.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">total collected</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}