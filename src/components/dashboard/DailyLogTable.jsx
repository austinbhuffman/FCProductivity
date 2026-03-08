import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, User, DollarSign, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "../utils/dateUtils";

export default function DailyLogTable({ logs, breakdowns, users, startDate, endDate }) {
  const [selectedUser, setSelectedUser] = useState("all");

  // Filter logs by date range
  const filteredByDate = logs.filter(log => {
    const logDate = parseLocalDate(log.date);
    return logDate >= parseLocalDate(startDate) && logDate <= parseLocalDate(endDate);
  });

  // Filter by user
  const filteredLogs = selectedUser === "all" 
    ? filteredByDate 
    : filteredByDate.filter(log => log.user_id === selectedUser);

  // Sort by date descending
  const sortedLogs = [...filteredLogs].sort((a, b) => 
    parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
  );

  // Get breakdown data for a log
  const getLogBreakdowns = (logId) => {
    return breakdowns.filter(bd => bd.daily_log_id === logId);
  };

  // Calculate totals for a log
  const getLogTotals = (logId) => {
    const logBreakdowns = getLogBreakdowns(logId);
    let totalNewPatients = 0;
    let totalPaid = 0;
    let totalCollected = 0;
    let totalPotential = 0;

    logBreakdowns.forEach(bd => {
      totalNewPatients += bd.new_patients || 0;
      totalPaid += bd.pos_collections_count || 0;
      totalCollected += bd.pos_amount || 0;
      totalPotential += bd.pos_potential || 0;
    });

    return { totalNewPatients, totalPaid, totalCollected, totalPotential };
  };

  return (
    <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Daily Log Details
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-600">Filter by User:</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[180px] bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-300">
                <SelectItem value="all" className="text-slate-900">All Users</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id} className="text-slate-900">
                    {user.display_name || user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedLogs.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No logs found for the selected period</p>
        ) : (
          <div className="space-y-3">
            {sortedLogs.map(log => {
              const totals = getLogTotals(log.id);
              const logBreakdowns = getLogBreakdowns(log.id);
              const conversionRate = totals.totalNewPatients > 0 
                ? ((totals.totalPaid / totals.totalNewPatients) * 100).toFixed(1)
                : '0.0';

              return (
                <div key={log.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <span className="font-semibold text-slate-900">{log.user_name}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {log.is_vim_entry ? 'VIM Entry' : 'Regular'}
                        </span>
                        {log.is_locked && (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseLocalDate(log.date), "MMM dd, yyyy")}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {log.location || 'N/A'}
                        </div>
                      </div>
                      {log.notes && (
                        <p className="text-xs text-slate-600 mt-2 italic">Note: {log.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-600">New Patients</p>
                        <p className="text-lg font-bold text-slate-900">{totals.totalNewPatients}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-600">Paid</p>
                        <p className="text-lg font-bold text-blue-600">{totals.totalPaid}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-600">Collected</p>
                        <p className="text-lg font-bold text-emerald-600">${totals.totalCollected.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-600">Potential</p>
                        <p className="text-lg font-bold text-amber-600">${totals.totalPotential.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-600">Conv. Rate</p>
                        <p className="text-lg font-bold text-purple-600">{conversionRate}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Payer Breakdown Details */}
                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Payer Breakdown:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {logBreakdowns.map((bd, idx) => (
                        <div key={idx} className="bg-white rounded p-2 border border-slate-200">
                          <p className="text-xs font-semibold text-slate-900 mb-1">
                            {bd.payer_type === "SelfPay" ? "Self Pay" : bd.payer_type}
                          </p>
                          <div className="text-xs text-slate-600 space-y-0.5">
                            <div className="flex justify-between">
                              <span>New:</span>
                              <span className="font-semibold">{bd.new_patients || 0}</span>
                            </div>
                            {bd.payer_type !== "SelfPay" && (
                              <>
                                <div className="flex justify-between">
                                  <span>Single/Dual:</span>
                                  <span className="font-semibold">{bd.single_coverage || 0}/{bd.dual_coverage || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Ins. Updates:</span>
                                  <span className="font-semibold">{bd.insurance_updates || 0}</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between">
                              <span>POS Count:</span>
                              <span className="font-semibold">{bd.pos_collections_count || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>POS Amount:</span>
                              <span className="font-semibold text-emerald-600">${(bd.pos_amount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>POS Potential:</span>
                              <span className="font-semibold text-amber-600">${(bd.pos_potential || 0).toFixed(2)}</span>
                            </div>
                            {bd.payer_type === "Medicare" && (
                              <div className="flex justify-between">
                                <span>QMB:</span>
                                <span className="font-semibold">{bd.qmb_screening || 0}/{bd.qmb_enrollments || 0}/{bd.qmb_paperwork || 0}</span>
                              </div>
                            )}
                            {bd.payer_type === "SelfPay" && bd.sp_converted_to_insurance > 0 && (
                              <div className="flex justify-between">
                                <span>Converted:</span>
                                <span className="font-semibold">{bd.sp_converted_to_insurance}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}