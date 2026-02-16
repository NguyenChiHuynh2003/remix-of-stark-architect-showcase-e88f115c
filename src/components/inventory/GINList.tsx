import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Eye, Calendar, Trash2 } from "lucide-react";
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
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { GINDialog } from "./GINDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface GIN {
  id: string;
  gin_number: string;
  issue_date: string;
  recipient: string | null;
  purpose: string | null;
  project_id: string | null;
  total_value: number;
  notes: string | null;
}

interface GroupedGIN {
  date: string;
  displayDate: string;
  gins: GIN[];
  totalValue: number;
}

export function GINList() {
  const { canEdit } = useUserRole();
  const canViewValues = canEdit("inventory");
  const [gins, setGins] = useState<GIN[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGIN, setEditingGIN] = useState<GIN | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGIN, setDeletingGIN] = useState<GIN | null>(null);

  const fetchGINs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("goods_issue_notes")
        .select("*")
        .order("issue_date", { ascending: false });

      if (error) throw error;
      setGins(data || []);
    } catch (error: any) {
      toast.error("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGINs();
  }, []);

  const filteredGINs = gins.filter((gin) =>
    Object.values(gin).some((value) =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Group GINs by date
  const groupedGINs = useMemo(() => {
    const groups: GroupedGIN[] = [];
    let currentDate: string | null = null;
    let currentGroup: GIN[] = [];

    filteredGINs.forEach((gin) => {
      const ginDate = gin.issue_date.split("T")[0];
      
      if (currentDate !== ginDate) {
        if (currentGroup.length > 0 && currentDate) {
          groups.push({
            date: currentDate,
            displayDate: format(parseISO(currentDate), "EEEE, dd/MM/yyyy", { locale: vi }),
            gins: currentGroup,
            totalValue: currentGroup.reduce((sum, g) => sum + Number(g.total_value), 0),
          });
        }
        currentDate = ginDate;
        currentGroup = [gin];
      } else {
        currentGroup.push(gin);
      }
    });

    // Add last group
    if (currentGroup.length > 0 && currentDate) {
      groups.push({
        date: currentDate,
        displayDate: format(parseISO(currentDate), "EEEE, dd/MM/yyyy", { locale: vi }),
        gins: currentGroup,
        totalValue: currentGroup.reduce((sum, g) => sum + Number(g.total_value), 0),
      });
    }

    return groups;
  }, [filteredGINs]);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGIN(null);
    fetchGINs();
  };

  const handleDeleteGIN = async () => {
    if (!deletingGIN) return;
    
    try {
      // First delete related gin_items
      const { error: itemsError } = await supabase
        .from("gin_items")
        .delete()
        .eq("gin_id", deletingGIN.id);
      
      if (itemsError) throw itemsError;
      
      // Then delete the GIN
      const { error: ginError } = await supabase
        .from("goods_issue_notes")
        .delete()
        .eq("id", deletingGIN.id);
      
      if (ginError) throw ginError;
      
      toast.success(`Đã xóa phiếu ${deletingGIN.gin_number}`);
      fetchGINs();
    } catch (error: any) {
      toast.error("Lỗi xóa phiếu: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setDeletingGIN(null);
    }
  };

  const totalStats = useMemo(() => {
    return {
      count: filteredGINs.length,
      totalValue: filteredGINs.reduce((sum, g) => sum + Number(g.total_value), 0),
    };
  }, [filteredGINs]);

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{totalStats.count}</div>
            <div className="text-sm text-muted-foreground">Tổng phiếu xuất</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {canViewValues ? `${totalStats.totalValue.toLocaleString("vi-VN")} ₫` : "-"}
            </div>
            <div className="text-sm text-muted-foreground">Tổng giá trị xuất</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Tìm kiếm phiếu xuất kho..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchGINs}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Tạo Phiếu Xuất
          </Button>
        </div>
      </div>

      {/* Grouped by date */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : groupedGINs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Chưa có dữ liệu
          </div>
        ) : (
          groupedGINs.map((group, groupIndex) => (
            <div key={group.date} className="space-y-2">
              {/* Date separator */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex items-center gap-2 bg-orange-500/10 px-4 py-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <span className="font-semibold text-orange-600 capitalize">
                    {group.displayDate}
                  </span>
                </div>
                <div className="flex-1 h-px bg-border" />
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {group.gins.length} phiếu{canViewValues ? ` - ${group.totalValue.toLocaleString("vi-VN")} ₫` : ""}
                </Badge>
              </div>

              {/* GINs table for this date */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Số Phiếu</TableHead>
                      <TableHead>Giờ Xuất</TableHead>
                      <TableHead>Người Nhận</TableHead>
                      <TableHead>Mục đích</TableHead>
                      <TableHead className="text-right">Tổng Giá Trị</TableHead>
                      <TableHead className="w-[60px]">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.gins.map((gin) => {
                      // Parse ISO string and display time correctly
                      const issueDate = new Date(gin.issue_date);
                      const hours = issueDate.getUTCHours().toString().padStart(2, '0');
                      const minutes = issueDate.getUTCMinutes().toString().padStart(2, '0');
                      
                      return (
                      <TableRow key={gin.id}>
                        <TableCell className="font-medium">{gin.gin_number}</TableCell>
                        <TableCell>
                          {hours}:{minutes}
                        </TableCell>
                        <TableCell>{gin.recipient || "-"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {gin.purpose || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">
                          {canViewValues ? `${Number(gin.total_value).toLocaleString("vi-VN")} ₫` : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingGIN(gin);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingGIN(gin);
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
              {groupIndex < groupedGINs.length - 1 && (
                <div className="py-2" />
              )}
            </div>
          ))
        )}
      </div>

      <GINDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        editingGIN={editingGIN}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa phiếu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa phiếu <strong>{deletingGIN?.gin_number}</strong>? 
              Hành động này không thể hoàn tác và tồn kho sẽ KHÔNG được hoàn lại tự động.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteGIN}
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
