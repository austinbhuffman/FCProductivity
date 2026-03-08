import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";
import { format, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { parseLocalDate, calculatePeriodMetrics } from "../utils/dateUtils";

const PAYER_COLORS = {
  Commercial: "#3b82f6",
  Medicare: "#10b981",
  SelfPay: "#8b5cf6"
};

export default function CollectionRateChart({ logs, breakdowns, monthsToShow = 6 }) {
  const generateRateData = () => {
    const endDate = new Date();
    const startDate = subMonths(startOfMonth(endDate), monthsToShow - 1);
    
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    return months.map(monthStart => {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      
      // Calculate non-VIM metrics only
      const nonVimLogs = logs.filter(log => !log.is_vim_entry);
      const metrics = calculatePeriodMetrics(
        breakdowns.filter(bd => nonVimLogs.map(l => l.id).includes(bd.daily_log_id)),
        nonVimLogs,
        monthStart,
        monthEnd,
        false
      );
      
      const commercialRate = metrics.payerTotals?.Commercial?.newPatients > 0
        ? ((metrics.payerTotals.Commercial.paid / metrics.payerTotals.Commercial.newPatients) * 100)
        : 0;
      
      const medicareRate = metrics.payerTotals?.Medicare?.newPatients > 0
        ? ((metrics.payerTotals.Medicare.paid / metrics.payerTotals.Medicare.newPatients) * 100)
        : 0;
      
      const selfPayRate = metrics.payerTotals?.SelfPay?.newPatients > 0
        ? ((metrics.payerTotals.SelfPay.paid / metrics.payerTotals.SelfPay.newPatients) * 100)
        : 0;
      
      return {
        month: format(monthStart, "MMM yyyy"),
        Commercial: commercialRate,
        Medicare: medicareRate,
        SelfPay: selfPayRate
      };
    });
  };

  const data = generateRateData();

  return (
    <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Conversion Rate Trends by Payer (Last {monthsToShow} Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis dataKey="month" stroke="#475569" />
            <YAxis stroke="#475569" label={{ value: '%', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              formatter={(value) => `${value.toFixed(1)}%`}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }}
            />
            <Legend />
            <Line type="monotone" dataKey="Commercial" stroke={PAYER_COLORS.Commercial} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Medicare" stroke={PAYER_COLORS.Medicare} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="SelfPay" stroke={PAYER_COLORS.SelfPay} strokeWidth={2} dot={{ r: 4 }} name="Self Pay" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}