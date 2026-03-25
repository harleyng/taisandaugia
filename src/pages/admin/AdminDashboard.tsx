import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Shield, Building2, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const stats = [
    {
      title: "Total Properties",
      value: "1,234",
      change: "+18 pending approval",
      icon: Building,
    },
    {
      title: "Brokers",
      value: "156",
      change: "+8 pending verification",
      icon: Shield,
    },
    {
      title: "Organizations",
      value: "23",
      change: "+2 pending approval",
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
              <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
            </CardTitle>
            <CardDescription>Latest platform activities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Feature coming soon - Real-time activity tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Actions
              <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
            </CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Feature coming soon - Action items dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
