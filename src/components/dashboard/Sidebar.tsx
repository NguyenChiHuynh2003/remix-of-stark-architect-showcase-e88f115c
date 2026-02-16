import { useState } from "react";
import { LayoutDashboard, FolderKanban, CheckSquare, FileText, Settings, LogOut, UserCog, Users, DollarSign, Package, Archive, Menu, X, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, roleLabels } from "@/hooks/useUserRole";
import logo2018 from "@/assets/logoKBA_1.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UserPermissionsDisplay } from "./UserPermissionsDisplay";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const allMenuItems = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "hr", label: "Nhân sự", icon: Users },
  { id: "inventory", label: "Quản lí kho", icon: Package },
  { id: "settings", label: "Cài đặt", icon: Settings },
  { id: "admin-users", label: "Quản lý người dùng", icon: UserCog },
];

const SidebarContent = ({ 
  activeSection, 
  setActiveSection, 
  menuItems, 
  role, 
  loading, 
  handleLogout,
  onItemClick,
  isCollapsed = false
}: {
  activeSection: string;
  setActiveSection: (section: string) => void;
  menuItems: typeof allMenuItems;
  role: string;
  loading: boolean;
  handleLogout: () => void;
  onItemClick?: () => void;
  isCollapsed?: boolean;
}) => {
  const navigate = useNavigate();
  const showFull = !isCollapsed;

  return (
    <>
      <div className={cn(
        "border-b border-sidebar-border transition-all duration-300 ease-out",
        showFull ? "p-4 sm:p-6" : "p-3"
      )}>
        <div className="flex items-center gap-3">
          <img 
            src={logo2018} 
            alt="KBA 2018 Logo" 
            className={cn(
              "object-contain flex-shrink-0 transition-all duration-300 ease-out",
              showFull ? "w-10 h-10 sm:w-12 sm:h-12" : "w-8 h-8"
            )} 
          />
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            showFull ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
          )}>
            <h2 className="text-base sm:text-lg font-bold whitespace-nowrap">KBA.2018</h2>
            <p className="text-xs text-sidebar-foreground/70 whitespace-nowrap">Hệ thống quản lý</p>
          </div>
        </div>
      </div>

      <div className={cn(
        "border-b border-sidebar-border overflow-hidden transition-all duration-300 ease-out",
        !loading && showFull ? "px-4 sm:px-6 py-2 max-h-10 opacity-100" : "max-h-0 opacity-0 py-0"
      )}>
        <p className="text-xs text-sidebar-foreground/50 whitespace-nowrap">
          Vai trò: <span className="font-medium text-sidebar-foreground/70">{roleLabels[role as keyof typeof roleLabels]}</span>
        </p>
      </div>

      <nav className={cn(
        "flex-1 overflow-y-auto transition-all duration-300 ease-out",
        showFull ? "p-3 sm:p-4" : "p-2"
      )}>
        <ul className="space-y-1">
          {menuItems.map((item, index) => (
            <li 
              key={item.id}
              className="transform transition-all duration-200 ease-out"
              style={{ transitionDelay: `${index * 20}ms` }}
            >
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (item.id === "reports") {
                          navigate("/reports");
                        } else if (item.id === "settings") {
                          navigate("/settings");
                        } else if (item.id === "closed-projects") {
                          navigate("/closed-projects");
                        } else {
                          setActiveSection(item.id);
                        }
                        onItemClick?.();
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg transition-all duration-200 ease-out",
                        showFull ? "px-3 sm:px-4 py-2.5 sm:py-3" : "px-2 py-2.5 justify-center",
                        activeSection === item.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground hover:translate-x-1"
                      )}
                    >
                      <item.icon className={cn(
                        "flex-shrink-0 transition-all duration-200",
                        showFull ? "w-5 h-5" : "w-5 h-5"
                      )} />
                      <span className={cn(
                        "font-medium text-sm sm:text-base whitespace-nowrap transition-all duration-300 ease-out",
                        showFull ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0 overflow-hidden"
                      )}>
                        {item.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  {!showFull && (
                    <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-lg z-50">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Permissions Display */}
      <UserPermissionsDisplay isCollapsed={isCollapsed} />

      <div className={cn(
        "border-t border-sidebar-border transition-all duration-300 ease-out",
        showFull ? "p-3 sm:p-4" : "p-2"
      )}>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg hover:bg-destructive/10 text-sidebar-foreground hover:text-destructive transition-all duration-200 ease-out",
                  showFull ? "px-3 sm:px-4 py-2.5 sm:py-3" : "px-2 py-2.5 justify-center"
                )}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className={cn(
                  "font-medium text-sm sm:text-base whitespace-nowrap transition-all duration-300 ease-out",
                  showFull ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0 overflow-hidden"
                )}>
                  Đăng xuất
                </span>
              </button>
            </TooltipTrigger>
            {!showFull && (
              <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-lg z-50">
                Đăng xuất
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );
};

export const Sidebar = ({ activeSection, setActiveSection, onCollapsedChange }: SidebarProps) => {
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { role, hasAccess, loading } = useUserRole();

  const menuItems = allMenuItems.filter(item => hasAccess(item.id));

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapsedChange?.(newState);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Đăng xuất thành công");
    navigate("/auth");
  };

  return (
    <>
      {/* Mobile Menu Button - Fixed at top */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="p-0 w-72 bg-card text-card-foreground border-r border-border shadow-xl"
          >
            <div className="flex flex-col h-full bg-card">
              {/* Mobile header with close button */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <img src={logo2018} alt="KBA 2018 Logo" className="w-10 h-10 object-contain" />
                  <div>
                    <h2 className="text-lg font-bold text-foreground">KBA.2018</h2>
                    <p className="text-xs text-muted-foreground">Quản lý nội bộ KBA </p>
                  </div>
                </div>
              </div>
              
              {/* Role indicator */}
              {!loading && (
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Vai trò: <span className="font-medium text-foreground">{roleLabels[role as keyof typeof roleLabels]}</span>
                  </p>
                </div>
              )}
              
              {/* Menu items */}
              <nav className="flex-1 p-3 overflow-y-auto">
                <ul className="space-y-1">
                  {menuItems.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          if (item.id === "reports") {
                            navigate("/reports");
                          } else if (item.id === "settings") {
                            navigate("/settings");
                          } else if (item.id === "closed-projects") {
                            navigate("/closed-projects");
                          } else {
                            setActiveSection(item.id);
                          }
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                          activeSection === item.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent text-foreground"
                        )}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              
              {/* User Permissions Display for Mobile */}
              <UserPermissionsDisplay isCollapsed={false} />
              
              {/* Logout button */}
              <div className="p-3 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 text-foreground hover:text-destructive transition-colors"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">Đăng xuất</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <img src={logo2018} alt="KBA 2018 Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-foreground">KBA.2018</span>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border flex-col h-screen sticky top-0 transition-all duration-300 ease-out",
          isCollapsed ? "w-[60px]" : "w-64"
        )}
      >
        <SidebarContent
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          menuItems={menuItems}
          role={role}
          loading={loading}
          handleLogout={handleLogout}
          isCollapsed={isCollapsed}
        />
        
        {/* Collapse Toggle Button - Hamburger style */}
        <button
          onClick={handleToggleCollapse}
          className={cn(
            "absolute -right-4 top-6 w-8 h-8 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-accent transition-all duration-200 hover:scale-110 z-10",
            isCollapsed && "rotate-180"
          )}
        >
          <div className="flex flex-col gap-[3px] transition-all duration-300">
            <span className={cn(
              "w-3 h-[2px] bg-foreground rounded-full transition-all duration-300",
              isCollapsed && "w-2"
            )} />
            <span className="w-3 h-[2px] bg-foreground rounded-full" />
            <span className={cn(
              "w-3 h-[2px] bg-foreground rounded-full transition-all duration-300",
              isCollapsed && "w-2"
            )} />
          </div>
        </button>
      </aside>
    </>
  );
};
