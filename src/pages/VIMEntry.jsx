import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Send,
  AlertCircle,
  CheckCircle,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";

export default function VIMEntry() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayLog, setTodayLog] = useState(null);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [location, setLocation] = useState("RMC");
  const [vimCollections, setVimCollections] = useState(0);
  const [vimAmount, setVimAmount] = useState(0);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [date, location]);

  const loadData = async () => {
    setLoading(true);
    setSuccessMessage("");
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.can_access_vim) {
        setLoading(false);
        return;
      }

      // Load existing VIM log for this date and location
      const logs = await base44.entities.DailyLog.filter({ 
        user_id: currentUser.id, 
        date: date,
        location: location,
        is_vim_entry: true
      });

      if (logs.length > 0) {
        const log = logs[0];
        setTodayLog(log);

        // Load breakdown data
        const breakdowns = await base44.entities.PayerBreakdown.filter({ 
          daily_log_id: log.id 
        });

        let totalCollections = 0;
        let totalAmount = 0;

        breakdowns.forEach(bd => {
          totalCollections += bd.pos_collections_count || 0;
          totalAmount += bd.pos_amount || 0;
        });

        setVimCollections(totalCollections);
        setVimAmount(totalAmount);
      } else {
        setTodayLog(null);
        setVimCollections(0);
        setVimAmount(0);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const saveLog = async () => {
    if (!location) {
      setErrors({ location: ["Please select a location."] });
      return;
    }

    setSaving(true);
    setSuccessMessage("");
    setErrors({});

    try {
      let logId = todayLog?.id;
      const logData = {
        user_id: user.id,
        user_name: user.display_name || user.full_name,
        date: date,
        location: location,
        notes: "Virtual Intake Manager Collections",
        status: "submitted",
        is_vim_entry: true
      };

      if (todayLog) {
        await base44.entities.DailyLog.update(todayLog.id, logData);
        logId = todayLog.id;
      } else {
        const newLog = await base44.entities.DailyLog.create(logData);
        logId = newLog.id;
        setTodayLog(newLog);
      }

      // Delete existing breakdowns
      const existingBreakdowns = await base44.entities.PayerBreakdown.filter({ 
        daily_log_id: logId 
      });
      for (const bd of existingBreakdowns) {
        await base44.entities.PayerBreakdown.delete(bd.id);
      }

      // Create a single breakdown entry with the VIM data
      // Using "Commercial" as the payer type but it's really just VIM collections
      await base44.entities.PayerBreakdown.create({
        daily_log_id: logId,
        payer_type: "Commercial",
        new_patients: 0,
        patients_called: 0,
        room_visits: 0,
        patients_not_seen: 0,
        walk_ins: 0,
        pos_collections_count: vimCollections || 0,
        pos_amount: vimAmount || 0,
        pos_potential: 0,
        single_coverage: 0,
        dual_coverage: 0,
        insurance_updates: 0
      });

      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      
      setSuccessMessage(`✓ VIM entry for ${format(localDate, "MMM dd, yyyy")} saved successfully!`);
      alert(`Success! VIM entry for ${format(localDate, "MMM dd, yyyy")} has been saved.`);
      
      await loadData();
    } catch (error) {
      console.error("Error saving VIM entry:", error);
      alert(`Error saving VIM entry: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <Skeleton className="h-12 w-64 bg-slate-200" />
        <Skeleton className="h-32 bg-slate-200" />
      </div>
    );
  }

  if (!user || !user.can_access_vim) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You don't have access to VIM entry. Contact an administrator to enable this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [year, month, day] = date.split('-').map(Number);
  const displayDate = new Date(year, month - 1, day);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">VIM Entry</h1>
          <p className="text-slate-600 mt-1">Virtual Intake Manager collections</p>
        </div>

        {successMessage && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-purple-200 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              VIM Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-purple-700 font-medium">
                  Date *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-purple-700 font-medium">
                  Location *
                </Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location" className="border-purple-300 focus:border-purple-500 focus:ring-purple-500">
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

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vim-collections" className="text-purple-700 font-medium">
                  # of VIM Collections
                </Label>
                <Input
                  id="vim-collections"
                  type="number"
                  min="0"
                  value={vimCollections}
                  onChange={(e) => setVimCollections(parseInt(e.target.value) || 0)}
                  className="border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vim-amount" className="text-purple-700 font-medium">
                  VIM Amount ($)
                </Label>
                <Input
                  id="vim-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={vimAmount}
                  onChange={(e) => setVimAmount(parseFloat(e.target.value) || 0)}
                  className="border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-purple-700 font-medium">Total Amount:</span>
                <span className="text-2xl font-bold text-purple-900">
                  ${(vimAmount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={saveLog}
                disabled={saving}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
                {saving ? "Saving..." : `Save VIM Entry for ${format(displayDate, "MMM dd")}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}