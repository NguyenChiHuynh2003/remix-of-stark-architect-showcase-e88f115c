import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProjectsSection } from "@/components/dashboard/ProjectsSection";
import { AdminUsers } from "@/components/dashboard/AdminUsers";
import { TasksSection } from "@/components/dashboard/TasksSection";
import { HRSection } from "@/components/dashboard/HRSection";
import { AccountingSection } from "@/components/dashboard/AccountingSection";
import { InventorySection } from "@/components/dashboard/InventorySection";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { ProjectTaskDashboard } from "@/components/dashboard/ProjectTaskDashboard";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { SectionSkeleton } from "@/components/dashboard/SectionSkeleton";
import { useUserRole } from "@/hooks/useUserRole";

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get("section") || "overview";
  const [activeSection, setActiveSection] = useState(initialSection);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { hasAccess, loading: roleLoading } = useUserRole();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchItemId, setSearchItemId] = useState<string | null>(null);

  // Sync URL param with section state
  useEffect(() => {
    const section = searchParams.get("section");
    if (section && section !== activeSection) {
      setActiveSection(section);
    }
  }, [searchParams]);

  // Update URL when section changes
  const handleSetActiveSection = (section: string) => {
    setActiveSection(section);
    if (section === "overview") {
      searchParams.delete("section");
    } else {
      searchParams.set("section", section);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleSearchNavigate = (section: string, itemId?: string) => {
    handleSetActiveSection(section);

    // Open detail dialog directly for projects
    if (section === "projects" && itemId) {
      setSelectedProjectId(itemId);
    }

    // Pass itemId to inventory section for auto-scroll
    if (section === "inventory" && itemId) {
      setSearchItemId(itemId);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={handleSetActiveSection}
          onCollapsedChange={setSidebarCollapsed}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader onNavigate={handleSearchNavigate} />

          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
            <div key={activeSection} className="space-y-4 sm:space-y-6 animate-fade-in">
              {roleLoading ? (
                <SectionSkeleton
                  type={
                    activeSection === "overview"
                      ? "overview"
                      : activeSection === "inventory" || activeSection === "hr"
                        ? "table"
                        : activeSection === "projects"
                          ? "cards"
                          : "list"
                  }
                />
              ) : !hasAccess(activeSection) ? (
                <Card className="border-border animate-scale-in">
                  <CardContent className="pt-6">
                    <div className="text-center py-8 sm:py-12">
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Không có quyền truy cập</h2>
                      <p className="text-muted-foreground text-sm sm:text-base">Bạn không có quyền truy cập mục này.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : activeSection === "projects" ? (
                <ProjectsSection />
              ) : activeSection === "tasks" ? (
                <TasksSection />
              ) : activeSection === "task-dashboard" ? (
                <ProjectTaskDashboard />
              ) : activeSection === "hr" ? (
                <HRSection />
              ) : activeSection === "accounting" ? (
                <AccountingSection />
              ) : activeSection === "inventory" ? (
                <InventorySection searchItemId={searchItemId} onClearSearchItem={() => setSearchItemId(null)} />
              ) : activeSection === "admin-users" ? (
                <AdminUsers />
              ) : activeSection === "overview" ? (
                <OverviewSection onNavigate={handleSetActiveSection} />
              ) : (
                <Card className="border-border animate-scale-in">
                  <CardContent className="pt-6">
                    <div className="text-center py-8 sm:py-12">
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Tính năng đang phát triển</h2>
                      <p className="text-muted-foreground text-sm sm:text-base">Mục này sẽ sớm được ra mắt!</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Project Detail Dialog from search */}
      {selectedProjectId && (
        <ProjectDetailDialog
          projectId={selectedProjectId}
          open={!!selectedProjectId}
          onOpenChange={(open) => !open && setSelectedProjectId(null)}
        />
      )}
    </ProtectedRoute>
  );
};

export default Dashboard;
