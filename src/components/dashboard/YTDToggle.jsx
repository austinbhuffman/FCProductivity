import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp } from "lucide-react";

export default function YTDToggle({ value, onChange }) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="bg-slate-100">
        <TabsTrigger value="current" className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Current Period
        </TabsTrigger>
        <TabsTrigger value="ytd" className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          YTD vs PYTD
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}