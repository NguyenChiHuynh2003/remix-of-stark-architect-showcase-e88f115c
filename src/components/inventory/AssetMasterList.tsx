import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDateVN } from "@/lib/dateUtils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  Wrench,
  Box,
  AlertTriangle,
  Download,
  Filter,
  Settings2,
  Search,
  Boxes,
  Archive,
  Calendar,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssetMasterDialog } from "./AssetMasterDialog";
import { AssetDeleteDialog } from "./AssetDeleteDialog";
import { ExportButtons } from "@/components/ExportButtons";
import { exportWarehouseToExcel, exportWarehouseToPDF } from "@/lib/exportUtils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { formatCurrency as formatCurrencyUtil } from "@/lib/formatCurrency";

const ITEMS_PER_PAGE = 15;

interface AssetMaster {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_type: string;
  brand: string | null;
  unit: string | null;
  sku: string;
  cost_center: string;
  cost_basis: number;
  accumulated_depreciation: number | null;
  nbv: number | null;
  current_status: string;
  depreciation_method: string | null;
  useful_life_months: number | null;
  activation_date: string | null;
  notes: string | null;
  created_at: string;
  stock_quantity: number;
  allocated_quantity: number;
  warehouse_name: string | null;
  opening_quantity: number;
  opening_value: number;
  inbound_quantity: number;
  inbound_value: number;
  outbound_quantity: number;
  outbound_value: number;
  closing_quantity: number;
  closing_value: number;
  is_consumable: boolean;
}

interface AssetMasterListProps {
  searchItemId?: string | null;
  onClearSearchItem?: () => void;
}

