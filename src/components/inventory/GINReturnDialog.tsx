import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft } from "lucide-react";

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

interface GINReturnDialogProps {
  open: boolean;
  onClose: () => void;
  ginItem: GINItem | null;
}

export function GINReturnDialog({ open, onClose, ginItem }: GINReturnDialogProps) {
  const [formData, setFormData] = useState({
    return_quantity: "",
    return_condition: "good",
    return_notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ginItem && open) {
      const remainingQty = ginItem.quantity - (ginItem.returned_quantity || 0);
      setFormData({
        return_quantity: remainingQty.toString(),
        return_condition: "good",
        return_notes: "",
      });
    }
  }, [ginItem, open]);

  const getRemainingQuantity = () => {
    if (!ginItem) return 0;
    return ginItem.quantity - (ginItem.returned_quantity || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ginItem) return;

    const returnQty = parseInt(formData.return_quantity) || 0;
    const remainingQty = getRemainingQuantity();

    if (returnQty <= 0) {
      toast.error("Số lượng hoàn trả phải lớn hơn 0");
      return;
    }

    if (returnQty > remainingQty) {
      toast.error(`Số lượng hoàn trả không được vượt quá số lượng còn lại (${remainingQty})`);
      return;
    }

    setSaving(true);
    try {
      const newReturnedQty = (ginItem.returned_quantity || 0) + returnQty;
      const isFullyReturned = newReturnedQty >= ginItem.quantity;
      const newStatus = isFullyReturned ? "returned" : "partial_returned";

      // Update gin_item
      const { error: updateItemError } = await supabase
        .from("gin_items")
        .update({
          status: newStatus,
          returned_quantity: newReturnedQty,
          return_date: new Date().toISOString(),
          return_condition: formData.return_condition,
          return_notes: formData.return_notes || null,
        })
        .eq("id", ginItem.id);

      if (updateItemError) throw updateItemError;

      // Update asset_master_data - return stock
      const { data: currentAsset, error: fetchError } = await supabase
        .from("asset_master_data")
        .select("stock_quantity, outbound_quantity, outbound_value, inbound_quantity, closing_quantity, closing_value, cost_basis")
        .eq("id", ginItem.asset_master_id)
        .single();

      if (fetchError) throw fetchError;

      const unitCost = currentAsset.cost_basis || 0;
      const newStockQty = (currentAsset.stock_quantity || 0) + returnQty;
      const newOutboundQty = Math.max(0, (currentAsset.outbound_quantity || 0) - returnQty);
      const newOutboundValue = Math.max(0, (currentAsset.outbound_value || 0) - (returnQty * unitCost));
      const newClosingQty = (currentAsset.inbound_quantity || 0) - newOutboundQty;
      const newClosingValue = newClosingQty * unitCost;

      const { error: updateAssetError } = await supabase
        .from("asset_master_data")
        .update({
          stock_quantity: newStockQty,
          outbound_quantity: newOutboundQty,
          outbound_value: newOutboundValue,
          closing_quantity: newClosingQty,
          closing_value: newClosingValue,
          current_status: newStockQty > 0 ? "in_stock" : "allocated",
        })
        .eq("id", ginItem.asset_master_id);

      if (updateAssetError) throw updateAssetError;

      toast.success(`Hoàn trả ${returnQty} ${ginItem.asset_master_data?.unit || "đơn vị"} thành công`);
      onClose();
    } catch (error: any) {
      toast.error("Lỗi hoàn trả: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!ginItem) return null;

  const remainingQty = getRemainingQuantity();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5 text-primary" />
            Hoàn trả Vật tư Xuất kho
          </DialogTitle>
          <DialogDescription>
            Hoàn trả vật tư từ phiếu xuất kho về kho
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />
              <span className="font-medium">{ginItem.asset_master_data?.asset_name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Mã: {ginItem.asset_master_data?.asset_id}</p>
              <p>Phiếu XK: <span className="text-orange-600 font-medium">{ginItem.goods_issue_notes?.gin_number}</span></p>
              <p>Người nhận: {ginItem.goods_issue_notes?.recipient || "-"}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span>SL Xuất: <Badge variant="outline">{ginItem.quantity}</Badge></span>
              <span>SL Còn lại: <Badge className="bg-orange-500">{remainingQty}</Badge></span>
            </div>
          </div>

          {/* Return Quantity */}
          <div className="space-y-2">
            <Label htmlFor="return_quantity">Số lượng hoàn trả *</Label>
            <Input
              id="return_quantity"
              type="number"
              min="1"
              max={remainingQty}
              value={formData.return_quantity}
              onChange={(e) => setFormData({ ...formData, return_quantity: e.target.value })}
              placeholder={`Tối đa ${remainingQty}`}
            />
          </div>

          {/* Return Condition */}
          <div className="space-y-2">
            <Label htmlFor="return_condition">Tình trạng hoàn trả</Label>
            <Select
              value={formData.return_condition}
              onValueChange={(value) => setFormData({ ...formData, return_condition: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn tình trạng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Tốt - Có thể tái sử dụng</SelectItem>
                <SelectItem value="damaged">Hư hỏng nhẹ</SelectItem>
                <SelectItem value="needs_repair">Cần sửa chữa</SelectItem>
                <SelectItem value="unusable">Không thể sử dụng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="return_notes">Ghi chú</Label>
            <Textarea
              id="return_notes"
              value={formData.return_notes}
              onChange={(e) => setFormData({ ...formData, return_notes: e.target.value })}
              placeholder="Ghi chú về tình trạng hoàn trả..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang xử lý..." : "Xác nhận hoàn trả"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
