import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4">
      <Card className="w-full max-w-2xl border border-slate-200 shadow-sm">
        <CardContent className="py-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Web coming soon!
          </h1>
          <p className="mt-3 text-base text-slate-600">Stay tuned</p>
        </CardContent>
      </Card>
    </div>
  );
}
