
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function DailyReportGenerator() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  const generateUserReport = (user, logs, breakdowns) => {
    const userLogs = logs.filter(log => log.user_id === user.id);
    const todayLog = userLogs.length > 0 ? userLogs[0] : null;

    if (!todayLog) {
      return {
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
            <div style="background: linear-gradient(to right, #3b82f6, #2563eb); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">Daily Performance Report</h1>
              <p style="color: #e0e7ff; margin: 5px 0 0 0;">${format(new Date(), 'MMMM dd, yyyy')}</p>
            </div>
            
            <div style="background: #f8fafc; padding: 30px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hi ${user.display_name || user.full_name}! 👋</h2>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin: 20px 0;">
                <strong style="color: #92400e; font-size: 16px;">No Log Submitted</strong>
                <p style="color: #78350f; margin: 10px 0 0 0;">You haven't submitted a log for today yet. Please submit your daily log to track your performance.</p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 30px; text-align: center;">
                Remember to log your daily activities! 📝
              </p>
            </div>
            
            <div style="background: #1e293b; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">FC Productivity Tracker</p>
            </div>
          </div>
        `,
        hasData: false
      };
    }

    const logBreakdowns = breakdowns.filter(bd => bd.daily_log_id === todayLog.id);
    
    let totalSeen = 0;
    let totalPaid = 0;
    let totalCollected = 0;
    let totalPotential = 0;
    const payerStats = {};
    const selfPayMetrics = { insurance_found: 0, inpatient_financial_assistance: 0, walkin_callin_financial_assistance: 0 };
    const medicareMetrics = { qmb_screening: 0, qmb_enrollments: 0, qmb_paperwork: 0 };

    logBreakdowns.forEach(bd => {
      const seen = (bd.new_patients || 0) + (bd.patients_called || 0) + (bd.room_visits || 0) + (bd.walk_ins || 0);
      totalSeen += seen;
      totalPaid += bd.pos_collections_count || 0;
      totalCollected += bd.pos_amount || 0;
      totalPotential += bd.pos_potential || 0;

      if (!payerStats[bd.payer_type]) {
        payerStats[bd.payer_type] = {
          seen: 0,
          paid: 0,
          collected: 0,
          potential: 0,
          single: 0,
          multiple: 0
        };
      }

      payerStats[bd.payer_type].seen += seen;
      payerStats[bd.payer_type].paid += bd.pos_collections_count || 0;
      payerStats[bd.payer_type].collected += bd.pos_amount || 0;
      payerStats[bd.payer_type].potential += bd.pos_potential || 0;

      if (bd.payer_type === "Medicare" || bd.payer_type === "Commercial") {
        payerStats[bd.payer_type].single += bd.single_coverage || 0;
        payerStats[bd.payer_type].multiple += bd.dual_coverage || 0;
      }

      if (bd.payer_type === "Medicare") {
        medicareMetrics.qmb_screening += bd.qmb_screening || 0;
        medicareMetrics.qmb_enrollments += bd.qmb_enrollments || 0;
        medicareMetrics.qmb_paperwork += bd.qmb_paperwork || 0;
      }

      if (bd.payer_type === "SelfPay") {
        selfPayMetrics.insurance_found += bd.sp_converted_to_insurance || 0;
        selfPayMetrics.inpatient_financial_assistance += bd.inpatient_financial_assistance || 0;
        selfPayMetrics.walkin_callin_financial_assistance += bd.walkin_callin_financial_assistance || 0;
      }
    });

    const conversionRate = totalSeen > 0 ? ((totalPaid / totalSeen) * 100).toFixed(1) : 0;
    const spSeen = payerStats?.SelfPay?.seen || 0;
    const spConversionRate = spSeen > 0 ? ((selfPayMetrics.insurance_found / spSeen) * 100).toFixed(1) : 0;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(to right, #3b82f6, #2563eb); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Daily Performance Report</h1>
          <p style="color: #e0e7ff; margin: 5px 0 0 0;">${format(new Date(), 'MMMM dd, yyyy')}</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hi ${user.display_name || user.full_name}! 👋</h2>
          <p style="color: #475569;">Here's your complete performance summary for today:</p>
          
          <!-- Main Stats -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="color: #64748b; font-size: 12px; margin: 0;">LOCATION</p>
              <p style="color: #1e293b; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${todayLog.location || 'N/A'}</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="color: #64748b; font-size: 12px; margin: 0;">TOTAL PATIENTS</p>
              <p style="color: #3b82f6; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${totalSeen}</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="color: #64748b; font-size: 12px; margin: 0;">CONVERSION RATE</p>
              <p style="color: #8b5cf6; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${conversionRate}%</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="color: #64748b; font-size: 12px; margin: 0;">PATIENTS PAID</p>
              <p style="color: #10b981; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${totalPaid}</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); grid-column: span 2;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">TOTAL COLLECTED</p>
              <p style="color: #059669; font-size: 28px; font-weight: bold; margin: 5px 0 0 0;">$${totalCollected.toFixed(2)}</p>
            </div>
          </div>

          <!-- Self-Pay Metrics -->
          ${(selfPayMetrics.insurance_found > 0 || selfPayMetrics.inpatient_financial_assistance > 0 || selfPayMetrics.walkin_callin_financial_assistance > 0) ? `
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1e293b; margin: 0 0 15px 0;">Self-Pay Metrics</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
                <div style="background: #dbeafe; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #1e40af; font-size: 11px; font-weight: 600; margin: 0;">SP CONVERTED</p>
                  <p style="color: #1e40af; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${selfPayMetrics.insurance_found}</p>
                </div>
                <div style="background: #fef3c7; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #92400e; font-size: 11px; font-weight: 600; margin: 0;">INPATIENT FA</p>
                  <p style="color: #92400e; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${selfPayMetrics.inpatient_financial_assistance}</p>
                </div>
                <div style="background: #e9d5ff; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #6b21a8; font-size: 11px; font-weight: 600; margin: 0;">WALK-IN/CALL-IN FA</p>
                  <p style="color: #6b21a8; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${selfPayMetrics.walkin_callin_financial_assistance}</p>
                </div>
                <div style="background: #d1fae5; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #065f46; font-size: 11px; font-weight: 600; margin: 0;">CONVERSION RATE</p>
                  <p style="color: #065f46; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${spConversionRate}%</p>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Medicare QMB Metrics -->
          ${(medicareMetrics.qmb_screening > 0 || medicareMetrics.qmb_enrollments > 0 || medicareMetrics.qmb_paperwork > 0) ? `
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1e293b; margin: 0 0 15px 0;">Medicare QMB Metrics</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div style="background: #d1fae5; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #065f46; font-size: 11px; font-weight: 600; margin: 0;">QMB SCREENING</p>
                  <p style="color: #065f46; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${medicareMetrics.qmb_screening}</p>
                </div>
                <div style="background: #dbeafe; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #1e40af; font-size: 11px; font-weight: 600; margin: 0;">QMB ENROLLMENTS</p>
                  <p style="color: #1e40af; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${medicareMetrics.qmb_enrollments}</p>
                </div>
                <div style="background: #e9d5ff; border-radius: 6px; padding: 15px; text-align: center;">
                  <p style="color: #6b21a8; font-size: 11px; font-weight: 600; margin: 0;">QMB PAPERWORK</p>
                  <p style="color: #6b21a8; font-size: 22px; font-weight: bold; margin: 5px 0 0 0;">${medicareMetrics.qmb_paperwork}</p>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Payer Breakdown -->
          ${Object.keys(payerStats).length > 0 ? `
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1e293b; margin: 0 0 15px 0;">Payer Breakdown</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; text-align: left; color: #475569; font-size: 12px;">PAYER</th>
                    <th style="padding: 10px; text-align: center; color: #475569; font-size: 12px;">SEEN</th>
                    <th style="padding: 10px; text-align: center; color: #475569; font-size: 12px;">PAID</th>
                    <th style="padding: 10px; text-align: right; color: #475569; font-size: 12px;">COLLECTED</th>
                    <th style="padding: 10px; text-align: right; color: #475569; font-size: 12px;">POTENTIAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(payerStats).map(([payer, stats]) => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 12px; font-weight: 600; color: #1e293b;">${payer === 'SelfPay' ? 'Self Pay' : payer}</td>
                      <td style="padding: 12px; text-align: center; color: #3b82f6; font-weight: 600;">${stats.seen}</td>
                      <td style="padding: 12px; text-align: center; color: #10b981; font-weight: 600;">${stats.paid}</td>
                      <td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">$${stats.collected.toFixed(2)}</td>
                      <td style="padding: 12px; text-align: right; color: #f59e0b; font-weight: 600;">$${stats.potential.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Insurance Coverage -->
          ${(payerStats.Commercial || payerStats.Medicare) ? `
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1e293b; margin: 0 0 15px 0;">Insurance Coverage Split</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; text-align: left; color: #475569; font-size: 12px;">PAYER</th>
                    <th style="padding: 10px; text-align: center; color: #475569; font-size: 12px;">SINGLE</th>
                    <th style="padding: 10px; text-align: center; color: #475569; font-size: 12px;">DUAL</th>
                    <th style="padding: 10px; text-align: center; color: #475569; font-size: 12px;">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${payerStats.Commercial ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 12px; font-weight: 600; color: #1e293b;">Commercial</td>
                      <td style="padding: 12px; text-align: center; color: #3b82f6; font-weight: 600;">${payerStats.Commercial.single}</td>
                      <td style="padding: 12px; text-align: center; color: #8b5cf6; font-weight: 600;">${payerStats.Commercial.multiple}</td>
                      <td style="padding: 12px; text-align: center; color: #1e293b; font-weight: 600;">${payerStats.Commercial.single + payerStats.Commercial.multiple}</td>
                    </tr>
                  ` : ''}
                  ${payerStats.Medicare ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 12px; font-weight: 600; color: #1e293b;">Medicare</td>
                      <td style="padding: 12px; text-align: center; color: #3b82f6; font-weight: 600;">${payerStats.Medicare.single}</td>
                      <td style="padding: 12px; text-align: center; color: #8b5cf6; font-weight: 600;">${payerStats.Medicare.multiple}</td>
                      <td style="padding: 12px; text-align: center; color: #1e293b; font-weight: 600;">${payerStats.Medicare.single + payerStats.Medicare.multiple}</td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Notes -->
          ${todayLog.notes ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <strong style="color: #92400e;">Your Notes:</strong>
              <p style="color: #78350f; margin: 5px 0 0 0;">${todayLog.notes}</p>
            </div>
          ` : ''}

          <p style="color: #64748b; font-size: 14px; margin-top: 30px; text-align: center;">
            Great work today! Keep up the excellent performance. 🎯
          </p>
        </div>
        
        <div style="background: #1e293b; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #94a3b8; margin: 0; font-size: 12px;">FC Productivity Tracker</p>
        </div>
      </div>
    `;

    return { html, hasData: true };
  };

  const sendDailyReports = async () => {
    setSending(true);
    setMessage(null);

    try {
      const users = await base44.entities.User.list();
      const activeUsers = users.filter(u => u.active_flag !== false);
      
      const todayDate = format(new Date(), "yyyy-MM-dd");
      // Fetch all logs for today, regardless of submission status, to generate reports/reminders
      const allLogs = await base44.entities.DailyLog.filter({ date: todayDate });
      const allBreakdowns = await base44.entities.PayerBreakdown.list();

      let sentCount = 0;
      let skippedCount = 0;

      for (const user of activeUsers) {
        try {
          const report = generateUserReport(user, allLogs, allBreakdowns);
          
          await base44.integrations.Core.SendEmail({
            from_name: "FC Productivity Tracker",
            to: user.email,
            subject: `Daily Report - ${format(new Date(), 'MMMM dd, yyyy')}`,
            body: report.html
          });

          sentCount++;
        } catch (error) {
          console.error(`Error sending email to ${user.email}:`, error);
          skippedCount++;
        }
      }

      setMessage({
        type: "success",
        text: `Successfully sent ${sentCount} reports to all active users! ${skippedCount > 0 ? `(${skippedCount} failed)` : ''}`
      });
    } catch (error) {
      console.error("Error sending daily reports:", error);
      setMessage({
        type: "error",
        text: "Error sending daily reports. Please try again."
      });
    }

    setSending(false);
  };

  return (
    <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Daily Report Emails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Send comprehensive end-of-day performance reports to all active team members. Users who submitted logs will receive their full stats, while others will receive a reminder to submit.
        </p>

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

        <Button
          onClick={sendDailyReports}
          disabled={sending}
          className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending Reports...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Send Daily Reports to All Active Users
            </>
          )}
        </Button>

        <p className="text-xs text-slate-500 text-center">
          Sends to all active users - those with logs get full stats, others get a reminder
        </p>
      </CardContent>
    </Card>
  );
}