import { Card, CardContent } from "@/components/ui/card";
import { isFormSigned } from "./mcrUtils";

export default function SummaryCards({ cases }) {
  const active = cases.filter(c => c.case_status === "Active");
  const urgent = active.filter(c =>
    (c._alertLevel.startsWith("🔴") || c._alertLevel.startsWith("⚫")) &&
    !isFormSigned(c.form_status)
  );
  const overdue = active.filter(c => c._censusReviewOverdue);
  const formRequired = active.filter(c => c._lifetimeFormRequired && !isFormSigned(c.form_status));

  const cards = [
    { label: "Total Active Cases", value: active.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    { label: "🔴 Urgent – Form Action Needed", value: urgent.length, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "⚠️ Census Review Overdue", value: overdue.length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { label: "📋 Lifetime Form Required", value: formRequired.length, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.label} className={`border ${card.bg}`}>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-slate-500 mb-1">{card.label}</p>
            <p className={`text-4xl font-bold ${card.color}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}