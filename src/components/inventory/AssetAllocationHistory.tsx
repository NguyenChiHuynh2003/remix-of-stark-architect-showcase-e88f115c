import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Download, ArrowUpRight, ArrowDownLeft, Calendar, Package, FileOutput, RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { vi } from "date-fns/locale";
import * as XLSX from "xlsx";

interface AllocationHistory {
  id: string;
  asset_master_id: string;
  allocated_to: string | null;
  allocated_to_name: string | null;
  purpose: string;
  allocation_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: string;
  quantity: number;
  return_condition: string | null;
  reusability_percentage: number | null;
  project_id: string | null;
  asset_master_data: {
    asset_id: string;
    asset_name: string;
    unit: string | null;
  } | null;
  allocated_to_employee?: {
    full_name: string;
    position?: string;
  } | null;
  projects?: {
    name: string;
  } | null;
}

interface GINHistory {
  id: string;
  gin_number: string;
  issue_date: string;
  recipient: string | null;
  purpose: string | null;
  project_id: string | null;
  projects?: {
    name: string;
  } | null;
  gin_items: {
    id: string;
    asset_master_id: string | null;
    quantity: number;
    returned_quantity: number | null;
    status: string | null;
    return_date: string | null;
    return_condition: string | null;
    asset_master_data: {
      asset_id: string;
      asset_name: string;
      unit: string | null;
    } | null;
  }[];
}

interface TimelineEvent {
  id: string;
  type: "allocation" | "return" | "gin_issue" | "gin_return";
  date: string;
  assetId: string;
  assetName: string;
  employeeName: string;
  quantity: number;
  originalQuantity?: number;
  unit: string;
  project?: string;
  purpose?: string;
  condition?: string;
  reusability?: number;
  isPartialReturn?: boolean;
  ginNumber?: string;
}

