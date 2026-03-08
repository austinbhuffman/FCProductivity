import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Users, DollarSign } from "lucide-react";

export default function WalkInCallInSection({ data, onChange, isLocked }) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const handleFieldChange = (field, value) => {
    const numValue = value === "" ? 0 : parseInt(value) || 0;
    onChange({ ...data, [field]: numValue });
  };

  const handleDecimalChange = (field, value) => {
    const numValue = value === "" ? 0 : parseFloat(value) || 0;
    onChange({ ...data, [field]: numValue });
  };

  return (
    <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader 
        className="cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Walk-Ins Only
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="walk_ins" className="text-slate-700 font-medium">
                # of Walk-Ins
              </Label>
              <Input
                id="walk_ins"
                type="number"
                min="0"
                value={data.walk_ins || ""}
                onChange={(e) => handleFieldChange("walk_ins", e.target.value)}
                disabled={isLocked}
                className="text-lg font-semibold border-indigo-200 focus:border-indigo-500"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_collections_count" className="text-slate-700 font-medium">
                # of POS Collections
              </Label>
              <Input
                id="pos_collections_count"
                type="number"
                min="0"
                value={data.pos_collections_count || ""}
                onChange={(e) => handleFieldChange("pos_collections_count", e.target.value)}
                disabled={isLocked}
                className="text-lg font-semibold border-indigo-200 focus:border-indigo-500"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_amount" className="text-slate-700 font-medium flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                POS Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-indigo-600">$</span>
                <Input
                  id="pos_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={data.pos_amount || ""}
                  onChange={(e) => handleDecimalChange("pos_amount", e.target.value)}
                  disabled={isLocked}
                  className="pl-7 text-lg font-semibold border-indigo-200 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}