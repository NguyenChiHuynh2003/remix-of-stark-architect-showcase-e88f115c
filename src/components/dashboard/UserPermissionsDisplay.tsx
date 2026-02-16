import { useState } from "react";
import { useUserRole, availableModules, roleLabels } from "@/hooks/useUserRole";
import { ChevronDown, ChevronUp, Eye, Edit, Shield, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserPermissionsDisplayProps {
  isCollapsed?: boolean;
}

export const UserPermissionsDisplay = ({ isCollapsed = false }: UserPermissionsDisplayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { role, hasAccess, canEdit, loading, isAdmin } = useUserRole();

  if (loading || isCollapsed) {
    return null;
  }

  // Get modules that the user has access to
  const accessibleModules = availableModules.filter(m => hasAccess(m.id));

  return (
    <div className="border-t border-sidebar-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-sidebar-accent/50 transition-colors">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sidebar-foreground/70" />
            <span className="text-xs font-medium text-sidebar-foreground/70">Quyền của tôi</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-sidebar-foreground/50" />
          ) : (
            <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
          )}
        </CollapsibleTrigger>
        
        <CollapsibleContent className="px-4 pb-3">
          <div className="space-y-2">
            {/* Role badge */}
            <div className="flex items-center gap-2 mb-3">
              <Badge 
                variant={isAdmin ? "default" : "secondary"} 
                className={cn(
                  "text-xs",
                  isAdmin && "bg-primary text-primary-foreground"
                )}
              >
                {roleLabels[role]}
              </Badge>
              {isAdmin && (
                <span className="text-[10px] text-sidebar-foreground/50">Toàn quyền</span>
              )}
            </div>

            {/* Module permissions list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {accessibleModules.map((module) => {
                const hasEditPerm = canEdit(module.id);
                
                return (
                  <TooltipProvider key={module.id} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors cursor-default">
                          <span className="text-xs text-sidebar-foreground/80 truncate max-w-[120px]">
                            {module.label}
                          </span>
                          <div className="flex items-center gap-1">
                            {hasEditPerm ? (
                              <Edit className="w-3 h-3 text-green-500" />
                            ) : (
                              <Eye className="w-3 h-3 text-blue-400" />
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {hasEditPerm ? (
                          <span className="flex items-center gap-1">
                            <Edit className="w-3 h-3" /> Xem & Sửa/Thêm/Xóa
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Chỉ xem
                          </span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 pt-2 border-t border-sidebar-border/50 mt-2">
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-sidebar-foreground/50">Xem</span>
              </div>
              <div className="flex items-center gap-1">
                <Edit className="w-3 h-3 text-green-500" />
                <span className="text-[10px] text-sidebar-foreground/50">Sửa</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
