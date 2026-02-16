import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Eye, Upload, Calendar, Trash2, Download } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadRobotoFont, arrayBufferToBase64 } from "@/lib/pdfFonts";
import { sanitizeExcelRow } from "@/lib/excelSanitizer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isSameDay, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { GRNDialog } from "./GRNDialog";
import { GRNImportDialog } from "./GRNImportDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface GRN {
  id: string;
  grn_number: string;
  receipt_date: string;
  supplier: string;
  total_value: number;
  notes: string;
}

interface GroupedGRN {
  date: string;
  displayDate: string;
  grns: GRN[];
  totalValue: number;
}

export function GRNList() {
  const { canEdit } = useUserRole();
  const canViewValues = canEdit("inventory");
  const [grns, setGrns] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingGRN, setEditingGRN] = useState<GRN | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGRN, setDeletingGRN] = useState<GRN | null>(null);

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("goods_receipt_notes")
        .select("*")
        .order("receipt_date", { ascending: false });

      if (error) throw error;
      setGrns(data || []);
    } catch (error: any) {
      toast.error("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGRNs();
  }, []);

  const filteredGRNs = grns.filter((grn) =>
    Object.values(grn).some((value) =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Group GRNs by date
  const groupedGRNs = useMemo(() => {
    const groups: GroupedGRN[] = [];
    let currentDate: string | null = null;
    let currentGroup: GRN[] = [];

    filteredGRNs.forEach((grn) => {
      const grnDate = grn.receipt_date.split("T")[0];
      
      if (currentDate !== grnDate) {
        if (currentGroup.length > 0 && currentDate) {
          groups.push({
            date: currentDate,
            displayDate: format(parseISO(currentDate), "EEEE, dd/MM/yyyy", { locale: vi }),
            grns: currentGroup,
            totalValue: currentGroup.reduce((sum, g) => sum + Number(g.total_value), 0),
          });
        }
        currentDate = grnDate;
        currentGroup = [grn];
      } else {
        currentGroup.push(grn);
      }
    });

    // Add last group
    if (currentGroup.length > 0 && currentDate) {
      groups.push({
        date: currentDate,
        displayDate: format(parseISO(currentDate), "EEEE, dd/MM/yyyy", { locale: vi }),
        grns: currentGroup,
        totalValue: currentGroup.reduce((sum, g) => sum + Number(g.total_value), 0),
      });
    }

    return groups;
  }, [filteredGRNs]);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGRN(null);
    fetchGRNs();
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    fetchGRNs();
  };

  const handleDeleteGRN = async () => {
    if (!deletingGRN) return;
    
    try {
      // First delete related grn_items
      const { error: itemsError } = await supabase
        .from("grn_items")
        .delete()
        .eq("grn_id", deletingGRN.id);
      
      if (itemsError) throw itemsError;
      
      // Then delete the GRN
      const { error: grnError } = await supabase
        .from("goods_receipt_notes")
        .delete()
        .eq("id", deletingGRN.id);
      
      if (grnError) throw grnError;
      
      toast.success(`Đã xóa phiếu ${deletingGRN.grn_number}`);
      fetchGRNs();
    } catch (error: any) {
      toast.error("Lỗi xóa phiếu: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setDeletingGRN(null);
    }
  };

  const totalStats = useMemo(() => {
    return {
      count: filteredGRNs.length,
      totalValue: filteredGRNs.reduce((sum, g) => sum + Number(g.total_value), 0),
    };
  }, [filteredGRNs]);

  const exportData = useMemo(() => {
    return filteredGRNs.map((grn, i) => {
      const d = new Date(grn.receipt_date);
      return sanitizeExcelRow({
        "STT": i + 1,
        "Số Phiếu": grn.grn_number,
        "Ngày Nhập": format(d, "dd/MM/yyyy"),
        "Giờ": `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`,
        "Tổng Giá Trị": canViewValues ? Number(grn.total_value) : "",
        "Ghi Chú": grn.notes || "",
      });
    });
  }, [filteredGRNs, canViewValues]);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phiếu Nhập Kho");
    XLSX.writeFile(wb, `lich-su-phieu-nhap-kho-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPDF = async () => {
    const fonts = await loadRobotoFont();
    const doc = new jsPDF();
    doc.addFileToVFS("NotoSans-Regular.ttf", arrayBufferToBase64(fonts.normal));
    doc.addFileToVFS("NotoSans-Bold.ttf", arrayBufferToBase64(fonts.bold));
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    doc.setFont("NotoSans");
    doc.setFontSize(16);
    doc.text("Lịch sử Phiếu Nhập Kho", 14, 20);
    doc.setFontSize(10);
    doc.text(`Ngày xuất: ${format(new Date(), "dd/MM/yyyy")}`, 14, 28);

    const headers = ["STT", "Số Phiếu", "Ngày Nhập", "Giờ", ...(canViewValues ? ["Tổng Giá Trị"] : []), "Ghi Chú"];
    const rows = exportData.map((r: any) => {
      const row = [r["STT"], r["Số Phiếu"], r["Ngày Nhập"], r["Giờ"]];
      if (canViewValues) row.push(Number(r["Tổng Giá Trị"]).toLocaleString("vi-VN") + " ₫");
      row.push(r["Ghi Chú"]);
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      styles: { font: "NotoSans", fontSize: 9 },
      headStyles: { font: "NotoSans", fontStyle: "bold" },
    });

    doc.save(`lich-su-phieu-nhap-kho-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{totalStats.count}</div>
            <div className="text-sm text-muted-foreground">Tổng phiếu nhập</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {canViewValues ? `${totalStats.totalValue.toLocaleString("vi-VN")} ₫` : "-"}
            </div>
            <div className="text-sm text-muted-foreground">Tổng giá trị</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Tìm kiếm phiếu nhập kho..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchGRNs}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            disabled={filteredGRNs.length === 0}
            size="sm"
          />
          <Button
            onClick={() => setImportDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Nhập Excel
          </Button>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Tạo Phiếu Nhập
          </Button>
        </div>
      </div>

      {/* Grouped by date */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : groupedGRNs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Chưa có dữ liệu
          </div>
        ) : (
          groupedGRNs.map((group, groupIndex) => (
            <div key={group.date} className="space-y-2">
              {/* Date separator */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary capitalize">
                    {group.displayDate}
                  </span>
                </div>
                <div className="flex-1 h-px bg-border" />
                <Badge variant="secondary">
                  {group.grns.length} phiếu{canViewValues ? ` - ${group.totalValue.toLocaleString("vi-VN")} ₫` : ""}
                </Badge>
              </div>

              {/* GRNs table for this date */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Số Phiếu</TableHead>
                      <TableHead>Giờ Nhập</TableHead>
                      <TableHead className="text-right">Tổng Giá Trị</TableHead>
                      <TableHead>Ghi Chú</TableHead>
                      <TableHead className="w-[60px]">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.grns.map((grn) => {
                      // Parse ISO string and display time correctly
                      const receiptDate = new Date(grn.receipt_date);
                      const hours = receiptDate.getUTCHours().toString().padStart(2, '0');
                      const minutes = receiptDate.getUTCMinutes().toString().padStart(2, '0');
                      
                      return (
                      <TableRow key={grn.id}>
                        <TableCell className="font-medium">{grn.grn_number}</TableCell>
                        <TableCell>
                          {hours}:{minutes}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {canViewValues ? `${Number(grn.total_value).toLocaleString("vi-VN")} ₫` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {grn.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingGRN(grn);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingGRN(grn);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Separator between date groups */}
              {groupIndex < groupedGRNs.length - 1 && (
                <div className="py-2" />
              )}
            </div>
          ))
        )}
      </div>

      <GRNDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        editingGRN={editingGRN}
      />

      <GRNImportDialog
        open={importDialogOpen}
        onClose={handleCloseImportDialog}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa phiếu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa phiếu <strong>{deletingGRN?.grn_number}</strong>? 
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteGRN}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
