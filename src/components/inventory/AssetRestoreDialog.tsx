import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, AlertTriangle, CheckCircle, Package, DollarSign, Info } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

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

interface AssetRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DeletionRecord | null;
  onRestoreSuccess: () => void;
}

export function AssetRestoreDialog({
  open,
  onOpenChange,
  record,
  onRestoreSuccess,
}: AssetRestoreDialogProps) {
  const [restoreQuantity, setRestoreQuantity] = useState(1);
  const [isRestoring, setIsRestoring] = useState(false);
  const [existingAsset, setExistingAsset] = useState<any>(null);
  const [checkingAsset, setCheckingAsset] = useState(false);

  const maxQuantity = record?.stock_quantity || 1;
  
  // Lấy đơn giá từ original_data (đã lưu khi xóa) hoặc tính từ cost_basis/stock_quantity
  const savedUnitCost = record?.original_data?.unit_cost;
  const unitCost = savedUnitCost ?? (
    record?.cost_basis && record?.stock_quantity 
      ? record.cost_basis / record.stock_quantity 
      : record?.cost_basis || 0
  );
  const restoreValue = unitCost * restoreQuantity;

  useEffect(() => {
    if (open && record) {
      setRestoreQuantity(maxQuantity);
      checkExistingAsset();
    }
  }, [open, record]);

  const checkExistingAsset = async () => {
    if (!record) return;
    
    setCheckingAsset(true);
    try {
      // Check if asset with same asset_id already exists
      const { data, error } = await supabase
        .from("asset_master_data")
        .select("id, asset_id, asset_name, stock_quantity, cost_basis, closing_value, closing_quantity")
        .eq("asset_id", record.asset_id)
        .maybeSingle();

      if (error) throw error;
      setExistingAsset(data);
    } catch (error: any) {
      console.error("Error checking existing asset:", error);
    } finally {
      setCheckingAsset(false);
    }
  };

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

  const handleRestore = async () => {
    if (!record) return;

    if (restoreQuantity <= 0 || restoreQuantity > maxQuantity) {
      toast.error(`Số lượng phải từ 1 đến ${maxQuantity}`);
      return;
    }

    setIsRestoring(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Không tìm thấy người dùng");

      if (existingAsset) {
        // Asset exists - update quantity and cost (closing_value)
        const newQuantity = (existingAsset.stock_quantity || 0) + restoreQuantity;
        const newClosingValue = (existingAsset.closing_value || existingAsset.cost_basis || 0) + restoreValue;
        // Also update cost_basis proportionally if available
        const originalCostBasisPerUnit = record.original_data?.original_cost_basis && record.original_data?.original_stock_quantity
          ? record.original_data.original_cost_basis / record.original_data.original_stock_quantity
          : 0;
        const newCostBasis = (existingAsset.cost_basis || 0) + (originalCostBasisPerUnit * restoreQuantity);

        const { error: updateError } = await supabase
          .from("asset_master_data")
          .update({
            stock_quantity: newQuantity,
            closing_quantity: newQuantity,
            closing_value: Math.round(newClosingValue),
            cost_basis: Math.round(newCostBasis),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAsset.id);

        if (updateError) throw updateError;

        toast.success(
          `Đã cộng thêm ${restoreQuantity} vào tài sản "${existingAsset.asset_name}"`
        );
      } else {
        // Asset doesn't exist - create new from original_data
        const originalData = record.original_data || {};
        
        // Calculate cost_basis proportionally from original
        const originalCostBasisPerUnit = originalData.original_cost_basis && originalData.original_stock_quantity
          ? originalData.original_cost_basis / originalData.original_stock_quantity
          : 0;
        const newCostBasis = Math.round(originalCostBasisPerUnit * restoreQuantity);
        
        const newAssetData = {
          asset_id: record.asset_id,
          asset_name: record.asset_name,
          sku: record.sku,
          asset_type: record.asset_type as "equipment" | "tools" | "materials",
          cost_center: record.cost_center || originalData.cost_center || "KHO",
          cost_basis: newCostBasis,
          stock_quantity: restoreQuantity,
          closing_quantity: restoreQuantity,
          closing_value: Math.round(restoreValue),
          created_by: user.id,
          current_status: "in_stock" as const,
          // Restore other fields from original data
          brand: originalData.brand || null,
          unit: originalData.unit || null,
          warehouse_name: originalData.warehouse_name || "KHO VP KBA",
          notes: `Khôi phục từ lịch sử xóa lúc ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: vi })}`,
          useful_life_months: originalData.useful_life_months || null,
          depreciation_method: originalData.depreciation_method || null,
          is_consumable: originalData.is_consumable || false,
        };

        const { error: insertError } = await supabase
          .from("asset_master_data")
          .insert(newAssetData);

        if (insertError) throw insertError;

        toast.success(`Đã khôi phục ${restoreQuantity} "${record.asset_name}"`);
      }

      // Get user info for restoration log
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const restoredByName = profileData?.full_name || user.email || "Unknown";

      // Update or delete deletion history record based on restored quantity
      const restoredQty = Number(restoreQuantity);
      const maxQty = Number(maxQuantity);
      
      console.log("Restore comparison:", { restoredQty, maxQty, isEqual: restoredQty >= maxQty });
      
      if (restoredQty >= maxQty) {
        // All quantity restored - delete the history record completely
        console.log("Deleting history record:", record.id);
        const { error: deleteError } = await supabase
          .from("asset_deletion_history")
          .delete()
          .eq("id", record.id);

        if (deleteError) throw deleteError;
      } else {
        // Partial restore - update the history record and add restoration log
        const remainingQuantity = maxQty - restoredQty;
        const remainingValue = unitCost * remainingQuantity;

        console.log("Updating history record:", { 
          recordId: record.id, 
          remainingQuantity, 
          remainingValue 
        });

        // Build restoration history entry
        const restorationEntry = {
          restored_quantity: restoredQty,
          restored_value: Math.round(restoreValue),
          restored_by: user.id,
          restored_by_name: restoredByName,
          restored_at: new Date().toISOString(),
        };

        // Get existing restoration history
        const existingHistory = record.original_data?.restoration_history || [];
        const updatedHistory = [...existingHistory, restorationEntry];

        // Update original_data with new restoration history
        const updatedOriginalData = {
          ...record.original_data,
          restoration_history: updatedHistory,
        };

        const { error: updateHistoryError } = await supabase
          .from("asset_deletion_history")
          .update({
            stock_quantity: remainingQuantity,
            cost_basis: Math.round(remainingValue),
            original_data: updatedOriginalData,
          })
          .eq("id", record.id);

        if (updateHistoryError) throw updateHistoryError;
      }

      onRestoreSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Restore error:", error);
      toast.error("Lỗi khôi phục: " + error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Khôi phục tài sản
          </DialogTitle>
          <DialogDescription>
            Kiểm tra thông tin và chọn số lượng tài sản cần khôi phục
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mã tài sản:</span>
              <Badge variant="outline" className="font-mono">{record.asset_id}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tên:</span>
              <span className="font-medium">{record.asset_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SKU:</span>
              <span className="font-mono text-sm">{record.sku}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loại:</span>
              <Badge>{getTypeLabel(record.asset_type)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Đã xóa lúc:</span>
              <span className="text-sm">
                {format(new Date(record.deleted_at), "dd/MM/yyyy HH:mm", { locale: vi })}
              </span>
            </div>
          </div>

          {/* Existing Asset Warning */}
          {checkingAsset ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Đang kiểm tra tài sản hiện có...</AlertDescription>
            </Alert>
          ) : existingAsset ? (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <p className="font-medium text-yellow-600">Tài sản đã tồn tại trong hệ thống!</p>
                <p className="text-sm mt-1">
                  Hiện có: {existingAsset.stock_quantity || 0} đơn vị, 
                  giá trị: {formatCurrency(existingAsset.closing_value || existingAsset.cost_basis || 0)} VNĐ
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Số lượng khôi phục sẽ được cộng thêm vào tài sản hiện có.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <p className="text-green-600">
                  Tài sản chưa tồn tại - sẽ tạo mới khi khôi phục.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Quantity Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Số lượng khôi phục (tối đa: {maxQuantity})
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={maxQuantity}
                value={restoreQuantity}
                onChange={(e) => setRestoreQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreQuantity(maxQuantity)}
              >
                Tất cả
              </Button>
            </div>
          </div>

          {/* Value Calculation */}
          <div className="bg-primary/5 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Tính toán giá trị
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Đơn giá:</p>
                <p className="font-mono font-medium">{formatCurrency(unitCost)} VNĐ</p>
              </div>
              <div>
                <p className="text-muted-foreground">Giá trị khôi phục:</p>
                <p className="font-mono font-medium text-primary">
                  {formatCurrency(restoreValue)} VNĐ
                </p>
              </div>
            </div>
            {restoreQuantity < maxQuantity && (
              <div className="pt-2 border-t border-border/50 text-sm">
                <p className="text-muted-foreground">
                  Còn lại trong lịch sử: {maxQuantity - restoreQuantity} đơn vị 
                  ({formatCurrency(unitCost * (maxQuantity - restoreQuantity))} VNĐ)
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleRestore} disabled={isRestoring || checkingAsset}>
            {isRestoring ? (
              <>
                <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                Đang khôi phục...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Khôi phục {restoreQuantity} đơn vị
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
