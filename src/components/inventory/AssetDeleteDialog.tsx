import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Package, DollarSign, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface AssetMaster {
  id: string;
  asset_id: string;
  asset_name: string;
  sku: string;
  asset_type: string;
  cost_center: string;
  cost_basis: number;
  stock_quantity: number;
  closing_value?: number | null;
  closing_quantity?: number | null;
  brand?: string | null;
  unit?: string | null;
  warehouse_name?: string | null;
  useful_life_months?: number | null;
  depreciation_method?: string | null;
  is_consumable?: boolean;
}

interface AssetDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetMaster | null;
  userFullName: string;
  onDeleteSuccess: () => void;
}

export function AssetDeleteDialog({
  open,
  onOpenChange,
  asset,
  userFullName,
  onDeleteSuccess,
}: AssetDeleteDialogProps) {
  const { user } = useAuth();
  const [deleteQuantity, setDeleteQuantity] = useState(1);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const maxQuantity = asset?.stock_quantity || 1;

  // Sử dụng closing_value (giá trị thực đã tính VAT + hệ số) thay vì cost_basis
  const actualValue = asset?.closing_value ?? asset?.cost_basis ?? 0;
  const actualQuantity = asset?.closing_quantity ?? asset?.stock_quantity ?? 1;

  // Tính đơn giá = giá trị thực / số lượng thực
  const unitCost = actualQuantity > 0 ? actualValue / actualQuantity : 0;
  const deleteValue = unitCost * deleteQuantity;

  useEffect(() => {
    if (open && asset) {
      setDeleteQuantity(asset.stock_quantity || 1);
      setDeleteReason("");
      setConfirmName("");
    }
  }, [open, asset]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(Math.round(value));
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      equipment: "Thiết bị",
      tools: "Công cụ",
      materials: "Vật tư",
    };
    return labels[type] || type;
  };

  const handleDelete = async () => {
    if (!asset || !user) return;

    if (confirmName !== asset.asset_name) {
      toast.error("Tên tài sản không khớp. Vui lòng nhập chính xác.");
      return;
    }

    if (!deleteReason.trim()) {
      toast.error("Vui lòng nhập lý do xóa tài sản.");
      return;
    }

    if (deleteQuantity <= 0 || deleteQuantity > maxQuantity) {
      toast.error(`Số lượng phải từ 1 đến ${maxQuantity}`);
      return;
    }

    setIsDeleting(true);
    try {
      // Check for unreturned GIN items
      const { data: unreturnedItems, error: checkError } = await supabase
        .from("gin_items")
        .select("id, quantity, returned_quantity, status")
        .eq("asset_master_id", asset.id)
        .neq("status", "returned");

      if (checkError) throw checkError;

      // Calculate unreturned quantity
      const unreturnedQuantity = (unreturnedItems || []).reduce((sum, item) => {
        const returnedQty = item.returned_quantity || 0;
        return sum + (item.quantity - returnedQty);
      }, 0);

      if (unreturnedQuantity > 0) {
        toast.error(
          `Không thể xóa: Còn ${unreturnedQuantity} đơn vị chưa được hoàn trả từ phiếu xuất kho. Vui lòng hoàn trả trước khi xóa.`
        );
        setIsDeleting(false);
        return;
      }

      const remainingQuantity = maxQuantity - deleteQuantity;
      const remainingValue = unitCost * remainingQuantity;
      const remainingCostBasis =
        asset.cost_basis && maxQuantity > 0 ? (asset.cost_basis / maxQuantity) * remainingQuantity : 0;

      // Lưu lịch sử xóa với số lượng và giá trị được xóa (giá trị thực)
      const { error: historyError } = await supabase.from("asset_deletion_history").insert({
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        sku: asset.sku,
        asset_type: asset.asset_type,
        cost_center: asset.cost_center,
        cost_basis: deleteValue, // Giá trị thực được xóa = đơn giá thực * số lượng xóa
        stock_quantity: deleteQuantity, // Số lượng được xóa
        deleted_by: user.id,
        deleted_by_name: userFullName || user.email || "Unknown",
        deletion_reason: deleteReason,
        original_data: {
          ...asset,
          original_cost_basis: asset.cost_basis,
          original_closing_value: asset.closing_value,
          original_closing_quantity: asset.closing_quantity,
          original_stock_quantity: asset.stock_quantity,
          unit_cost: unitCost, // Lưu đơn giá để khôi phục chính xác
        },
      });

      if (historyError) {
        console.error("Error saving deletion history:", historyError);
        throw historyError;
      }

      if (deleteQuantity === maxQuantity) {
        // Xóa toàn bộ - gin_items sẽ tự động set null nhờ ON DELETE SET NULL
        const { error: deleteError } = await supabase.from("asset_master_data").delete().eq("id", asset.id);

        if (deleteError) throw deleteError;
        toast.success(`Đã xóa hoàn toàn "${asset.asset_name}" (${deleteQuantity} đơn vị)`);
      } else {
        // Xóa một phần - cập nhật số lượng và giá trị còn lại
        const { error: updateError } = await supabase
          .from("asset_master_data")
          .update({
            stock_quantity: remainingQuantity,
            cost_basis: Math.round(remainingCostBasis),
            closing_quantity: remainingQuantity,
            closing_value: Math.round(remainingValue),
            updated_at: new Date().toISOString(),
          })
          .eq("id", asset.id);

        if (updateError) throw updateError;
        toast.success(
          `Đã xóa ${deleteQuantity}/${maxQuantity} đơn vị "${asset.asset_name}". Còn lại: ${remainingQuantity} đơn vị`,
        );
      }

      onDeleteSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Lỗi xóa tài sản: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Xóa tài sản
          </DialogTitle>
          <DialogDescription>Chọn số lượng tài sản cần xóa và nhập lý do</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mã tài sản:</span>
              <Badge variant="outline" className="font-mono">
                {asset.asset_id}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tên:</span>
              <span className="font-medium">{asset.asset_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SKU:</span>
              <span className="font-mono text-sm">{asset.sku}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loại:</span>
              <Badge>{getTypeLabel(asset.asset_type)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Số lượng hiện tại:</span>
              <span className="font-semibold">{asset.stock_quantity}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Giá trị thực:</span>
              <span className="font-semibold">{formatCurrency(actualValue)} VNĐ</span>
            </div>
          </div>

          {/* Quantity Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Số lượng cần xóa (tối đa: {maxQuantity})
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={maxQuantity}
                value={deleteQuantity}
                onChange={(e) => setDeleteQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={() => setDeleteQuantity(maxQuantity)}>
                Tất cả
              </Button>
            </div>
          </div>

          {/* Value Calculation */}
          <div className="bg-destructive/5 rounded-lg p-4 space-y-2 border border-destructive/20">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <DollarSign className="h-4 w-4" />
              Tính toán giá trị xóa
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Đơn giá:</p>
                <p className="font-mono font-medium">{formatCurrency(unitCost)} VNĐ</p>
              </div>
              <div>
                <p className="text-muted-foreground">Giá trị xóa:</p>
                <p className="font-mono font-medium text-destructive">{formatCurrency(deleteValue)} VNĐ</p>
              </div>
            </div>
            {deleteQuantity < maxQuantity && (
              <div className="pt-2 border-t border-destructive/20 text-sm">
                <p className="text-muted-foreground">
                  Còn lại sau khi xóa: {maxQuantity - deleteQuantity} đơn vị (
                  {formatCurrency(unitCost * (maxQuantity - deleteQuantity))} VNĐ)
                </p>
              </div>
            )}
          </div>

          {/* Delete Reason */}
          <div className="space-y-2">
            <Label>
              Lý do xóa tài sản <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Nhập lý do xóa tài sản..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Confirm Name */}
          <div className="space-y-2">
            <Label>
              Nhập chính xác tên tài sản để xác nhận <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder={asset.asset_name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className={confirmName && confirmName !== asset.asset_name ? "border-destructive" : ""}
            />
            {confirmName && confirmName !== asset.asset_name && (
              <p className="text-xs text-destructive">Tên không khớp</p>
            )}
          </div>

          {/* Warning */}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || confirmName !== asset.asset_name || !deleteReason.trim()}
          >
            {isDeleting ? (
              <>
                <Trash2 className="h-4 w-4 mr-2 animate-pulse" />
                Đang xóa...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Xóa {deleteQuantity} đơn vị
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
