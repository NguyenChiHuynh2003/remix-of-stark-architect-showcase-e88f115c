import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, ArrowLeft, CheckCircle, Clock, AlertTriangle, Package } from "lucide-react";
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
import { format } from "date-fns";
import { GINReturnDialog } from "./GINReturnDialog";

interface GINItem {
  id: string;
  gin_id: string;
  asset_master_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: string;
  returned_quantity: number;
  return_date: string | null;
  return_condition: string | null;
  return_notes: string | null;
  asset_master_data: {
    asset_id: string;
    asset_name: string;
    unit: string | null;
    asset_type: string;
  } | null;
  goods_issue_notes: {
    gin_number: string;
    issue_date: string;
    recipient: string | null;
    purpose: string | null;
  } | null;
}

export function GINReturnList() {
  const [ginItems, setGinItems] = useState<GINItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("issued");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GINItem | null>(null);

  const fetchGINItems = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("gin_items")
        .select(`
          *,
          asset_master_data(asset_id, asset_name, unit, asset_type),
          goods_issue_notes(gin_number, issue_date, recipient, purpose)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGinItems((data || []) as unknown as GINItem[]);
    } catch (error: any) {
      toast.error("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGINItems();
  }, []);

  const filteredItems = ginItems.filter((item) => {
    const matchesSearch = 
      item.asset_master_data?.asset_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.asset_master_data?.asset_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.goods_issue_notes?.gin_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.goods_issue_notes?.recipient?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || (item.status || "issued") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Count statistics
  const countByStatus = {
    issued: ginItems.filter(i => (i.status || "issued") === "issued").length,
    returned: ginItems.filter(i => i.status === "returned").length,
    partial_returned: ginItems.filter(i => i.status === "partial_returned").length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      issued: "bg-orange-500",
      returned: "bg-blue-500",
      partial_returned: "bg-yellow-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      issued: "Đã xuất",
      returned: "Đã hoàn trả",
      partial_returned: "Hoàn trả một phần",
    };
    return labels[status] || status;
  };

  const handleReturn = (item: GINItem) => {
    setSelectedItem(item);
    setReturnDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setReturnDialogOpen(false);
    setSelectedItem(null);
    fetchGINItems();
  };

  const getRemainingQuantity = (item: GINItem) => {
    return item.quantity - (item.returned_quantity || 0);
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Package className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{countByStatus.issued}</p>
                <p className="text-xs text-muted-foreground">Đã xuất kho</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{countByStatus.returned}</p>
                <p className="text-xs text-muted-foreground">Đã hoàn trả</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{countByStatus.partial_returned}</p>
                <p className="text-xs text-muted-foreground">Hoàn trả một phần</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-1 gap-2 w-full sm:w-auto">
          <Input
            placeholder="Tìm kiếm vật tư đã xuất..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Lọc trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="issued">Đã xuất</SelectItem>
              <SelectItem value="returned">Đã hoàn trả</SelectItem>
              <SelectItem value="partial_returned">Hoàn trả một phần</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={fetchGINItems}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Số Phiếu XK</TableHead>
              <TableHead>Mã Vật tư</TableHead>
              <TableHead>Tên Vật tư</TableHead>
              <TableHead className="text-right">SL Xuất</TableHead>
              <TableHead className="text-right">SL Còn lại</TableHead>
              <TableHead>Người nhận</TableHead>
              <TableHead>Ngày xuất</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Chưa có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-orange-600">
                    {item.goods_issue_notes?.gin_number || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.asset_master_data?.asset_id}
                  </TableCell>
                  <TableCell>{item.asset_master_data?.asset_name}</TableCell>
                  <TableCell className="text-right">
                    {item.quantity}
                    <span className="text-muted-foreground text-xs ml-1">
                      {item.asset_master_data?.unit || "cái"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {getRemainingQuantity(item)}
                    <span className="text-muted-foreground text-xs ml-1">
                      {item.asset_master_data?.unit || "cái"}
                    </span>
                  </TableCell>
                  <TableCell>{item.goods_issue_notes?.recipient || "-"}</TableCell>
                  <TableCell>
                    {item.goods_issue_notes?.issue_date
                      ? format(new Date(item.goods_issue_notes.issue_date), "dd/MM/yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status || "issued")}>
                      {getStatusLabel(item.status || "issued")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(item.status === "issued" || item.status === "partial_returned" || !item.status) && getRemainingQuantity(item) > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReturn(item)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Hoàn trả
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GINReturnDialog
        open={returnDialogOpen}
        onClose={handleCloseDialog}
        ginItem={selectedItem}
      />
    </div>
  );
}
