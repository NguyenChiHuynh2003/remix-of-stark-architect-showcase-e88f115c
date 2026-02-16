import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Search,
  Trash2,
  History,
  User,
  Calendar,
  FileText,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import * as XLSX from "xlsx";
import { AssetRestoreDialog } from "./AssetRestoreDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RestorationEntry {
  restored_quantity: number;
  restored_value: number;
  restored_by: string;
  restored_by_name: string;
  restored_at: string;
}

interface DeletionRecord {
  id: string;
  asset_id: string;
  asset_name: string;
  sku: string;
  asset_type: string;
  cost_center: string | null;
  cost_basis: number | null;
  stock_quantity: number | null;
  deleted_by: string;
  deleted_by_name: string | null;
  deleted_at: string;
  deletion_reason: string | null;
  original_data: any;
}

export function AssetDeletionHistory() {
  const [records, setRecords] = useState<DeletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DeletionRecord | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("asset_deletion_history")
        .select("*")
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast.error("Lỗi tải lịch sử xóa: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filteredRecords = records.filter((record) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      record.asset_id.toLowerCase().includes(searchLower) ||
      record.asset_name.toLowerCase().includes(searchLower) ||
      record.sku.toLowerCase().includes(searchLower) ||
      (record.deleted_by_name && record.deleted_by_name.toLowerCase().includes(searchLower)) ||
      (record.deletion_reason && record.deletion_reason.toLowerCase().includes(searchLower))
    );
  });

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      equipment: "Thiết bị",
      tools: "Công cụ",
      materials: "Vật tư",
    };
    return labels[type] || type;
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  const exportToExcel = () => {
    const exportData = filteredRecords.map((record) => ({
      "Mã tài sản": record.asset_id,
      "Tên tài sản": record.asset_name,
      SKU: record.sku,
      Loại: getTypeLabel(record.asset_type),
      "Cost Center": record.cost_center || "-",
      "Giá trị": record.cost_basis || 0,
      "Số lượng tồn": record.stock_quantity || 0,
      "Người xóa": record.deleted_by_name || "-",
      "Thời gian xóa": format(new Date(record.deleted_at), "dd/MM/yyyy HH:mm", { locale: vi }),
      "Lý do xóa": record.deletion_reason || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lịch sử xóa tài sản");
    XLSX.writeFile(wb, `lich_su_xoa_tai_san_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
    toast.success("Đã xuất file Excel thành công");
  };

  const handleRestoreClick = (record: DeletionRecord) => {
    setSelectedRecord(record);
    setRestoreDialogOpen(true);
  };

  const toggleRowExpanded = (recordId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const getRestorationHistory = (record: DeletionRecord): RestorationEntry[] => {
    return record.original_data?.restoration_history || [];
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Lịch sử xóa tài sản
              </CardTitle>
              <CardDescription>Theo dõi và khôi phục tài sản đã bị xóa</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {filteredRecords.length} bản ghi
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo mã, tên, SKU, người xóa, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={fetchRecords}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Làm mới
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Mã tài sản</TableHead>
                    <TableHead className="min-w-[200px]">Tên tài sản</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Giá trị</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="min-w-[150px]">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        Người xóa
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[150px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Thời gian
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Lý do xóa
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Đang tải...
                      </TableCell>
                    </TableRow>
                  ) : filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        <Trash2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        {searchQuery ? "Không tìm thấy kết quả" : "Chưa có lịch sử xóa tài sản"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => {
                      const restorationHistory = getRestorationHistory(record);
                      const hasHistory = restorationHistory.length > 0;
                      const isExpanded = expandedRows.has(record.id);

                      return (
                        <>
                          <TableRow key={record.id}>
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                {hasHistory && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleRowExpanded(record.id)}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <span>{record.asset_id}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{record.asset_name}</p>
                                <p className="text-xs text-muted-foreground">SKU: {record.sku}</p>
                                {hasHistory && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    Đã khôi phục {restorationHistory.length} lần
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getTypeLabel(record.asset_type)}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.cost_basis)}</TableCell>
                            <TableCell className="text-right">{record.stock_quantity || 0}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-medium">{record.deleted_by_name || "Unknown"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">
                                  {format(new Date(record.deleted_at), "dd/MM/yyyy", { locale: vi })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(record.deleted_at), "HH:mm:ss", { locale: vi })}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {record.deletion_reason || "-"}
                              </p>
                            </TableCell>
                            <TableCell className="text-center">
                              {/* <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestoreClick(record)}
                                className="text-primary hover:text-primary"
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Khôi phục
                              </Button> */}
                            </TableCell>
                          </TableRow>
                          {/* Restoration History Sub-rows */}
                          {hasHistory && isExpanded && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={9} className="p-0">
                                <div className="p-4 space-y-2">
                                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Lịch sử khôi phục
                                  </p>
                                  <div className="space-y-2">
                                    {restorationHistory.map((entry, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center justify-between bg-background rounded-lg p-3 border"
                                      >
                                        <div className="flex items-center gap-4">
                                          <Badge
                                            variant="outline"
                                            className="bg-green-500/10 text-green-600 border-green-500/30"
                                          >
                                            +{entry.restored_quantity} đơn vị
                                          </Badge>
                                          <span className="text-sm font-mono">
                                            {formatCurrency(entry.restored_value)} VNĐ
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {entry.restored_by_name}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(entry.restored_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <AssetRestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        record={selectedRecord}
        onRestoreSuccess={fetchRecords}
      />
    </>
  );
}
