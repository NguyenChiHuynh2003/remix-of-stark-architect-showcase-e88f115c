import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ComboboxWithInput } from "@/components/ui/combobox-with-input";
import { cn } from "@/lib/utils";
import { Box, Settings2, Wrench, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";

interface AssetAllocationDialogProps {
  open: boolean;
  onClose: () => void;
  isReturn: boolean;
  allocation?: any;
}

export function AssetAllocationDialog({
  open,
  onClose,
  isReturn,
  allocation,
}: AssetAllocationDialogProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [formData, setFormData] = useState({
    asset_master_id: "",
    allocated_to: "",
    allocated_to_custom: "", // Custom text for user
    purpose: "",
    project_id: "",
    project_custom: "", // Custom text for project
    expected_return_date: "",
    return_condition: "",
    reusability_percentage: "",
    quantity: "1",
    // For consumable materials return
    is_fully_consumed: false,
    consumed_quantity: "",
    remaining_quantity: "",
    // For partial return
    return_quantity: "",
    is_partial_return: false,
  });
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assetPopoverOpen, setAssetPopoverOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAssets();
      fetchUsers();
      fetchProjects();
      fetchCurrentEmployee();
    }
  }, [open]);

  const fetchCurrentEmployee = async () => {
    if (!user?.id) return;
    
    // First try to get employee record
    const { data: empData } = await supabase
      .from("employees")
      .select("id, full_name")
      .eq("user_id", user.id)
      .limit(1);
    
    if (empData?.[0]) {
      setCurrentEmployeeId(empData[0].id);
      setCurrentUserName(empData[0].full_name);
    } else {
      // Fallback to profile name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      setCurrentUserName(profileData?.full_name || user.email || "Unknown");
    }
  };

  useEffect(() => {
    if (allocation && isReturn) {
      // Fetch asset info for return
      fetchAssetInfo(allocation.asset_master_id);
      
      const allocationQty = allocation.quantity?.toString() || "1";
      setFormData({
        asset_master_id: allocation.asset_master_id,
        allocated_to: allocation.allocated_to,
        allocated_to_custom: "",
        purpose: allocation.purpose,
        project_id: allocation.project_id || "",
        project_custom: "",
        expected_return_date: allocation.expected_return_date || "",
        return_condition: "",
        reusability_percentage: "100",
        quantity: allocationQty,
        is_fully_consumed: false,
        consumed_quantity: "0",
        remaining_quantity: allocationQty,
        return_quantity: allocationQty,
        is_partial_return: false,
      });
    } else {
      resetForm();
    }
  }, [allocation, isReturn, open]);

  const fetchAssetInfo = async (assetId: string) => {
    const { data } = await supabase
      .from("asset_master_data")
      .select("*")
      .eq("id", assetId)
      .single();
    setSelectedAsset(data);
  };

  const fetchAssets = async () => {
    // Phân bổ áp dụng cho thiết bị (equipment) và công cụ dụng cụ (tools)
    // Vật tư (materials) được xuất kho qua GIN
    const { data } = await supabase
      .from("asset_master_data")
      .select("id, asset_id, asset_name, asset_type, current_status, stock_quantity, allocated_quantity, unit, is_consumable")
      .in("asset_type", ["equipment", "tools"])
      .gt("stock_quantity", 0);
    setAssets(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, position, department")
      .order("full_name");
    setUsers(data || []);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name");
    setProjects(data || []);
  };

  const resetForm = () => {
    setFormData({
      asset_master_id: "",
      allocated_to: "",
      allocated_to_custom: "",
      purpose: "",
      project_id: "",
      project_custom: "",
      expected_return_date: "",
      return_condition: "",
      reusability_percentage: "100",
      quantity: "1",
      is_fully_consumed: false,
      consumed_quantity: "0",
      remaining_quantity: "1",
      return_quantity: "1",
      is_partial_return: false,
    });
    setSelectedAsset(null);
  };

  const handleAssetChange = (assetId: string) => {
    setFormData({ ...formData, asset_master_id: assetId, quantity: "1" });
    const asset = assets.find(a => a.id === assetId);
    setSelectedAsset(asset || null);
  };

  const getAssetTypeIcon = (type: string, isConsumable: boolean) => {
    if (type === "materials" || isConsumable) {
      return <Box className="h-4 w-4 text-orange-500" />;
    }
    if (type === "equipment") {
      return <Settings2 className="h-4 w-4 text-blue-500" />;
    }
    return <Wrench className="h-4 w-4 text-green-500" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReturn) {
      // Handle return logic
      try {
        const allocatedQty = allocation.quantity || 1;
        const returnQtyInput = parseFloat(formData.return_quantity) || allocatedQty;
        const consumedQty = parseFloat(formData.consumed_quantity) || 0;
        const isFullyConsumed = formData.is_fully_consumed || consumedQty >= allocatedQty;
        const isPartialReturn = formData.is_partial_return && returnQtyInput < allocatedQty;
        
        // Validate return quantity
        if (returnQtyInput <= 0) {
          toast.error("Số lượng hoàn trả phải lớn hơn 0");
          return;
        }
        if (returnQtyInput > allocatedQty) {
          toast.error(`Số lượng hoàn trả không được vượt quá số lượng đã phân bổ (${allocatedQty})`);
          return;
        }
        
        // For consumable materials that are fully consumed
        if (selectedAsset?.is_consumable && isFullyConsumed) {
          // Update allocation as consumed, no return to stock
          const { error: updateAllocationError } = await supabase
            .from("asset_allocations")
            .update({
              status: "returned",
              actual_return_date: new Date().toISOString(),
              return_condition: formData.return_condition || "Đã tiêu hao hoàn toàn",
              is_consumed: true,
              consumed_quantity: allocatedQty,
              remaining_quantity: 0,
              reusability_percentage: 0,
            })
            .eq("id", allocation.id);

          if (updateAllocationError) throw updateAllocationError;

          // Update outbound quantity in asset master
          const { data: currentAsset } = await supabase
            .from("asset_master_data")
            .select("allocated_quantity, outbound_quantity, outbound_value, closing_quantity")
            .eq("id", allocation.asset_master_id)
            .single();

          const newAllocatedQty = Math.max(0, (currentAsset?.allocated_quantity || 0) - allocatedQty);
          const newOutboundQty = (currentAsset?.outbound_quantity || 0) + allocatedQty;
          
          const { error: updateAssetError } = await supabase
            .from("asset_master_data")
            .update({ 
              allocated_quantity: newAllocatedQty,
              outbound_quantity: newOutboundQty,
            })
            .eq("id", allocation.asset_master_id);

          if (updateAssetError) throw updateAssetError;

          toast.success(`Vật tư đã được đánh dấu tiêu hao hoàn toàn (${allocatedQty} đơn vị)`);
        } else if (isPartialReturn) {
          // PARTIAL RETURN: Return some, keep some still allocated
          const remainingAllocated = allocatedQty - returnQtyInput;
          
          // Update the original allocation with reduced quantity
          const { error: updateAllocationError } = await supabase
            .from("asset_allocations")
            .update({
              quantity: remainingAllocated,
              remaining_quantity: remainingAllocated,
            })
            .eq("id", allocation.id);

          if (updateAllocationError) throw updateAllocationError;

          // Create a new allocation record for the returned portion
          const { error: insertReturnError } = await supabase
            .from("asset_allocations")
            .insert({
              asset_master_id: allocation.asset_master_id,
              allocated_to: allocation.allocated_to,
              allocated_by: allocation.allocated_by,
              purpose: allocation.purpose,
              project_id: allocation.project_id,
              allocation_date: allocation.allocation_date,
              expected_return_date: allocation.expected_return_date,
              status: "returned",
              quantity: returnQtyInput,
              actual_return_date: new Date().toISOString(),
              return_condition: formData.return_condition,
              is_consumed: false,
              consumed_quantity: 0,
              remaining_quantity: returnQtyInput,
              reusability_percentage: formData.reusability_percentage
                ? parseFloat(formData.reusability_percentage)
                : 100,
            });

          if (insertReturnError) throw insertReturnError;

          // Get current asset data
          const { data: currentAsset } = await supabase
            .from("asset_master_data")
            .select("stock_quantity, allocated_quantity, outbound_quantity, outbound_value, inbound_quantity, closing_quantity, closing_value, cost_basis")
            .eq("id", allocation.asset_master_id)
            .single();

          // Update stock and allocated quantities
          // When returning, reduce outbound and increase closing
          const newStockQty = (currentAsset?.stock_quantity || 0) + returnQtyInput;
          const newAllocatedQty = Math.max(0, (currentAsset?.allocated_quantity || 0) - returnQtyInput);
          const newOutboundQty = Math.max(0, (currentAsset?.outbound_quantity || 0) - returnQtyInput);
          const unitCost = currentAsset?.cost_basis || 0;
          const newOutboundValue = Math.max(0, (currentAsset?.outbound_value || 0) - (returnQtyInput * unitCost));
          // Closing = inbound - outbound (outbound is reduced by return)
          const newClosingQty = (currentAsset?.inbound_quantity || 0) - newOutboundQty;
          const newClosingValue = newClosingQty * unitCost;
          
          const newStatus =
            parseFloat(formData.reusability_percentage || "100") >= 70
              ? "in_stock"
              : "under_maintenance";

          const { error: updateAssetError } = await supabase
            .from("asset_master_data")
            .update({ 
              current_status: newStockQty > 0 ? newStatus : "allocated",
              stock_quantity: newStockQty,
              allocated_quantity: newAllocatedQty,
              outbound_quantity: newOutboundQty,
              outbound_value: newOutboundValue,
              closing_quantity: newClosingQty,
              closing_value: newClosingValue,
            })
            .eq("id", allocation.asset_master_id);

          if (updateAssetError) throw updateAssetError;

          toast.success(`Hoàn trả ${returnQtyInput} đơn vị thành công. Còn lại ${remainingAllocated} đơn vị đang sử dụng.`);
        } else {
          // FULL RETURN: Return all allocated quantity
          const returnQty = selectedAsset?.is_consumable ? (allocatedQty - consumedQty) : returnQtyInput;
          
          const { error: updateAllocationError } = await supabase
            .from("asset_allocations")
            .update({
              status: "returned",
              actual_return_date: new Date().toISOString(),
              return_condition: formData.return_condition,
              is_consumed: selectedAsset?.is_consumable && consumedQty > 0,
              consumed_quantity: consumedQty,
              remaining_quantity: returnQty,
              reusability_percentage: formData.reusability_percentage
                ? parseFloat(formData.reusability_percentage)
                : 100,
            })
            .eq("id", allocation.id);

          if (updateAllocationError) throw updateAllocationError;

          // Get current asset data
          const { data: currentAsset } = await supabase
            .from("asset_master_data")
            .select("stock_quantity, allocated_quantity, outbound_quantity, outbound_value, inbound_quantity, closing_quantity, closing_value, cost_basis")
            .eq("id", allocation.asset_master_id)
            .single();

          // Update stock and allocated quantities
          // Return: increase stock by returned qty, reduce outbound by returned qty (consumed qty stays in outbound)
          const newStockQty = (currentAsset?.stock_quantity || 0) + returnQty;
          const newAllocatedQty = Math.max(0, (currentAsset?.allocated_quantity || 0) - allocatedQty);
          // Only the consumed part stays in outbound, returned part is removed
          const newOutboundQty = Math.max(0, (currentAsset?.outbound_quantity || 0) - returnQty);
          const unitCost = currentAsset?.cost_basis || 0;
          const newOutboundValue = Math.max(0, (currentAsset?.outbound_value || 0) - (returnQty * unitCost));
          // Closing = inbound - outbound
          const newClosingQty = (currentAsset?.inbound_quantity || 0) - newOutboundQty;
          const newClosingValue = newClosingQty * unitCost;
          
          const newStatus =
            parseFloat(formData.reusability_percentage || "100") >= 70
              ? "in_stock"
              : "under_maintenance";

          const { error: updateAssetError } = await supabase
            .from("asset_master_data")
            .update({ 
              current_status: newStockQty > 0 ? newStatus : "allocated",
              stock_quantity: newStockQty,
              allocated_quantity: newAllocatedQty,
              outbound_quantity: newOutboundQty,
              outbound_value: newOutboundValue,
              closing_quantity: newClosingQty,
              closing_value: newClosingValue,
            })
            .eq("id", allocation.asset_master_id);

          if (updateAssetError) throw updateAssetError;

          if (selectedAsset?.is_consumable && consumedQty > 0) {
            toast.success(`Hoàn trả ${returnQty} đơn vị, đã tiêu hao ${consumedQty} đơn vị`);
          } else {
            toast.success(`Hoàn trả ${returnQty} đơn vị thành công`);
          }
        }
        
        onClose();
      } catch (error: any) {
        toast.error("Lỗi: " + error.message);
      }
    } else {
      // Handle new allocation
      const hasValidUser = formData.allocated_to || formData.allocated_to_custom.trim();
      if (!formData.asset_master_id || !hasValidUser || !formData.purpose) {
        toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
        return;
      }

      // Validate: either need employeeId or user name
      if (!currentEmployeeId && !currentUserName) {
        toast.error("Không tìm thấy thông tin người dùng. Vui lòng liên hệ admin.");
        return;
      }

      const allocationQty = parseFloat(formData.quantity) || 1;
      
      if (!selectedAsset || allocationQty > selectedAsset.stock_quantity) {
        toast.error(`Số lượng phân bổ vượt quá tồn kho (${selectedAsset?.stock_quantity || 0})`);
        return;
      }

      // Build purpose with project info if custom project is provided
      let finalPurpose = formData.purpose;
      if (formData.project_custom) {
        finalPurpose = `${formData.purpose}\n[Dự án: ${formData.project_custom}]`;
      }

      try {
        // Build allocation record - allow users without employee record to allocate
        const allocationRecord: any = {
          asset_master_id: formData.asset_master_id,
          allocated_to: formData.allocated_to || null,
          allocated_to_name: formData.allocated_to_custom.trim() || null,
          purpose: finalPurpose,
          project_id: formData.project_id || null,
          expected_return_date: formData.expected_return_date || null,
          status: "active",
          quantity: allocationQty,
          is_consumed: false,
          consumed_quantity: 0,
          remaining_quantity: allocationQty,
        };

        // If user has employee record, use it; otherwise use name from profile
        if (currentEmployeeId) {
          allocationRecord.allocated_by = currentEmployeeId;
        } else {
          allocationRecord.allocated_by = null;
          allocationRecord.allocated_by_name = currentUserName;
        }

        const { error: insertError } = await supabase
          .from("asset_allocations")
          .insert([allocationRecord]);

        if (insertError) throw insertError;

        // Fetch current asset data to get accurate values
        const { data: currentAsset } = await supabase
          .from("asset_master_data")
          .select("stock_quantity, allocated_quantity, outbound_quantity, outbound_value, inbound_quantity, closing_quantity, closing_value, cost_basis")
          .eq("id", formData.asset_master_id)
          .single();

        if (!currentAsset) {
          toast.error("Không tìm thấy thông tin tài sản");
          return;
        }

        // Update stock, allocated, and outbound quantities
        const newStockQty = (currentAsset.stock_quantity || 0) - allocationQty;
        const newAllocatedQty = (currentAsset.allocated_quantity || 0) + allocationQty;
        const newOutboundQty = (currentAsset.outbound_quantity || 0) + allocationQty;
        const unitCost = currentAsset.cost_basis || 0;
        const newOutboundValue = (currentAsset.outbound_value || 0) + (allocationQty * unitCost);
        // Closing quantity = inbound - outbound
        const newClosingQty = (currentAsset.inbound_quantity || 0) - newOutboundQty;
        const newClosingValue = newClosingQty * unitCost;
        
        const { error: updateError } = await supabase
          .from("asset_master_data")
          .update({ 
            stock_quantity: newStockQty,
            allocated_quantity: newAllocatedQty,
            outbound_quantity: newOutboundQty,
            outbound_value: newOutboundValue,
            closing_quantity: newClosingQty,
            closing_value: newClosingValue,
            current_status: newStockQty === 0 ? "allocated" : "in_stock"
          })
          .eq("id", formData.asset_master_id);

        if (updateError) throw updateError;

        toast.success(`Phân bổ ${allocationQty} ${selectedAsset.unit || 'đơn vị'} thành công`);
        onClose();
      } catch (error: any) {
        toast.error("Lỗi: " + error.message);
      }
    }
  };

  // Calculate remaining for consumable return
  const allocatedQty = parseFloat(formData.quantity) || 0;
  const consumedQty = parseFloat(formData.consumed_quantity) || 0;
  const calculatedRemaining = Math.max(0, allocatedQty - consumedQty);
  const returnQty = parseFloat(formData.return_quantity) || allocatedQty;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {selectedAsset && getAssetTypeIcon(selectedAsset.asset_type, selectedAsset.is_consumable)}
            {isReturn ? "Hoàn Trả Tài sản" : "Phân Bổ Tài sản"}
          </DialogTitle>
          <DialogDescription>
            {isReturn
              ? selectedAsset?.is_consumable 
                ? "Vật tư tiêu hao: có thể đánh dấu đã dùng hết hoặc hoàn trả phần còn lại"
                : "Thiết bị/Công cụ: hoàn trả về kho để tái sử dụng"
              : "Phân bổ tài sản cho nhân viên sử dụng"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          {!isReturn && (
            <>
              <div className="space-y-2">
                <Label htmlFor="asset_master_id">
                  Tài sản <span className="text-red-500">*</span>
                </Label>
                <Popover open={assetPopoverOpen} onOpenChange={setAssetPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={assetPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedAsset ? (
                        <span className="flex items-center gap-2 truncate">
                          {getAssetTypeIcon(selectedAsset.asset_type, selectedAsset.is_consumable)}
                          <span>{selectedAsset.asset_id} - {selectedAsset.asset_name}</span>
                          <span className="text-muted-foreground">(Tồn: {selectedAsset.stock_quantity})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Chọn tài sản</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
                    <Command>
                      <CommandInput placeholder="Tìm tài sản theo mã hoặc tên..." />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Không tìm thấy tài sản</CommandEmpty>
                        <CommandGroup>
                          {assets.map((asset) => (
                            <CommandItem
                              key={asset.id}
                              value={`${asset.asset_id} ${asset.asset_name}`}
                              onSelect={() => {
                                handleAssetChange(asset.id);
                                setAssetPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.asset_master_id === asset.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                {getAssetTypeIcon(asset.asset_type, asset.is_consumable)}
                                <div className="flex flex-col">
                                  <span>{asset.asset_id} - {asset.asset_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Tồn: {asset.stock_quantity} {asset.unit || 'Cái'}
                                    {asset.is_consumable && ' • Tiêu hao'}
                                  </span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedAsset && (
                <Card className={selectedAsset.is_consumable ? "border-orange-200 bg-orange-50/50" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {getAssetTypeIcon(selectedAsset.asset_type, selectedAsset.is_consumable)}
                      <span className="font-medium">
                        {selectedAsset.asset_type === "equipment" ? "Thiết bị" : 
                         selectedAsset.asset_type === "tools" ? "Công cụ" : "Vật tư"}
                      </span>
                      {selectedAsset.is_consumable && (
                        <Badge variant="outline" className="border-orange-300 text-orange-600">
                          Tiêu hao
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tồn kho hiện tại:</span>
                      <span className="font-semibold text-green-600">{selectedAsset.stock_quantity} {selectedAsset.unit || 'đơn vị'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Đã phân bổ:</span>
                      <span className="font-semibold text-orange-600">{selectedAsset.allocated_quantity || 0} {selectedAsset.unit || 'đơn vị'}</span>
                    </div>
                    {selectedAsset.is_consumable && (
                      <p className="text-xs text-orange-600 mt-2">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        Vật tư tiêu hao: sau khi sử dụng có thể dùng hết hoặc hoàn trả phần còn lại
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Số lượng phân bổ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedAsset?.stock_quantity || 1}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  placeholder="Nhập số lượng"
                />
                {selectedAsset && (
                  <p className="text-xs text-muted-foreground">
                    Tối đa: {selectedAsset.stock_quantity} {selectedAsset.unit || 'đơn vị'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocated_to">
                  Người sử dụng <span className="text-red-500">*</span>
                </Label>
                <ComboboxWithInput
                  options={users.map((emp) => ({
                    value: emp.id,
                    label: emp.full_name,
                    sublabel: [emp.position, emp.department].filter(Boolean).join(" - "),
                  }))}
                  value={formData.allocated_to}
                  customValue={formData.allocated_to_custom}
                  onValueChange={(value, isCustom) => {
                    if (isCustom) {
                      setFormData({ ...formData, allocated_to: "", allocated_to_custom: value });
                    } else {
                      setFormData({ ...formData, allocated_to: value, allocated_to_custom: "" });
                    }
                  }}
                  placeholder="Chọn hoặc nhập người sử dụng"
                  searchPlaceholder="Tìm nhân viên..."
                  emptyMessage="Không tìm thấy nhân viên"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">
                  Mục đích sử dụng <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_id">Dự án (nếu có)</Label>
                <ComboboxWithInput
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  value={formData.project_id}
                  customValue={formData.project_custom}
                  onValueChange={(value, isCustom) => {
                    if (isCustom) {
                      setFormData({ ...formData, project_id: "", project_custom: value });
                    } else {
                      setFormData({ ...formData, project_id: value, project_custom: "" });
                    }
                  }}
                  placeholder="Chọn hoặc nhập dự án"
                  searchPlaceholder="Tìm dự án..."
                  emptyMessage="Không tìm thấy dự án"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_return_date">Hạn hoàn trả dự kiến</Label>
                <Input
                  id="expected_return_date"
                  type="date"
                  value={formData.expected_return_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_return_date: e.target.value,
                    })
                  }
                />
              </div>
            </>
          )}

          {isReturn && (
            <>
              {/* Return Quantity Options - For all asset types */}
              {!selectedAsset?.is_consumable && allocatedQty > 1 && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box className="h-5 w-5 text-blue-500" />
                        <div>
                          <Label className="font-medium">Hoàn trả một phần?</Label>
                          <p className="text-xs text-muted-foreground">
                            Chỉ hoàn trả một phần số lượng, phần còn lại tiếp tục sử dụng
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.is_partial_return}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          is_partial_return: checked,
                          return_quantity: checked ? "1" : formData.quantity
                        })}
                      />
                    </div>

                    <div className="p-2 bg-white rounded border">
                      <div className="flex justify-between text-sm">
                        <span>Tổng số lượng đã phân bổ:</span>
                        <span className="font-semibold">{allocatedQty} {selectedAsset?.unit || 'đơn vị'}</span>
                      </div>
                    </div>

                    {formData.is_partial_return && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="return_quantity">Số lượng hoàn trả</Label>
                          <Input
                            id="return_quantity"
                            type="number"
                            min="1"
                            max={allocatedQty}
                            value={formData.return_quantity}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              return_quantity: e.target.value
                            })}
                            placeholder="Nhập số lượng hoàn trả"
                          />
                        </div>
                        <div className="p-2 bg-white rounded border">
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Số lượng hoàn trả:</span>
                            <span className="font-semibold">{returnQty}</span>
                          </div>
                          <div className="flex justify-between text-sm text-orange-600 font-medium border-t pt-1 mt-1">
                            <span>Còn lại (tiếp tục sử dụng):</span>
                            <span>{Math.max(0, allocatedQty - returnQty)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Consumable Material Return Options */}
              {selectedAsset?.is_consumable && (
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <div>
                          <Label className="font-medium">Đã sử dụng hết?</Label>
                          <p className="text-xs text-muted-foreground">
                            Vật tư đã được tiêu hao hoàn toàn, không còn để hoàn trả
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.is_fully_consumed}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          is_fully_consumed: checked,
                          consumed_quantity: checked ? formData.quantity : "0"
                        })}
                      />
                    </div>

                    {!formData.is_fully_consumed && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="consumed_quantity">Số lượng đã tiêu hao</Label>
                          <Input
                            id="consumed_quantity"
                            type="number"
                            min="0"
                            max={allocatedQty}
                            value={formData.consumed_quantity}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              consumed_quantity: e.target.value,
                              remaining_quantity: (allocatedQty - parseFloat(e.target.value || "0")).toString()
                            })}
                            placeholder="0"
                          />
                        </div>
                        <div className="p-2 bg-white rounded border">
                          <div className="flex justify-between text-sm">
                            <span>Số lượng phân bổ:</span>
                            <span className="font-semibold">{allocatedQty}</span>
                          </div>
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Đã tiêu hao:</span>
                            <span className="font-semibold">-{consumedQty}</span>
                          </div>
                          <div className="flex justify-between text-sm text-green-600 font-medium border-t pt-1 mt-1">
                            <span>Còn lại (hoàn trả):</span>
                            <span>{calculatedRemaining}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="return_condition">Tình trạng khi hoàn trả</Label>
                <Textarea
                  id="return_condition"
                  value={formData.return_condition}
                  onChange={(e) =>
                    setFormData({ ...formData, return_condition: e.target.value })
                  }
                  placeholder={selectedAsset?.is_consumable && formData.is_fully_consumed 
                    ? "VD: Đã sử dụng hết cho công trình ABC..." 
                    : "VD: Tốt, còn sử dụng được..."}
                  rows={3}
                />
              </div>

              {/* Reusability - only for equipment/tools or non-consumed materials */}
              {(!selectedAsset?.is_consumable || (!formData.is_fully_consumed && calculatedRemaining > 0)) && (
                <div className="space-y-2">
                  <Label htmlFor="reusability_percentage">
                    Phần trăm Tái Sử dụng (%)
                  </Label>
                  <Input
                    id="reusability_percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.reusability_percentage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reusability_percentage: e.target.value,
                      })
                    }
                    placeholder="100"
                  />
                  <p className="text-sm text-muted-foreground">
                    Từ 70% trở lên: Sẵn sàng tái phân bổ. Dưới 70%: Cần bảo trì.
                  </p>
                </div>
              )}
            </>
          )}

        </form>
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="allocation-form" onClick={handleSubmit}>
            {isReturn 
              ? (selectedAsset?.is_consumable && formData.is_fully_consumed 
                  ? "Xác nhận Tiêu hao" 
                  : "Xác nhận Hoàn trả")
              : "Phân Bổ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
