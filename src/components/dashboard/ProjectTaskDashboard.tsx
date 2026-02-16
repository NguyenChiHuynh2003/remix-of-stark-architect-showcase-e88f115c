import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/ExportButtons";
import { exportDashboardToExcel, exportDashboardToPDF } from "@/lib/exportUtils";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Users,
  ListTodo,
  Target,
  Filter
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface Task {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  completion_percentage: number;
}

interface Employee {
  id: string;
  full_name: string;
}

interface ProjectTaskDashboardProps {
  projectId?: string;
  projectName?: string;
}

const COLORS = {
  completed: "#22c55e",    // Green
  in_progress: "#eab308",  // Yellow
  pending: "#3b82f6",      // Blue
  overdue: "#ef4444",      // Red
  high: "#ef4444",         // Red
  medium: "#eab308",       // Yellow
  low: "#22c55e",          // Green
};

export const ProjectTaskDashboard = ({ projectId, projectName = "Website nội bộ KBA.2018" }: ProjectTaskDashboardProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch tasks - if projectId is provided, filter by it
      let tasksQuery = supabase.from("tasks").select("*");
      if (projectId) {
        tasksQuery = tasksQuery.eq("project_id", projectId);
      }
      
      const [tasksResult, employeesResult] = await Promise.all([
        tasksQuery,
        supabase.from("employees").select("id, full_name").order("full_name")
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (employeesResult.error) throw employeesResult.error;

      setTasks(tasksResult.data || []);
      setEmployees(employeesResult.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesEmployee = filterEmployee === "all" || task.assigned_to === filterEmployee;
      const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
      return matchesEmployee && matchesPriority;
    });
  }, [tasks, filterEmployee, filterPriority]);

  // Calculate overview stats
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === "completed").length;
    const pending = filteredTasks.filter(t => t.status !== "completed").length;
    const avgProgress = filteredTasks.length > 0 
      ? Math.round(filteredTasks.reduce((sum, t) => sum + (t.completion_percentage || 0), 0) / filteredTasks.length)
      : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;

    return { total, completed, pending, avgProgress, completionRate };
  }, [filteredTasks]);

  // Calculate data for stacked bar chart (by employee)
  const employeeChartData = useMemo(() => {
    const employeeTaskMap = new Map<string, { name: string; completed: number; in_progress: number; overdue: number; pending: number }>();
    
    filteredTasks.forEach(task => {
      if (!task.assigned_to) return;
      
      const employee = employees.find(e => e.id === task.assigned_to);
      if (!employee) return;
      
      if (!employeeTaskMap.has(task.assigned_to)) {
        employeeTaskMap.set(task.assigned_to, {
          name: employee.full_name,
          completed: 0,
          in_progress: 0,
          overdue: 0,
          pending: 0
        });
      }
      
      const data = employeeTaskMap.get(task.assigned_to)!;
      if (task.status === "completed") data.completed++;
      else if (task.status === "in_progress") data.in_progress++;
      else if (task.status === "overdue") data.overdue++;
      else data.pending++;
    });

    return Array.from(employeeTaskMap.values())
      .sort((a, b) => (b.completed + b.in_progress + b.overdue + b.pending) - (a.completed + a.in_progress + a.overdue + a.pending))
      .slice(0, 10); // Top 10 employees
  }, [filteredTasks, employees]);

  // Calculate data for priority pie chart
  const priorityChartData = useMemo(() => {
    const high = filteredTasks.filter(t => t.priority === "high").length;
    const medium = filteredTasks.filter(t => t.priority === "medium").length;
    const low = filteredTasks.filter(t => t.priority === "low").length;
    const none = filteredTasks.filter(t => !t.priority).length;

    return [
      { name: "Cao", value: high, color: COLORS.high },
      { name: "Trung bình", value: medium, color: COLORS.medium },
      { name: "Thấp", value: low, color: COLORS.low },
      ...(none > 0 ? [{ name: "Chưa đặt", value: none, color: "#9ca3af" }] : [])
    ].filter(item => item.value > 0);
  }, [filteredTasks]);

  // Get overdue/risky tasks
  const riskTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return filteredTasks
      .filter(task => {
        if (task.status === "completed") return false;
        if (!task.due_date) return false;
        
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        // Overdue or due within 3 days
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date!).getTime();
        const dateB = new Date(b.due_date!).getTime();
        return dateA - dateB;
      })
      .slice(0, 10);
  }, [filteredTasks]);

  const getEmployeeName = (id: string | null) => {
    if (!id) return "Chưa phân công";
    return employees.find(e => e.id === id)?.full_name || "Không xác định";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleExport = (format: "excel" | "pdf") => {
    const exportData = {
      projectName,
      stats,
      employeeData: employeeChartData,
      priorityData: priorityChartData,
      riskTasks: riskTasks.map(task => ({
        title: task.title,
        assignee: getEmployeeName(task.assigned_to),
        dueDate: formatDate(task.due_date),
        progress: task.completion_percentage,
        status: task.status === "overdue" || getDaysOverdue(task.due_date!) > 0 ? "Quá hạn" : 
                task.status === "in_progress" ? "Đang làm" : "Chờ xử lý",
        daysOverdue: getDaysOverdue(task.due_date!),
      })),
    };

    if (format === "excel") {
      exportDashboardToExcel(exportData);
    } else {
      exportDashboardToPDF(exportData);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Nhiệm vụ</h2>
          <p className="text-muted-foreground">{projectName}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tất cả nhân viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhân viên</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Độ ưu tiên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="high">Cao</SelectItem>
              <SelectItem value="medium">Trung bình</SelectItem>
              <SelectItem value="low">Thấp</SelectItem>
            </SelectContent>
          </Select>

          <ExportButtons
            onExportExcel={() => handleExport("excel")}
            onExportPDF={() => handleExport("pdf")}
          />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng nhiệm vụ</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <ListTodo className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hoàn thành</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground">{stats.completed}</p>
                  <span className="text-sm text-green-600 font-medium">({stats.completionRate}%)</span>
                </div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chưa hoàn thành</p>
                <p className="text-3xl font-bold text-foreground">{stats.pending}</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-full">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tiến độ TB hệ thống</p>
                <p className="text-3xl font-bold text-foreground">{stats.avgProgress}%</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stacked Bar Chart - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              So sánh hiệu suất nhân viên
            </CardTitle>
            <CardDescription>Phân bố trạng thái nhiệm vụ theo từng nhân viên</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={employeeChartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150} 
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS.completed} name="Đã xong" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="in_progress" stackId="a" fill={COLORS.in_progress} name="Đang làm" />
                  <Bar dataKey="pending" stackId="a" fill={COLORS.pending} name="Chờ xử lý" />
                  <Bar dataKey="overdue" stackId="a" fill={COLORS.overdue} name="Quá hạn" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                Không có dữ liệu để hiển thị
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Phân bố độ ưu tiên
            </CardTitle>
            <CardDescription>Tỷ lệ nhiệm vụ theo mức độ ưu tiên</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {priorityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Không có dữ liệu
              </div>
            )}
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {priorityChartData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Tracking Table */}
      <Card className="border-destructive/30">
        <CardHeader className="bg-destructive/5">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Nhiệm vụ cần chú ý
          </CardTitle>
          <CardDescription>Các nhiệm vụ quá hạn hoặc sắp đến hạn (trong 3 ngày tới)</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {riskTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhiệm vụ</TableHead>
                  <TableHead>Người phụ trách</TableHead>
                  <TableHead>Hạn hoàn thành</TableHead>
                  <TableHead>Tiến độ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskTasks.map(task => {
                  const daysOverdue = getDaysOverdue(task.due_date!);
                  const isOverdue = daysOverdue > 0;
                  
                  return (
                    <TableRow key={task.id} className={isOverdue ? "bg-destructive/5" : "bg-amber-500/5"}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{getEmployeeName(task.assigned_to)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatDate(task.due_date)}</span>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Quá {daysOverdue} ngày
                            </Badge>
                          )}
                          {!isOverdue && daysOverdue <= 0 && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                              Còn {Math.abs(daysOverdue)} ngày
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all" 
                              style={{ width: `${task.completion_percentage}%` }} 
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{task.completion_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.status === "overdue" || isOverdue ? (
                          <Badge variant="destructive">Quá hạn</Badge>
                        ) : task.status === "in_progress" ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600">Đang làm</Badge>
                        ) : (
                          <Badge variant="secondary">Chờ xử lý</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>Tuyệt vời! Không có nhiệm vụ nào cần chú ý.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
