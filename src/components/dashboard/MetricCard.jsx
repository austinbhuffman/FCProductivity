import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({ 
  title, 
  icon: Icon, 
  ytdValue, 
  pytdValue, 
  showComparison = false,
  valueFormatter = (v) => v,
  bgColor = "bg-blue-500"
}) {
  const diff = ytdValue - pytdValue;
  const pctChange = pytdValue > 0 ? ((ytdValue - pytdValue) / pytdValue) * 100 : (ytdValue > 0 ? 100 : 0);
  const isPositive = diff >= 0;

  return (
    <Card className="border-slate-200 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!showComparison ? (
          <p className="text-3xl font-bold text-slate-900">{valueFormatter(ytdValue)}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <div>
                <p className="text-xs text-slate-500 font-medium">YTD</p>
                <p className="text-2xl font-bold text-slate-900">{valueFormatter(ytdValue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">PYTD</p>
                <p className="text-xl font-semibold text-slate-600">{valueFormatter(pytdValue)}</p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1 w-fit ${
                isPositive 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isPositive ? '+' : ''}{diff} ({pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%)
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}