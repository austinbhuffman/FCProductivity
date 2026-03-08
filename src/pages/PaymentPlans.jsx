import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  Plus,
  DollarSign,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Ban
} from "lucide-react";
import { format, addMonths, parseISO } from "date-fns";

export default function PaymentPlans() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  const [filterStatus, setFilterStatus] = useState("active");
  
  // Create form state
  const [totalAmount, setTotalAmount] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [numMonths, setNumMonths] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [setupByUserId, setSetupByUserId] = useState("");
  const [notes, setNotes] = useState("");
  
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.app_role !== "admin") {
        setLoading(false);
        return;
      }

      const users = await base44.entities.User.list();
      setAllUsers(users.filter(u => u.active_flag !== false));

      const plans = await base44.entities.PaymentPlan.list("start_date");
      setPaymentPlans(plans);

      const allSchedules = await base44.entities.PaymentPlanSchedule.list("scheduled_date");
      setSchedules(allSchedules);

      // Check for due payments and create notifications
      await checkDuePayments(allSchedules, currentUser);
    } catch (error) {
      console.error("Error loading payment plans:", error);
      setErrorMessage("Error loading payment plans");
    }
    setLoading(false);
  };

  const checkDuePayments = async (allSchedules, currentUser) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const duePayments = allSchedules.filter(
      s => s.scheduled_date === today && s.status === "pending"
    );

    // Get all admin users
    const adminUsers = allUsers.filter(u => u.app_role === "admin");

    for (const payment of duePayments) {
      try {
        // Create notification for each admin user
        for (const admin of adminUsers) {
          // Check if notification already exists for this admin
          const existingNotif = await base44.entities.Notification.filter({
            user_id: admin.id,
            related_log_id: payment.id
          });

          if (existingNotif.length === 0) {
            await base44.entities.Notification.create({
              user_id: admin.id,
              title: "Payment Due Today - Action Required",
              message: `Payment of $${payment.amount.toFixed(2)} is due today. Please mark as paid or failed.`,
              type: "warning",
              related_log_id: payment.id,
              action_url: "/PaymentPlans"
            });
          }
        }
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
      }
    }
  };

  const createPaymentPlan = async () => {
    if (!totalAmount || !monthlyPayment || !numMonths || !startDate || !setupByUserId) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const setupUser = allUsers.find(u => u.id === setupByUserId);
      const total = parseFloat(totalAmount);
      const months = parseInt(numMonths);
      const monthly = parseFloat(monthlyPayment);
      
      // Create payment plan
      const plan = await base44.entities.PaymentPlan.create({
        total_amount: total,
        num_months: months,
        start_date: startDate,
        created_by_user_id: setupUser.id,
        created_by_user_name: setupUser.display_name || setupUser.full_name,
        status: "active",
        notes: notes
      });

      // Create scheduled payments
      const schedulesToCreate = [];
      let amountAllocated = 0;

      for (let i = 0; i < months; i++) {
        const scheduledDate = format(addMonths(parseISO(startDate), i), "yyyy-MM-dd");
        
        // For the last payment, use remaining amount to match total
        const paymentAmount = (i === months - 1) 
          ? total - amountAllocated 
          : monthly;
        
        amountAllocated += paymentAmount;
        
        schedulesToCreate.push({
          payment_plan_id: plan.id,
          scheduled_date: scheduledDate,
          amount: paymentAmount,
          status: "pending"
        });
      }

      for (const schedule of schedulesToCreate) {
        await base44.entities.PaymentPlanSchedule.create(schedule);
      }

      // Log audit trail
      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        action: "create",
        entity_type: "PaymentPlan",
        entity_id: plan.id,
        notes: `Created payment plan: $${total.toFixed(2)} over ${months} months at $${monthly}/month`
      });

      setSuccessMessage("Payment plan created successfully!");
      setShowCreateDialog(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error creating payment plan:", error);
      setErrorMessage("Error creating payment plan");
    }
    setSaving(false);
  };

  const markPaymentStatus = async (schedule, newStatus, notes = "") => {
    if (!window.confirm(`Mark this payment as ${newStatus}?`)) {
      return;
    }

    setSaving(true);
    try {
      await base44.entities.PaymentPlanSchedule.update(schedule.id, {
        status: newStatus,
        marked_by_user_id: user.id,
        marked_by_user_name: user.display_name || user.full_name,
        marked_date: new Date().toISOString(),
        notes: notes
      });

      // Log audit trail
      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        action: "update",
        entity_type: "PaymentPlanSchedule",
        entity_id: schedule.id,
        notes: `Marked payment as ${newStatus}: $${schedule.amount.toFixed(2)}`
      });

      // Check if all payments are successful, mark plan as completed
      const allSchedulesForPlan = schedules.filter(s => s.payment_plan_id === schedule.payment_plan_id);
      const updatedSchedules = allSchedulesForPlan.map(s => 
        s.id === schedule.id ? { ...s, status: newStatus } : s
      );
      
      const allSuccessful = updatedSchedules.every(s => s.status === "successful");
      if (allSuccessful) {
        await base44.entities.PaymentPlan.update(schedule.payment_plan_id, {
          status: "completed"
        });
        setFilterStatus("completed");
      }

      setSuccessMessage(`Payment marked as ${newStatus}`);
      await loadData();
      
      if (selectedPlan?.id === schedule.payment_plan_id) {
        const updatedPlan = await base44.entities.PaymentPlan.filter({ id: schedule.payment_plan_id });
        setSelectedPlan(updatedPlan[0]);
      }
    } catch (error) {
      console.error("Error updating payment status:", error);
      setErrorMessage("Error updating payment status");
    }
    setSaving(false);
  };

  const editPaymentPlan = async () => {
    if (!totalAmount || !monthlyPayment || !numMonths || !startDate) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const total = parseFloat(totalAmount);
      const months = parseInt(numMonths);
      const monthly = parseFloat(monthlyPayment);

      // Update payment plan
      await base44.entities.PaymentPlan.update(selectedPlan.id, {
        total_amount: total,
        num_months: months,
        start_date: startDate,
        notes: notes
      });

      // Delete old schedules
      const oldSchedules = getPlanSchedules(selectedPlan.id);
      for (const schedule of oldSchedules) {
        await base44.entities.PaymentPlanSchedule.delete(schedule.id);
      }

      // Create new scheduled payments
      const schedulesToCreate = [];
      let amountAllocated = 0;

      for (let i = 0; i < months; i++) {
        const scheduledDate = format(addMonths(parseISO(startDate), i), "yyyy-MM-dd");
        const paymentAmount = (i === months - 1) ? total - amountAllocated : monthly;
        amountAllocated += paymentAmount;
        
        schedulesToCreate.push({
          payment_plan_id: selectedPlan.id,
          scheduled_date: scheduledDate,
          amount: paymentAmount,
          status: "pending"
        });
      }

      for (const schedule of schedulesToCreate) {
        await base44.entities.PaymentPlanSchedule.create(schedule);
      }

      // Log audit trail
      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        action: "update",
        entity_type: "PaymentPlan",
        entity_id: selectedPlan.id,
        notes: `Updated payment plan: $${total.toFixed(2)} over ${months} months at $${monthly}/month`
      });

      setSuccessMessage("Payment plan updated successfully!");
      setShowEditDialog(false);
      await loadData();
      
      const updatedPlan = await base44.entities.PaymentPlan.filter({ id: selectedPlan.id });
      setSelectedPlan(updatedPlan[0]);
    } catch (error) {
      console.error("Error updating payment plan:", error);
      setErrorMessage("Error updating payment plan");
    }
    setSaving(false);
  };

  const deletePaymentPlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this payment plan? This action cannot be undone.")) {
      return;
    }

    setSaving(true);
    try {
      // Delete all schedules first
      const planSchedules = getPlanSchedules(planId);
      for (const schedule of planSchedules) {
        await base44.entities.PaymentPlanSchedule.delete(schedule.id);
      }

      // Delete the plan
      await base44.entities.PaymentPlan.delete(planId);

      // Log audit trail
      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        action: "delete",
        entity_type: "PaymentPlan",
        entity_id: planId,
        notes: "Deleted payment plan"
      });

      setSuccessMessage("Payment plan deleted");
      await loadData();
      setShowDetailsDialog(false);
    } catch (error) {
      console.error("Error deleting payment plan:", error);
      setErrorMessage("Error deleting payment plan");
    }
    setSaving(false);
  };

  const changePaymentPlanStatus = async (planId, newStatus) => {
    if (!window.confirm(`Change payment plan status to ${newStatus}?`)) {
      return;
    }

    setSaving(true);
    try {
      await base44.entities.PaymentPlan.update(planId, {
        status: newStatus
      });

      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        action: "update",
        entity_type: "PaymentPlan",
        entity_id: planId,
        notes: `Changed payment plan status to ${newStatus}`
      });

      setSuccessMessage(`Payment plan status changed to ${newStatus}`);
      setFilterStatus(newStatus);
      await loadData();
      
      if (selectedPlan?.id === planId) {
        const updatedPlan = await base44.entities.PaymentPlan.filter({ id: planId });
        setSelectedPlan(updatedPlan[0]);
      }
    } catch (error) {
      console.error("Error changing payment plan status:", error);
      setErrorMessage("Error changing payment plan status");
    }
    setSaving(false);
  };

  const cancelPaymentPlan = async (planId) => {
    if (!window.confirm("Are you sure you want to cancel this payment plan?")) {
      return;
    }

    setSaving(true);
    try {
      await base44.entities.PaymentPlan.update(planId, {
        status: "cancelled"
      });

      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        action: "update",
        entity_type: "PaymentPlan",
        entity_id: planId,
        notes: "Cancelled payment plan"
      });

      setSuccessMessage("Payment plan cancelled");
      await loadData();
      setShowDetailsDialog(false);
    } catch (error) {
      console.error("Error cancelling payment plan:", error);
      setErrorMessage("Error cancelling payment plan");
    }
    setSaving(false);
  };

  const resetForm = () => {
    setTotalAmount("");
    setMonthlyPayment("");
    setNumMonths("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setSetupByUserId("");
    setNotes("");
  };

  const getStatistics = () => {
    const activePlans = paymentPlans.filter(p => p.status === "active");
    const completedPlans = paymentPlans.filter(p => p.status === "completed");
    
    let totalCollected = 0;
    let totalPending = 0;
    
    schedules.forEach(s => {
      if (s.status === "successful") {
        totalCollected += s.amount || 0;
      } else if (s.status === "pending") {
        totalPending += s.amount || 0;
      }
    });

    return {
      activePlans: activePlans.length,
      completedPlans: completedPlans.length,
      totalCollected,
      totalPending
    };
  };

  const getPlanSchedules = (planId) => {
    return schedules.filter(s => s.payment_plan_id === planId);
  };

  const getPlanStats = (plan) => {
    const planSchedules = getPlanSchedules(plan.id);
    const collected = planSchedules
      .filter(s => s.status === "successful")
      .reduce((sum, s) => sum + (s.amount || 0), 0);
    const remaining = plan.total_amount - collected;
    
    return { collected, remaining };
  };

  const getFilteredPlans = (status) => {
    return paymentPlans
      .filter(p => p.status === status)
      .sort((a, b) => {
        const nextA = getNextPaymentDate(a.id);
        const nextB = getNextPaymentDate(b.id);
        if (!nextA && !nextB) return 0;
        if (!nextA) return 1;
        if (!nextB) return -1;
        return nextA.scheduled_date.localeCompare(nextB.scheduled_date);
      });
  };

  const getNextPaymentDate = (planId) => {
    const planSchedules = getPlanSchedules(planId)
      .filter(s => s.status === "pending")
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    return planSchedules[0] || null;
  };

  const stats = getStatistics();

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

  if (user?.app_role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Access denied. Only administrators can view payment plans.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Payment Plans</h1>
            <p className="text-slate-600 mt-1">Manage and track payment plan collections</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Payment Plan
          </Button>
        </div>

        {successMessage && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Active Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.activePlans}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Completed Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{stats.completedPlans}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">${stats.totalCollected.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">${stats.totalPending.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-slate-900">Payment Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="active">Active ({getFilteredPlans("active").length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({getFilteredPlans("completed").length})</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled ({getFilteredPlans("cancelled").length})</TabsTrigger>
              </TabsList>

              {["active", "completed", "cancelled"].map((status) => {
                const plans = getFilteredPlans(status);
                return (
                  <TabsContent key={status} value={status}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Start Date</TableHead>
                          <TableHead>Created On</TableHead>
                          <TableHead>Total Amount</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Collected</TableHead>
                          <TableHead>Remaining</TableHead>
                          <TableHead>Next Payment</TableHead>
                          <TableHead>Setup By</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plans.map(plan => {
                          const { collected, remaining } = getPlanStats(plan);
                          return (
                            <TableRow key={plan.id}>
                              <TableCell className="font-semibold">{format(parseISO(plan.start_date), "MMM d, yyyy")}</TableCell>
                              <TableCell className="text-slate-600 text-sm">{format(new Date(plan.created_date), "MMM d, yyyy")}</TableCell>
                              <TableCell className="font-semibold">${plan.total_amount.toFixed(2)}</TableCell>
                              <TableCell>{plan.num_months} months</TableCell>
                              <TableCell className="text-emerald-600 font-semibold">${collected.toFixed(2)}</TableCell>
                              <TableCell className="text-amber-600">${remaining.toFixed(2)}</TableCell>
                              <TableCell>
                                {(() => {
                                  const next = getNextPaymentDate(plan.id);
                                  if (!next) return <span className="text-slate-400 text-sm">—</span>;
                                  const today = format(new Date(), "yyyy-MM-dd");
                                  const isOverdue = next.scheduled_date < today;
                                  return (
                                    <span className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                                      {format(parseISO(next.scheduled_date), "MMM d, yyyy")}
                                      {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>{plan.created_by_user_name}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedPlan(plan);
                                    setShowDetailsDialog(true);
                                  }}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {plans.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                              No {status} payment plans found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Create Payment Plan Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="bg-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Create Payment Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total-amount" className="text-slate-700">Total Amount *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">$</span>
                    <Input
                      id="total-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly-payment" className="text-slate-700">Monthly Payment *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">$</span>
                    <Input
                      id="monthly-payment"
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlyPayment}
                      onChange={(e) => setMonthlyPayment(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="num-months" className="text-slate-700">Number of Months *</Label>
                  <Input
                    id="num-months"
                    type="number"
                    min="1"
                    value={numMonths}
                    onChange={(e) => setNumMonths(e.target.value)}
                    placeholder="12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-slate-700">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="setup-by" className="text-slate-700">Setup By *</Label>
                <Select value={setupByUserId} onValueChange={setSetupByUserId}>
                  <SelectTrigger id="setup-by">
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

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-700">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this payment plan"
                  rows={3}
                />
              </div>

              {totalAmount && monthlyPayment && numMonths && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-700">
                    Regular payments: <span className="font-bold text-blue-600">
                      ${parseFloat(monthlyPayment).toFixed(2)} × {parseInt(numMonths) - 1} months
                    </span>
                  </p>
                  <p className="text-sm text-slate-700 mt-1">
                    Final payment: <span className="font-bold text-blue-600">
                      ${(parseFloat(totalAmount) - (parseFloat(monthlyPayment) * (parseInt(numMonths) - 1))).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Last payment adjusted to match total amount
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={createPaymentPlan} disabled={saving}>
                {saving ? "Creating..." : "Create Payment Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Payment Plan Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="bg-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Edit Payment Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-total-amount" className="text-slate-700">Total Amount *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">$</span>
                    <Input
                      id="edit-total-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-monthly-payment" className="text-slate-700">Monthly Payment *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">$</span>
                    <Input
                      id="edit-monthly-payment"
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlyPayment}
                      onChange={(e) => setMonthlyPayment(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-num-months" className="text-slate-700">Number of Months *</Label>
                  <Input
                    id="edit-num-months"
                    type="number"
                    min="1"
                    value={numMonths}
                    onChange={(e) => setNumMonths(e.target.value)}
                    placeholder="12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-start-date" className="text-slate-700">Start Date *</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes" className="text-slate-700">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this payment plan"
                  rows={3}
                />
              </div>

              {totalAmount && monthlyPayment && numMonths && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-700">
                    Regular payments: <span className="font-bold text-blue-600">
                      ${parseFloat(monthlyPayment).toFixed(2)} × {parseInt(numMonths) - 1} months
                    </span>
                  </p>
                  <p className="text-sm text-slate-700 mt-1">
                    Final payment: <span className="font-bold text-blue-600">
                      ${(parseFloat(totalAmount) - (parseFloat(monthlyPayment) * (parseInt(numMonths) - 1))).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Last payment adjusted to match total amount
                  </p>
                </div>
              )}

              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Editing will replace all existing payment schedules with new ones.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={editPaymentPlan} disabled={saving}>
                {saving ? "Updating..." : "Update Payment Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Plan Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="bg-white max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Payment Plan Details</DialogTitle>
            </DialogHeader>
            {selectedPlan && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Total Amount</p>
                    <p className="text-xl font-bold text-slate-900">${selectedPlan.total_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Duration</p>
                    <p className="text-xl font-bold text-slate-900">{selectedPlan.num_months} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Start Date</p>
                    <p className="text-xl font-bold text-slate-900">
                      {format(parseISO(selectedPlan.start_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Setup By</p>
                    <p className="text-xl font-bold text-slate-900">{selectedPlan.created_by_user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Collected</p>
                    <p className="text-xl font-bold text-emerald-600">
                      ${getPlanStats(selectedPlan).collected.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Remaining</p>
                    <p className="text-xl font-bold text-amber-600">
                      ${getPlanStats(selectedPlan).remaining.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <Label className="text-sm text-slate-600 mb-2 block">Change Status</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => changePaymentPlanStatus(selectedPlan.id, "active")}
                      disabled={saving || selectedPlan.status === "active"}
                      className={selectedPlan.status === "active" ? "bg-blue-600" : ""}
                    >
                      Active
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => changePaymentPlanStatus(selectedPlan.id, "completed")}
                      disabled={saving || selectedPlan.status === "completed"}
                      className={selectedPlan.status === "completed" ? "bg-emerald-600" : ""}
                    >
                      Completed
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => changePaymentPlanStatus(selectedPlan.id, "cancelled")}
                      disabled={saving || selectedPlan.status === "cancelled"}
                      className={selectedPlan.status === "cancelled" ? "bg-slate-600" : ""}
                    >
                      Cancelled
                    </Button>
                  </div>
                </div>

                {selectedPlan.notes && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Notes</p>
                    <p className="text-slate-900">{selectedPlan.notes}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Schedule</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Marked By</TableHead>
                        <TableHead>Marked Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPlanSchedules(selectedPlan.id).map(schedule => (
                        <TableRow key={schedule.id}>
                          <TableCell>{format(parseISO(schedule.scheduled_date), "MMM d, yyyy")}</TableCell>
                          <TableCell className="font-semibold">${schedule.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`flex items-center gap-1 text-sm font-medium ${
                              schedule.status === "successful" ? "text-emerald-600" :
                              schedule.status === "failed" ? "text-red-600" :
                              "text-amber-600"
                            }`}>
                              {schedule.status === "successful" && <CheckCircle className="w-4 h-4" />}
                              {schedule.status === "failed" && <XCircle className="w-4 h-4" />}
                              {schedule.status === "pending" && <Clock className="w-4 h-4" />}
                              {schedule.status}
                            </span>
                          </TableCell>
                          <TableCell>{schedule.marked_by_user_name || "-"}</TableCell>
                          <TableCell>
                            {schedule.marked_date ? format(new Date(schedule.marked_date), "MMM d, yyyy h:mm a") : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {schedule.status !== "successful" && (
                                <Button
                                  size="sm"
                                  onClick={() => markPaymentStatus(schedule, "successful")}
                                  disabled={saving}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  Success
                                </Button>
                              )}
                              {schedule.status !== "failed" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => markPaymentStatus(schedule, "failed")}
                                  disabled={saving}
                                >
                                  Failed
                                </Button>
                              )}
                              {schedule.status !== "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markPaymentStatus(schedule, "pending")}
                                  disabled={saving}
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => deletePaymentPlan(selectedPlan.id)}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Delete Payment Plan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTotalAmount(selectedPlan.total_amount.toString());
                      setNumMonths(selectedPlan.num_months.toString());
                      setStartDate(selectedPlan.start_date);
                      setNotes(selectedPlan.notes || "");
                      const firstSchedule = getPlanSchedules(selectedPlan.id)[0];
                      if (firstSchedule) {
                        setMonthlyPayment(firstSchedule.amount.toString());
                      }
                      setShowEditDialog(true);
                    }}
                    disabled={saving}
                  >
                    Edit Plan
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}