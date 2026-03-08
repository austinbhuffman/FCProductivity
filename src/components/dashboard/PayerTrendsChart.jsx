import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { parseLocalDate, calculatePeriodMetrics } from "../utils/dateUtils";

const PAYER_COLORS = {
  Commercial: "#3b82f6",
  Medicare: "#10b981",
  SelfPay: "#8b5cf6",
  VIM: "#ec4899"
};

export default function PayerTrendsChart({ logs, breakdowns, monthsToShow = 6 }) {
  const generateTrendData = () => {
    const endDate = new Date();
    const startDate = subMonths(startOfMonth(endDate), monthsToShow - 1);
    
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    return months.map(monthStart => {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      
      // Calculate VIM separately
      const vimLogs = logs.filter(log => {
        const logDate = parseLocalDate(log.date);
        return log.is_vim_entry && logDate >= monthStart && logDate <= monthEnd;
      });
      const vimBreakdowns = breakdowns.filter(bd => vimLogs.map(l => l.id).includes(bd.daily_log_id));
      let vimCollected = 0;
      vimBreakdowns.forEach(bd => { vimCollected += bd.pos_amount || 0; });
      
      // Calculate non-VIM metrics
      const nonVimLogs = logs.filter(log => !log.is_vim_entry);
      const metrics = calculatePeriodMetrics(
        breakdowns.filter(bd => nonVimLogs.map(l => l.id).includes(bd.daily_log_id)),
        nonVimLogs,
        monthStart,
        monthEnd,
        false
      );
      
      return {
        month: format(monthStart, "MMM yyyy"),
        Commercial: metrics.payerTotals?.Commercial?.collected || 0,
        Medicare: metrics.payerTotals?.Medicare?.collected || 0,
        SelfPay: metrics.payerTotals?.SelfPay?.collected || 0,
        VIM: vimCollected
      };
    });
  };

  const data = generateTrendData();

  return (
    <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Payer Collection Trends (Last {monthsToShow} Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis dataKey="month" stroke="#475569" />
            <YAxis stroke="#475569" />
            <Tooltip 
              formatter={(value) => `$${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }}
            />
            <Legend />
            <Line type="monotone" dataKey="Commercial" stroke={PAYER_COLORS.Commercial} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Medicare" stroke={PAYER_COLORS.Medicare} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="SelfPay" stroke={PAYER_COLORS.SelfPay} strokeWidth={2} dot={{ r: 4 }} name="Self Pay" />
            <Line type="monotone" dataKey="VIM" stroke={PAYER_COLORS.VIM} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}