export function AssetMasterList({ searchItemId, onClearSearchItem }: AssetMasterListProps) {
  const { user } = useAuth();
  const { canEdit } = useUserRole();
  const canViewValues = canEdit("inventory");
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeCardFilters, setActiveCardFilters] = useState<Set<string>>(new Set());
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetMaster | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<AssetMaster | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeAllocationsCount, setActiveAllocationsCount] = useState(0);
  const [allocatedAssetIds, setAllocatedAssetIds] = useState<Set<string>>(new Set());
  const [userFullName, setUserFullName] = useState<string>("");
  const skipPageResetRef = useRef(false);

  // Auto-scroll to searched item
  useEffect(() => {
    if (!searchItemId || assets.length === 0) return;

    // Reset filters so item is visible
    skipPageResetRef.current = true;
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setWarehouseFilter("all");
    setActiveCardFilters(new Set());
    setDateFrom("");
    setDateTo("");

    // Find in unfiltered list
    const itemIndex = assets.findIndex((a) => a.id === searchItemId);
    if (itemIndex === -1) return;

    const targetPage = Math.floor(itemIndex / ITEMS_PER_PAGE) + 1;
    setCurrentPage(targetPage);

    setTimeout(() => {
      skipPageResetRef.current = false;
      const row = document.querySelector(`[data-asset-id="${searchItemId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        (row as HTMLElement).style.backgroundColor = "hsl(0 80% 92%)";
        setTimeout(() => {
          (row as HTMLElement).style.backgroundColor = "";
        }, 3000);
      }
      onClearSearchItem?.();
    }, 300);
  }, [searchItemId, assets]);

  // Fetch current user's profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (data) {
        setUserFullName(data.full_name);
      }
    };
    fetchUserProfile();
  }, [user]);

  const fetchAssets = async () => {
    try {
      setLoading(true);

      const [assetsResult, allocationsResult] = await Promise.all([
        supabase.from("asset_master_data").select("*").order("asset_id", { ascending: true }),
        supabase.from("asset_allocations").select("asset_master_id").eq("status", "active"),
      ]);

      if (assetsResult.error) throw assetsResult.error;
      setAssets(assetsResult.data || []);

      const uniqueAllocatedAssets = new Set((allocationsResult.data || []).map((a) => a.asset_master_id));
      setActiveAllocationsCount(uniqueAllocatedAssets.size);
      setAllocatedAssetIds(uniqueAllocatedAssets);
    } catch (error: any) {
      toast.error("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // Toggle multi-select card filter
  const toggleCardFilter = (filter: string) => {
    setActiveCardFilters((prev) => {
      const newFilters = new Set(prev);
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        // If selecting "total", clear other filters
        if (filter === "total") {
          return new Set(["total"]);
        }
        // If selecting other filter, remove "total"
        newFilters.delete("total");
        newFilters.add(filter);
      }
      return newFilters;
    });
  };

  const clearCardFilters = () => {
    setActiveCardFilters(new Set());
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.brand && asset.brand.toLowerCase().includes(searchQuery.toLowerCase()));

    // Multi-select card filter logic
    let matchesCardFilter = true;
    if (activeCardFilters.size > 0 && !activeCardFilters.has("total")) {
      // Separate status filters and type filters
      const statusFilters = ["in_stock", "allocated", "under_maintenance"];
      const typeFilters = ["equipment", "tools", "materials"];

      const activeStatusFilters = [...activeCardFilters].filter((f) => statusFilters.includes(f));
      const activeTypeFilters = [...activeCardFilters].filter((f) => typeFilters.includes(f));

      // Asset must match at least one status filter (if any) AND at least one type filter (if any)
      let matchesStatusCard = activeStatusFilters.length === 0;
      let matchesTypeCard = activeTypeFilters.length === 0;

      // Check status filters
      if (activeStatusFilters.length > 0) {
        matchesStatusCard = activeStatusFilters.some((filter) => {
          switch (filter) {
            case "in_stock":
              return asset.current_status === "in_stock";
            case "allocated":
              return allocatedAssetIds.has(asset.id);
            case "under_maintenance":
              return asset.current_status === "under_maintenance";
            default:
              return false;
          }
        });
      }

      // Check type filters
      if (activeTypeFilters.length > 0) {
        matchesTypeCard = activeTypeFilters.some((filter) => asset.asset_type === filter);
      }

      matchesCardFilter = matchesStatusCard && matchesTypeCard;
    }

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "allocated"
          ? allocatedAssetIds.has(asset.id)
          : asset.current_status === statusFilter;
    const matchesType = typeFilter === "all" || asset.asset_type === typeFilter;
    // Handle "KHO CHÍNH" filter - matches assets with "default", null, or empty warehouse_name
    const assetWarehouse =
      !asset.warehouse_name || asset.warehouse_name.trim() === "" || asset.warehouse_name.toLowerCase() === "default"
        ? "KHO CHÍNH"
        : asset.warehouse_name;
    const matchesWarehouse = warehouseFilter === "all" || assetWarehouse === warehouseFilter;

    return matchesSearch && matchesCardFilter && matchesStatus && matchesType && matchesWarehouse;
  });

  // Reset page when filters change (skip if triggered by search navigation)
  useEffect(() => {
    if (skipPageResetRef.current) return;
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, warehouseFilter, activeCardFilters]);

  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAssets = filteredAssets.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Get unique warehouses for filter
  const uniqueWarehouses = [
    ...new Set(
      assets.map((a) =>
        !a.warehouse_name || a.warehouse_name.trim() === "" || a.warehouse_name.toLowerCase() === "default"
          ? "KHO CHÍNH"
          : a.warehouse_name,
      ),
    ),
  ];

  // Count statistics
  const countByStatus = {
    total: assets.length,
    in_stock: assets.filter((a) => a.current_status === "in_stock").length,
    active: assets.filter((a) => a.current_status === "active").length,
    allocated: activeAllocationsCount,
    under_maintenance: assets.filter((a) => a.current_status === "under_maintenance").length,
    disposed: assets.filter((a) => a.current_status === "disposed").length,
  };

  // Count by type
  const countByType = {
    equipment: assets.filter((a) => a.asset_type === "equipment").length,
    tools: assets.filter((a) => a.asset_type === "tools").length,
    materials: assets.filter((a) => a.asset_type === "materials").length,
  };

  const handleEdit = (asset: AssetMaster) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAsset(null);
    fetchAssets();
  };

  const handleOpenDeleteDialog = (asset: AssetMaster, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingAsset(asset);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setDeletingAsset(null);
  };

  const handleDeleteSuccess = () => {
    handleDeleteDialogClose();
    fetchAssets();
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      in_stock: "Chưa sử dụng",
      active: "Đang sử dụng",
      allocated: "Đã cấp phát",
      under_maintenance: "Đang bảo trì",
      ready_for_reallocation: "Sẵn sàng cấp lại",
      disposed: "Đã hủy",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      in_stock: "bg-gray-100 text-gray-700 border-gray-300",
      active: "bg-green-50 text-green-700 border-green-300",
      allocated: "bg-blue-50 text-blue-700 border-blue-300",
      under_maintenance: "bg-orange-50 text-orange-700 border-orange-300",
      ready_for_reallocation: "bg-purple-50 text-purple-700 border-purple-300",
      disposed: "bg-red-50 text-red-700 border-red-300",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-300";
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      equipment: "Thiết bị",
      tools: "Công cụ",
      materials: "Vật tư",
    };
    return labels[type] || type;
  };

  const formatCurrency = (value: number | null) => {
    if (!canViewValues) return "-";
    return formatCurrencyUtil(value, { showSymbol: false });
  };

  const formatDate = (dateStr: string | null) => {
    return formatDateVN(dateStr);
  };

  const handleExportAssets = async (format: "excel" | "pdf") => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const fromDate = formatDateVN(startOfYear);
    const toDate = formatDateVN(today);

    const exportData = filteredAssets.map((asset) => ({
      warehouse_name: asset.warehouse_name || "KHO CHÍNH",
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      unit: asset.unit || "",
      opening_quantity: asset.opening_quantity || 0,
      opening_value: asset.opening_value || 0,
      inbound_quantity: asset.inbound_quantity || 0,
      inbound_value: asset.inbound_value || 0,
      outbound_quantity: asset.outbound_quantity || 0,
      outbound_value: asset.outbound_value || 0,
      closing_quantity: asset.closing_quantity || asset.stock_quantity || 0,
      closing_value: asset.closing_value || 0,
    }));

    const options = {
      title: "DANH SÁCH TÀI SẢN",
      filename: "danh_sach_tai_san",
      fromDate,
      toDate,
      data: exportData,
    };

    if (format === "excel") {
      exportWarehouseToExcel(options);
    } else {
      await exportWarehouseToPDF(options);
    }
  };

  // Calculate total value
  const totalValue = filteredAssets.reduce((sum, a) => {
    const currentVal = a.closing_value !== null && a.closing_value !== undefined ? a.closing_value : a.cost_basis || 0;
    return sum + currentVal;
  }, 0);
  return (
    <div className="space-y-4 w-full px-2 sm:px-4">
      {/* Statistics Cards - Clickable Filters */}
      <TooltipProvider>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("total") ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("total")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-blue-500 rounded-lg shrink-0">
                      <Boxes className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {countByStatus.total}
                      </p>
                      <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 truncate">Tổng mặt hàng</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để xem tất cả (xóa bộ lọc khác)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("in_stock") ? "ring-2 ring-green-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("in_stock")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-green-500 rounded-lg shrink-0">
                      <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-300">
                        {countByStatus.in_stock}
                      </p>
                      <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 truncate">Trong kho</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để lọc/bỏ lọc: Tài sản trong kho</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("allocated") ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("allocated")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-amber-500 rounded-lg shrink-0">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-amber-700 dark:text-amber-300">
                        {countByStatus.allocated}
                      </p>
                      <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 truncate">Đã phân bổ</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để lọc/bỏ lọc: Tài sản đã phân bổ</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("under_maintenance") ? "ring-2 ring-red-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("under_maintenance")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-red-500 rounded-lg shrink-0">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-red-700 dark:text-red-300">
                        {countByStatus.under_maintenance}
                      </p>
                      <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 truncate">Đang bảo trì</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để lọc/bỏ lọc: Tài sản đang bảo trì</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("equipment") ? "ring-2 ring-gray-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("equipment")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-gray-400 rounded-lg shrink-0">
                      <Settings2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold">{countByType.equipment}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Thiết bị</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để lọc/bỏ lọc: Loại Thiết bị</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("tools") ? "ring-2 ring-orange-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("tools")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-orange-400 rounded-lg shrink-0">
                      <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold">{countByType.tools}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Công cụ</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để lọc/bỏ lọc: Loại Công cụ</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${activeCardFilters.has("materials") ? "ring-2 ring-purple-500 ring-offset-2" : ""}`}
                onClick={() => toggleCardFilter("materials")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-purple-400 rounded-lg shrink-0">
                      <Box className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold">{countByType.materials}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Vật tư</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chọn để lọc/bỏ lọc: Loại Vật tư</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Active Filter Indicator - Multi-select */}
      {activeCardFilters.size > 0 && !activeCardFilters.has("total") && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
          <Filter className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-primary font-medium">Đang lọc:</span>
          <div className="flex flex-wrap gap-1">
            {[...activeCardFilters].map((filter) => {
              const filterLabels: Record<string, string> = {
                in_stock: "Trong kho",
                allocated: "Đã phân bổ",
                under_maintenance: "Đang bảo trì",
                equipment: "Thiết bị",
                tools: "Công cụ",
                materials: "Vật tư",
              };
              return (
                <Badge
                  key={filter}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => toggleCardFilter(filter)}
                >
                  {filterLabels[filter]}
                  <span className="ml-1">×</span>
                </Badge>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={clearCardFilters}>
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col gap-3 bg-muted/30 p-2 sm:p-3 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm mã hàng, tên hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchAssets} variant="outline" size="sm" disabled={loading} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-2">Làm mới</span>
            </Button>
            <ExportButtons
              onExportExcel={() => handleExportAssets("excel")}
              onExportPDF={() => handleExportAssets("pdf")}
              disabled={loading || filteredAssets.length === 0}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-full sm:w-[140px] bg-background">
              <SelectValue placeholder="Tổng tài sản" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tổng tài sản</SelectItem>
              {uniqueWarehouses.map((warehouse) => (
                <SelectItem key={warehouse} value={warehouse}>
                  {warehouse}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[120px] bg-background">
              <SelectValue placeholder="Tất cả loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              <SelectItem value="equipment">Thiết bị</SelectItem>
              <SelectItem value="tools">Công cụ</SelectItem>
              <SelectItem value="materials">Vật tư</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] bg-background">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="in_stock">Trong kho</SelectItem>
              <SelectItem value="active">Đang sử dụng</SelectItem>
              <SelectItem value="allocated">Đã phân bổ</SelectItem>
              <SelectItem value="under_maintenance">Đang bảo trì</SelectItem>
              <SelectItem value="disposed">Đã hủy</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground w-full sm:w-auto">
            <span className="shrink-0">Từ</span>
            <div className="relative flex-1 sm:w-[140px]">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 bg-background pr-2 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <span className="shrink-0">Đến</span>
            <div className="relative flex-1 sm:w-[140px]">
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 bg-background pr-2 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Header with title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tất cả tài sản</h2>
      </div>

      {/* Warehouse Tabs */}
      <Tabs value={warehouseFilter} onValueChange={setWarehouseFilter} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 whitespace-nowrap">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-4 py-2"
            >
              Tổng tài sản ({assets.length})
            </TabsTrigger>
            {uniqueWarehouses.map((warehouse) => (
              <TabsTrigger
                key={warehouse}
                value={warehouse}
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-4 py-2"
              >
                {warehouse.toUpperCase()} (
                {assets.filter((a) => (a.warehouse_name || "KHO CHÍNH") === warehouse).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-380px)]">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-secondary">
                {/* Dòng 1: Tiêu đề chính */}
                <TableRow>
                  <TableHead rowSpan={2} className="sticky left-0 z-30 bg-secondary border-r text-center">
                    Mã hàng
                  </TableHead>
                  <TableHead rowSpan={2} className="border-r">
                    Tên tài sản
                  </TableHead>
                  <TableHead rowSpan={2} className="border-r text-center">
                    ĐVT
                  </TableHead>
                  <TableHead rowSpan={2} className="border-r text-center">
                    Loại
                  </TableHead>

                  <TableHead colSpan={2} className="border-r text-center bg-blue-100/50 dark:bg-blue-900/20">
                    Tồn đầu
                  </TableHead>
                  <TableHead colSpan={2} className="border-r text-center bg-green-100/50 dark:bg-green-900/20">
                    IN
                  </TableHead>
                  <TableHead colSpan={2} className="border-r text-center bg-orange-100/50 dark:bg-orange-900/20">
                    OUT
                  </TableHead>
                  <TableHead colSpan={2} className="border-r text-center bg-purple-100/50 dark:bg-purple-900/20">
                    Hiện tại
                  </TableHead>
                  <TableHead rowSpan={2} className="text-center w-[60px]">
                    Xóa
                  </TableHead>
                </TableRow>

                {/* Dòng 2: SL và Trị giá */}
                <TableRow className="sticky top-[40px] z-20 bg-secondary">
                  {/* top-[40px] tùy thuộc vào độ cao dòng 1 */}
                  <TableHead className="border-r text-center bg-blue-50/50">SL</TableHead>
                  <TableHead className="border-r text-center bg-blue-50/50">Giá trị</TableHead>
                  <TableHead className="border-r text-center bg-green-50/50">SL</TableHead>
                  <TableHead className="border-r text-center bg-green-50/50">Giá trị</TableHead>
                  <TableHead className="border-r text-center bg-orange-50/50">SL</TableHead>
                  <TableHead className="border-r text-center bg-orange-50/50">Giá trị</TableHead>
                  <TableHead className="border-r text-center bg-purple-50/50">SL</TableHead>
                  <TableHead className="border-r text-center bg-purple-50/50">Giá trị</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      Đang tải dữ liệu...
                    </TableCell>
                  </TableRow>
                ) : paginatedAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      Không có tài sản nào
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAssets.map((asset, index) => (
                    <TableRow
                      key={asset.id}
                      data-asset-id={asset.id}
                      className="group hover:bg-muted/30 cursor-pointer"
                      onClick={() => handleEdit(asset)}
                    >
                      <TableCell className="sticky left-0 z-10 border-r font-medium text-primary text-center bg-card group-hover:bg-muted/30">
                        {asset.asset_id}
                      </TableCell>
                      <TableCell className="border-r">
                        <div>
                          <div className="font-medium">{asset.asset_name}</div>
                          {asset.brand && <div className="text-xs text-muted-foreground">{asset.brand}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="border-r text-center text-muted-foreground">{asset.unit || "-"}</TableCell>
                      <TableCell className="border-r text-center">
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(asset.asset_type)}
                        </Badge>
                      </TableCell>
                      {/* Tồn đầu */}
                      <TableCell className="border-r text-center bg-blue-50/30 dark:bg-blue-950/30">
                        {asset.opening_quantity || 0}
                      </TableCell>
                      <TableCell className="border-r text-right bg-blue-50/30 dark:bg-blue-950/30">
                        {formatCurrency(asset.opening_value)}
                      </TableCell>
                      {/* Nhập vào */}
                      <TableCell className="border-r text-center bg-green-50/30 dark:bg-green-950/30">
                        {asset.inbound_quantity || 0}
                      </TableCell>
                      <TableCell className="border-r text-right bg-green-50/30 dark:bg-green-950/30">
                        {formatCurrency(asset.inbound_value)}
                      </TableCell>
                      {/* Xuất ra */}
                      <TableCell className="border-r text-center bg-orange-50/30 dark:bg-orange-950/30">
                        {asset.outbound_quantity || 0}
                      </TableCell>
                      <TableCell className="border-r text-right bg-orange-50/30 dark:bg-orange-950/30">
                        {formatCurrency(asset.outbound_value)}
                      </TableCell>
                      {/* Hiện tại */}
                      <TableCell className="text-center font-semibold bg-purple-50/30 dark:bg-purple-950/30 border-r">
                        {asset.closing_quantity || asset.stock_quantity || 0}
                      </TableCell>
                      <TableCell className="text-right font-semibold bg-purple-50/30 dark:bg-purple-950/30 border-r">
                        {formatCurrency(asset.closing_value || asset.cost_basis)}
                      </TableCell>
                      {/* Nút xóa */}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleOpenDeleteDialog(asset, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer with stats and pagination */}
          <div className="border-t bg-muted/30 px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                <span>
                  Tổng TS: <strong>{filteredAssets.length}</strong>
                </span>
                <span>
                  Giá trị: <strong className="text-primary">{formatCurrency(totalValue)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredAssets.length)} /{" "}
                  {filteredAssets.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tabs>

      <AssetMasterDialog open={dialogOpen} onClose={handleCloseDialog} editingAsset={editingAsset} />

      <AssetDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        asset={deletingAsset}
        userFullName={userFullName}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
