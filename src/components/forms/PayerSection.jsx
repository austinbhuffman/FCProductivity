import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, DollarSign } from "lucide-react";

export default function PayerSection({ 
  payerType, 
  data, 
  onChange, 
  isLocked
}) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const isSelfPay = payerType === "SelfPay";
  const isMedicare = payerType === "Medicare";

  const handleFieldChange = (field, value) => {
    const numValue = value === "" ? 0 : parseInt(value) || 0;
    onChange(payerType, { ...data, [field]: numValue });
  };

  const handleDecimalChange = (field, value) => {
    const numValue = value === "" ? 0 : parseFloat(value) || 0;
    onChange(payerType, { ...data, [field]: numValue });
  };

  const payerStyles = {
    Commercial: {
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-cyan-50",
      inputBorder: "border-blue-200 focus:border-blue-500",
      iconColor: "text-blue-600"
    },
    Medicare: {
      gradient: "from-emerald-500 to-emerald-600",
      bgGradient: "from-emerald-50 to-teal-50",
      inputBorder: "border-emerald-200 focus:border-emerald-500",
      iconColor: "text-emerald-600"
    },
    SelfPay: {
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-pink-50",
      inputBorder: "border-purple-200 focus:border-purple-500",
      iconColor: "text-purple-600"
    }
  };

  const style = payerStyles[payerType];
  const displayName = payerType === "SelfPay" ? "Self Pay" : payerType === "Medicare" ? "MCR/HMO" : payerType;

  // Render fields based on payer type
  const renderCommercialFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${payerType}-new-patients`} className="text-slate-700 font-medium">
          New Patients
        </Label>
        <Input
          id={`${payerType}-new-patients`}
          type="number"
          min="0"
          value={data.new_patients || ""}
          onChange={(e) => handleFieldChange("new_patients", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-single`} className="text-slate-700 font-medium">
          Single Coverage
        </Label>
        <Input
          id={`${payerType}-single`}
          type="number"
          min="0"
          value={data.single_coverage || ""}
          onChange={(e) => handleFieldChange("single_coverage", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-dual`} className="text-slate-700 font-medium">
          Dual Coverage
        </Label>
        <Input
          id={`${payerType}-dual`}
          type="number"
          min="0"
          value={data.dual_coverage || ""}
          onChange={(e) => handleFieldChange("dual_coverage", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-called`} className="text-slate-700 font-medium">
          Patients Called
        </Label>
        <Input
          id={`${payerType}-called`}
          type="number"
          min="0"
          value={data.patients_called || ""}
          onChange={(e) => handleFieldChange("patients_called", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-room`} className="text-slate-700 font-medium">
          Room Visits
        </Label>
        <Input
          id={`${payerType}-room`}
          type="number"
          min="0"
          value={data.room_visits || ""}
          onChange={(e) => handleFieldChange("room_visits", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-not-seen`} className="text-slate-700 font-medium">
          Patients not Seen
        </Label>
        <Input
          id={`${payerType}-not-seen`}
          type="number"
          min="0"
          value={data.patients_not_seen || ""}
          onChange={(e) => handleFieldChange("patients_not_seen", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-insurance-updates`} className="text-slate-700 font-medium">
          Insurance Updates
        </Label>
        <Input
          id={`${payerType}-insurance-updates`}
          type="number"
          min="0"
          value={data.insurance_updates || ""}
          onChange={(e) => handleFieldChange("insurance_updates", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-count`} className="text-slate-700 font-medium">
          # of POS Collections
        </Label>
        <Input
          id={`${payerType}-pos-count`}
          type="number"
          min="0"
          value={data.pos_collections_count || ""}
          onChange={(e) => handleFieldChange("pos_collections_count", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-amount`} className="text-slate-700 font-medium flex items-center gap-1">
          <DollarSign className={`w-4 h-4 ${style.iconColor}`} />
          POS Amount
        </Label>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold ${style.iconColor}`}>$</span>
          <Input
            id={`${payerType}-pos-amount`}
            type="number"
            min="0"
            step="0.01"
            value={data.pos_amount || ""}
            onChange={(e) => handleDecimalChange("pos_amount", e.target.value)}
            disabled={isLocked}
            className={`pl-7 text-lg font-semibold ${style.inputBorder}`}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-potential`} className="text-slate-700 font-medium flex items-center gap-1">
          <DollarSign className={`w-4 h-4 ${style.iconColor}`} />
          POS Potential
        </Label>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold ${style.iconColor}`}>$</span>
          <Input
            id={`${payerType}-pos-potential`}
            type="number"
            min="0"
            step="0.01"
            value={data.pos_potential || ""}
            onChange={(e) => handleDecimalChange("pos_potential", e.target.value)}
            disabled={isLocked}
            className={`pl-7 text-lg font-semibold ${style.inputBorder}`}
            placeholder="0.00"
          />
        </div>
      </div>
    </>
  );

  const renderMedicareFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${payerType}-new-patients`} className="text-slate-700 font-medium">
          New Patients
        </Label>
        <Input
          id={`${payerType}-new-patients`}
          type="number"
          min="0"
          value={data.new_patients || ""}
          onChange={(e) => handleFieldChange("new_patients", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-single`} className="text-slate-700 font-medium">
          Single Coverage
        </Label>
        <Input
          id={`${payerType}-single`}
          type="number"
          min="0"
          value={data.single_coverage || ""}
          onChange={(e) => handleFieldChange("single_coverage", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-dual`} className="text-slate-700 font-medium">
          Dual Coverage
        </Label>
        <Input
          id={`${payerType}-dual`}
          type="number"
          min="0"
          value={data.dual_coverage || ""}
          onChange={(e) => handleFieldChange("dual_coverage", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-called`} className="text-slate-700 font-medium">
          Patients Called
        </Label>
        <Input
          id={`${payerType}-called`}
          type="number"
          min="0"
          value={data.patients_called || ""}
          onChange={(e) => handleFieldChange("patients_called", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-room`} className="text-slate-700 font-medium">
          Room Visit
        </Label>
        <Input
          id={`${payerType}-room`}
          type="number"
          min="0"
          value={data.room_visits || ""}
          onChange={(e) => handleFieldChange("room_visits", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-not-seen`} className="text-slate-700 font-medium">
          Patients not Seen
        </Label>
        <Input
          id={`${payerType}-not-seen`}
          type="number"
          min="0"
          value={data.patients_not_seen || ""}
          onChange={(e) => handleFieldChange("patients_not_seen", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-insurance-updates`} className="text-slate-700 font-medium">
          Insurance Updates
        </Label>
        <Input
          id={`${payerType}-insurance-updates`}
          type="number"
          min="0"
          value={data.insurance_updates || ""}
          onChange={(e) => handleFieldChange("insurance_updates", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-qmb-screening`} className="text-slate-700 font-medium">
          QMB Screening
        </Label>
        <Input
          id={`${payerType}-qmb-screening`}
          type="number"
          min="0"
          value={data.qmb_screening || ""}
          onChange={(e) => handleFieldChange("qmb_screening", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-qmb-enrollments`} className="text-slate-700 font-medium">
          QMB Enrollments
        </Label>
        <Input
          id={`${payerType}-qmb-enrollments`}
          type="number"
          min="0"
          value={data.qmb_enrollments || ""}
          onChange={(e) => handleFieldChange("qmb_enrollments", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-qmb-paperwork`} className="text-slate-700 font-medium">
          QMB Paperwork
        </Label>
        <Input
          id={`${payerType}-qmb-paperwork`}
          type="number"
          min="0"
          value={data.qmb_paperwork || ""}
          onChange={(e) => handleFieldChange("qmb_paperwork", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-count`} className="text-slate-700 font-medium">
          # of POS Collection
        </Label>
        <Input
          id={`${payerType}-pos-count`}
          type="number"
          min="0"
          value={data.pos_collections_count || ""}
          onChange={(e) => handleFieldChange("pos_collections_count", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-amount`} className="text-slate-700 font-medium flex items-center gap-1">
          <DollarSign className={`w-4 h-4 ${style.iconColor}`} />
          POS Amount
        </Label>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold ${style.iconColor}`}>$</span>
          <Input
            id={`${payerType}-pos-amount`}
            type="number"
            min="0"
            step="0.01"
            value={data.pos_amount || ""}
            onChange={(e) => handleDecimalChange("pos_amount", e.target.value)}
            disabled={isLocked}
            className={`pl-7 text-lg font-semibold ${style.inputBorder}`}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-potential`} className="text-slate-700 font-medium flex items-center gap-1">
          <DollarSign className={`w-4 h-4 ${style.iconColor}`} />
          POS Potential
        </Label>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold ${style.iconColor}`}>$</span>
          <Input
            id={`${payerType}-pos-potential`}
            type="number"
            min="0"
            step="0.01"
            value={data.pos_potential || ""}
            onChange={(e) => handleDecimalChange("pos_potential", e.target.value)}
            disabled={isLocked}
            className={`pl-7 text-lg font-semibold ${style.inputBorder}`}
            placeholder="0.00"
          />
        </div>
      </div>
    </>
  );

  const renderSelfPayFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${payerType}-new-patients`} className="text-slate-700 font-medium">
          New Patients
        </Label>
        <Input
          id={`${payerType}-new-patients`}
          type="number"
          min="0"
          value={data.new_patients || ""}
          onChange={(e) => handleFieldChange("new_patients", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-called`} className="text-slate-700 font-medium">
          Patients Called
        </Label>
        <Input
          id={`${payerType}-called`}
          type="number"
          min="0"
          value={data.patients_called || ""}
          onChange={(e) => handleFieldChange("patients_called", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-room`} className="text-slate-700 font-medium">
          Room Visit
        </Label>
        <Input
          id={`${payerType}-room`}
          type="number"
          min="0"
          value={data.room_visits || ""}
          onChange={(e) => handleFieldChange("room_visits", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-not-seen`} className="text-slate-700 font-medium">
          Patients not Seen
        </Label>
        <Input
          id={`${payerType}-not-seen`}
          type="number"
          min="0"
          value={data.patients_not_seen || ""}
          onChange={(e) => handleFieldChange("patients_not_seen", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-converted`} className="text-slate-700 font-medium">
          SP Converted to Insurance
        </Label>
        <Input
          id={`${payerType}-converted`}
          type="number"
          min="0"
          value={data.sp_converted_to_insurance || ""}
          onChange={(e) => handleFieldChange("sp_converted_to_insurance", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-inpatient-fa`} className="text-slate-700 font-medium">
          Inpatient Financial Assistance
        </Label>
        <Input
          id={`${payerType}-inpatient-fa`}
          type="number"
          min="0"
          value={data.inpatient_financial_assistance || ""}
          onChange={(e) => handleFieldChange("inpatient_financial_assistance", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-walkin-callin-fa`} className="text-slate-700 font-medium">
          Walk-In/Call-In Financial Assistance
        </Label>
        <Input
          id={`${payerType}-walkin-callin-fa`}
          type="number"
          min="0"
          value={data.walkin_callin_financial_assistance || ""}
          onChange={(e) => handleFieldChange("walkin_callin_financial_assistance", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-marketplace-qualified`} className="text-slate-700 font-medium">
          Marketplace Qualified
        </Label>
        <Input
          id={`${payerType}-marketplace-qualified`}
          type="number"
          min="0"
          value={data.marketplace_qualified || ""}
          onChange={(e) => handleFieldChange("marketplace_qualified", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-marketplace-enrolled`} className="text-slate-700 font-medium">
          Marketplace Enrolled
        </Label>
        <Input
          id={`${payerType}-marketplace-enrolled`}
          type="number"
          min="0"
          value={data.marketplace_enrolled || ""}
          onChange={(e) => handleFieldChange("marketplace_enrolled", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-medicaid-qualified`} className="text-slate-700 font-medium">
          Medicaid Qualified
        </Label>
        <Input
          id={`${payerType}-medicaid-qualified`}
          type="number"
          min="0"
          value={data.medicaid_qualified || ""}
          onChange={(e) => handleFieldChange("medicaid_qualified", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-medicaid-enrolled`} className="text-slate-700 font-medium">
          Medicaid Enrolled
        </Label>
        <Input
          id={`${payerType}-medicaid-enrolled`}
          type="number"
          min="0"
          value={data.medicaid_enrolled || ""}
          onChange={(e) => handleFieldChange("medicaid_enrolled", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-count`} className="text-slate-700 font-medium">
          # of POS Collections
        </Label>
        <Input
          id={`${payerType}-pos-count`}
          type="number"
          min="0"
          value={data.pos_collections_count || ""}
          onChange={(e) => handleFieldChange("pos_collections_count", e.target.value)}
          disabled={isLocked}
          className={`text-lg font-semibold ${style.inputBorder}`}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-amount`} className="text-slate-700 font-medium flex items-center gap-1">
          <DollarSign className={`w-4 h-4 ${style.iconColor}`} />
          POS Amount
        </Label>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold ${style.iconColor}`}>$</span>
          <Input
            id={`${payerType}-pos-amount`}
            type="number"
            min="0"
            step="0.01"
            value={data.pos_amount || ""}
            onChange={(e) => handleDecimalChange("pos_amount", e.target.value)}
            disabled={isLocked}
            className={`pl-7 text-lg font-semibold ${style.inputBorder}`}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${payerType}-pos-potential`} className="text-slate-700 font-medium flex items-center gap-1">
          <DollarSign className={`w-4 h-4 ${style.iconColor}`} />
          POS Potential
        </Label>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold ${style.iconColor}`}>$</span>
          <Input
            id={`${payerType}-pos-potential`}
            type="number"
            min="0"
            step="0.01"
            value={data.pos_potential || ""}
            onChange={(e) => handleDecimalChange("pos_potential", e.target.value)}
            disabled={isLocked}
            className={`pl-7 text-lg font-semibold ${style.inputBorder}`}
            placeholder="0.00"
          />
        </div>
      </div>
    </>
  );

  return (
    <Card className={`border-slate-200 shadow-sm bg-gradient-to-br ${style.bgGradient}`}>
      <CardHeader 
        className={`cursor-pointer bg-gradient-to-r ${style.gradient} text-white`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {displayName}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {payerType === "Commercial" && renderCommercialFields()}
            {payerType === "Medicare" && renderMedicareFields()}
            {payerType === "SelfPay" && renderSelfPayFields()}
          </div>
        </CardContent>
      )}
    </Card>
  );
}