export function AssetAllocationHistory() {
  const [allocations, setAllocations] = useState<AllocationHistory[]>([]);
  const [ginHistory, setGINHistory] = useState<GINHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      
      const { data: allocationsData, error: allocationsError } = await supabase
        .from("asset_allocations")
        .select(`
          *,
          asset_master_data(asset_id, asset_name, unit),
          projects(name)
        `)
        .order("allocation_date", { ascending: false });

      if (allocationsError) throw allocationsError;

      const employeeIds = [...new Set((allocationsData || []).filter(a => a.allocated_to).map(a => a.allocated_to))];
      
      let employeesMap: Record<string, { full_name: string; position?: string }> = {};
      if (employeeIds.length > 0) {
        const { data: employeesData } = await supabase
          .from("employees")
          .select("id, full_name, position")
          .in("id", employeeIds);
        
        employeesMap = (employeesData || []).reduce((acc, e) => {
          acc[e.id] = { full_name: e.full_name, position: e.position || undefined };
          return acc;
        }, {} as Record<string, { full_name: string; position?: string }>);
      }

      const allocationsWithEmployees = (allocationsData || []).map(allocation => ({
        ...allocation,
        allocated_to_employee: allocation.allocated_to ? employeesMap[allocation.allocated_to] || null : null
      }));

      setAllocations(allocationsWithEmployees as any);

      // Fetch GIN history
      const { data: ginData, error: ginError } = await supabase
        .from("goods_issue_notes")
        .select(`
          *,
          projects(name),
          gin_items(
            id,
            asset_master_id,
            quantity,
            returned_quantity,
            status,
            return_date,
            return_condition,
            asset_master_data(asset_id, asset_name, unit)
          )
        `)
        .order("issue_date", { ascending: false });

      if (ginError) throw ginError;

      setGINHistory(ginData as any || []);
    } catch (error: any) {
      toast.error("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocations();
  }, []);

  // Create timeline events from allocations and GINs
  const timelineEvents: TimelineEvent[] = [];
  
  // Process allocations
  const groupedAllocations = allocations.reduce((acc, allocation) => {
    const key = `${allocation.allocation_date}_${allocation.asset_master_id}_${allocation.allocated_to}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(allocation);
    return acc;
  }, {} as Record<string, AllocationHistory[]>);

  Object.values(groupedAllocations).forEach(group => {
    if (group.length === 1) {
      const allocation = group[0];
      
      timelineEvents.push({
        id: `alloc-${allocation.id}`,
        type: "allocation",
        date: allocation.allocation_date,
        assetId: allocation.asset_master_data?.asset_id || "",
        assetName: allocation.asset_master_data?.asset_name || "",
        employeeName: allocation.allocated_to_employee?.full_name || allocation.allocated_to_name || "N/A",
        quantity: allocation.quantity || 1,
        unit: allocation.asset_master_data?.unit || "cái",
        project: allocation.projects?.name,
        purpose: allocation.purpose,
      });
      
      if (allocation.actual_return_date) {
        timelineEvents.push({
          id: `return-${allocation.id}`,
          type: "return",
          date: allocation.actual_return_date,
          assetId: allocation.asset_master_data?.asset_id || "",
          assetName: allocation.asset_master_data?.asset_name || "",
          employeeName: allocation.allocated_to_employee?.full_name || allocation.allocated_to_name || "N/A",
          quantity: allocation.quantity || 1,
          unit: allocation.asset_master_data?.unit || "cái",
          project: allocation.projects?.name,
          condition: allocation.return_condition || undefined,
          reusability: allocation.reusability_percentage ?? undefined,
        });
      }
    } else {
      const totalOriginalQty = group.reduce((sum, a) => sum + (a.quantity || 1), 0);
      const returnedAllocations = group.filter(a => a.status === "returned");
      const firstRecord = group[0];
      
      timelineEvents.push({
        id: `alloc-${firstRecord.id}`,
        type: "allocation",
        date: firstRecord.allocation_date,
        assetId: firstRecord.asset_master_data?.asset_id || "",
        assetName: firstRecord.asset_master_data?.asset_name || "",
        employeeName: firstRecord.allocated_to_employee?.full_name || firstRecord.allocated_to_name || "N/A",
        quantity: totalOriginalQty,
        unit: firstRecord.asset_master_data?.unit || "cái",
        project: firstRecord.projects?.name,
        purpose: firstRecord.purpose,
      });
      
      returnedAllocations.forEach(returnedAlloc => {
        if (returnedAlloc.actual_return_date) {
          timelineEvents.push({
            id: `return-${returnedAlloc.id}`,
            type: "return",
            date: returnedAlloc.actual_return_date,
            assetId: returnedAlloc.asset_master_data?.asset_id || "",
            assetName: returnedAlloc.asset_master_data?.asset_name || "",
            employeeName: returnedAlloc.allocated_to_employee?.full_name || returnedAlloc.allocated_to_name || "N/A",
            quantity: returnedAlloc.quantity || 1,
            originalQuantity: totalOriginalQty,
            unit: returnedAlloc.asset_master_data?.unit || "cái",
            project: returnedAlloc.projects?.name,
            condition: returnedAlloc.return_condition || undefined,
            reusability: returnedAlloc.reusability_percentage ?? undefined,
            isPartialReturn: true,
          });
        }
      });
    }
  });

  // Process GIN (Goods Issue Notes) - create timeline events for each item
  ginHistory.forEach(gin => {
    (gin.gin_items || []).forEach(item => {
      if (!item.asset_master_data) return;
      
      // GIN Issue event
      timelineEvents.push({
        id: `gin-issue-${item.id}`,
        type: "gin_issue",
        date: gin.issue_date,
        assetId: item.asset_master_data.asset_id || "",
        assetName: item.asset_master_data.asset_name || "",
        employeeName: gin.recipient || "N/A",
        quantity: item.quantity,
        unit: item.asset_master_data.unit || "cái",
        project: gin.projects?.name,
        purpose: gin.purpose || undefined,
        ginNumber: gin.gin_number,
      });
      
      // GIN Return event (if returned)
      const returnedQty = item.returned_quantity || 0;
      if (returnedQty > 0 && item.return_date) {
        const isPartial = returnedQty < item.quantity;
        timelineEvents.push({
          id: `gin-return-${item.id}`,
          type: "gin_return",
          date: item.return_date,
          assetId: item.asset_master_data.asset_id || "",
          assetName: item.asset_master_data.asset_name || "",
          employeeName: gin.recipient || "N/A",
          quantity: returnedQty,
          originalQuantity: isPartial ? item.quantity : undefined,
          unit: item.asset_master_data.unit || "cái",
          project: gin.projects?.name,
          condition: item.return_condition || undefined,
          ginNumber: gin.gin_number,
          isPartialReturn: isPartial,
        });
      }
    });
  });

  // Filter by period
  const getDateRange = (period: string) => {
    const now = new Date();
    switch (period) {
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "last_3_months":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "last_6_months":
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      default:
        return null;
    }
  };

  const filteredEvents = timelineEvents
    .filter(event => {
      // Search filter
      const matchesSearch = 
        event.assetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.assetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.ginNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      // Type filter - group allocations together and GINs together for filtering
      let matchesType = false;
      if (typeFilter === "all") {
        matchesType = true;
      } else if (typeFilter === "allocation") {
        matchesType = event.type === "allocation";
      } else if (typeFilter === "return") {
        matchesType = event.type === "return";
      } else if (typeFilter === "gin_issue") {
        matchesType = event.type === "gin_issue";
      } else if (typeFilter === "gin_return") {
        matchesType = event.type === "gin_return";
      }
      
      // Period filter
      const dateRange = getDateRange(periodFilter);
      const matchesPeriod = !dateRange || isWithinInterval(new Date(event.date), dateRange);
      
      return matchesSearch && matchesType && matchesPeriod;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Statistics
  const totalAllocations = timelineEvents.filter(e => e.type === "allocation").length;
  const totalReturns = timelineEvents.filter(e => e.type === "return").length;
  const totalGINIssues = timelineEvents.filter(e => e.type === "gin_issue").length;
  const totalGINReturns = timelineEvents.filter(e => e.type === "gin_return").length;
  const totalAllocatedQty = timelineEvents
    .filter(e => e.type === "allocation")
    .reduce((sum, e) => sum + e.quantity, 0);
  const totalReturnedQty = timelineEvents
    .filter(e => e.type === "return")
    .reduce((sum, e) => sum + e.quantity, 0);
  const totalGINIssuedQty = timelineEvents
    .filter(e => e.type === "gin_issue")
    .reduce((sum, e) => sum + e.quantity, 0);
  const totalGINReturnedQty = timelineEvents
    .filter(e => e.type === "gin_return")
    .reduce((sum, e) => sum + e.quantity, 0);

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "allocation": return "Phân bổ";
      case "return": return "Hoàn trả PB";
      case "gin_issue": return "Xuất kho";
      case "gin_return": return "Hoàn trả XK";
      default: return type;
    }
  };

  const exportToExcel = () => {
    const exportData = filteredEvents.map((event) => ({
      "Loại": getEventTypeLabel(event.type),
      "Số phiếu": event.ginNumber || "",
      "Ngày": format(new Date(event.date), "dd/MM/yyyy HH:mm"),
      "Mã Tài sản": event.assetId,
      "Tên Tài sản": event.assetName,
      "Số lượng": event.quantity,
      "Đơn vị": event.unit,
      "Người nhận": event.employeeName,
      "Dự án": event.project || "",
      "Mục đích": event.purpose || "",
      "Tình trạng hoàn trả": event.condition || "",
      "% Tái sử dụng": event.reusability ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lịch sử");
    
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `Lich_su_phan_bo_xuat_kho_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
    toast.success("Xuất file Excel thành công!");
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{totalAllocations}</p>
                <p className="text-xs text-muted-foreground">Lần phân bổ</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <ArrowDownLeft className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{totalReturns}</p>
                <p className="text-xs text-muted-foreground">Hoàn trả PB</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FileOutput className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{totalGINIssues}</p>
                <p className="text-xs text-muted-foreground">Lần xuất kho</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <RotateCcw className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-600">{totalGINReturns}</p>
                <p className="text-xs text-muted-foreground">Hoàn trả XK</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <Package className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAllocatedQty + totalGINIssuedQty}</p>
                <p className="text-xs text-muted-foreground">SL đã xuất</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalReturnedQty + totalGINReturnedQty}</p>
                <p className="text-xs text-muted-foreground">SL đã trả</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-1 gap-2 w-full sm:w-auto flex-wrap">
          <Input
            placeholder="Tìm kiếm theo mã, tên tài sản, nhân viên, số phiếu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="allocation">Phân bổ</SelectItem>
              <SelectItem value="return">Hoàn trả PB</SelectItem>
              <SelectItem value="gin_issue">Xuất kho</SelectItem>
              <SelectItem value="gin_return">Hoàn trả XK</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Thời gian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả thời gian</SelectItem>
              <SelectItem value="this_month">Tháng này</SelectItem>
              <SelectItem value="last_month">Tháng trước</SelectItem>
              <SelectItem value="last_3_months">3 tháng gần nhất</SelectItem>
              <SelectItem value="last_6_months">6 tháng gần nhất</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportToExcel}
            variant="outline"
            size="sm"
            disabled={filteredEvents.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Xuất Excel
          </Button>
          <Button
            onClick={fetchAllocations}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Timeline Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Loại</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead>Mã Tài sản</TableHead>
              <TableHead>Tên Tài sản</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead>Người nhận</TableHead>
              <TableHead>Dự án</TableHead>
              <TableHead>Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Chưa có dữ liệu lịch sử
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant="default"
                        className={
                          event.type === "allocation" 
                            ? "bg-blue-500 hover:bg-blue-600" 
                            : event.type === "return"
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : event.type === "gin_issue"
                            ? "bg-orange-500 hover:bg-orange-600 text-white"
                            : "bg-cyan-500 hover:bg-cyan-600 text-white"
                        }
                      >
                        {event.type === "allocation" ? (
                          <><ArrowUpRight className="h-3 w-3 mr-1" />Phân bổ</>
                        ) : event.type === "return" ? (
                          <><ArrowDownLeft className="h-3 w-3 mr-1" />Hoàn trả</>
                        ) : event.type === "gin_issue" ? (
                          <><FileOutput className="h-3 w-3 mr-1" />Xuất kho</>
                        ) : (
                          <><RotateCcw className="h-3 w-3 mr-1" />Hoàn trả</>
                        )}
                      </Badge>
                      {event.isPartialReturn && (
                        <Badge variant="outline" className="text-xs w-fit">
                          Một phần
                        </Badge>
                      )}
                      {event.ginNumber && (
                        <span className="text-xs text-muted-foreground">{event.ginNumber}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(event.date), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{event.assetId}</TableCell>
                  <TableCell>{event.assetName}</TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={
                      event.type === "allocation" || event.type === "gin_issue" 
                        ? "text-red-600" 
                        : "text-green-600"
                    }>
                      {event.type === "allocation" || event.type === "gin_issue" ? "-" : "+"}{event.quantity}
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">{event.unit}</span>
                    {event.isPartialReturn && event.originalQuantity && (
                      <div className="text-xs text-muted-foreground">
                        (từ tổng {event.originalQuantity})
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{event.employeeName}</TableCell>
                  <TableCell>{event.project || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.type === "allocation" || event.type === "gin_issue" ? (
                      event.purpose || "-"
                    ) : (
                      <div className="space-y-1">
                        {event.condition && <div>TT: {event.condition}</div>}
                        {event.reusability != null && <div>Tái SD: {event.reusability}%</div>}
                        {!event.condition && event.reusability == null && "-"}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
