import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, RotateCcw, User, Mail, Phone, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Project {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  employee_card_photo_url: string | null;
}

interface PositionAssignment {
  position_key: string;
  position_title: string;
  employee_id: string | null;
  zone: "office" | "site";
  color_scheme: string;
  parent_position_key: string | null;
}

// Define the standard org chart structure based on the image
const defaultPositions: PositionAssignment[] = [
  // OFFICE zone
  { position_key: "project_director", position_title: "PROJECT DIRECTOR", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: null },
  { position_key: "deputy_director", position_title: "DEPUTY PROJECT DIRECTOR", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: "project_director" },
  { position_key: "hse_manager", position_title: "HSE MANAGER", employee_id: null, zone: "office", color_scheme: "orange", parent_position_key: "deputy_director" },
  { position_key: "office_manager", position_title: "OFFICE MANAGER", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: "deputy_director" },
  { position_key: "administration", position_title: "ADMINISTRATION", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: "office_manager" },
  { position_key: "hr", position_title: "HR", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: "office_manager" },
  { position_key: "accountant", position_title: "ACCOUNTANT", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: "office_manager" },
  { position_key: "translator", position_title: "TRANSLATOR", employee_id: null, zone: "office", color_scheme: "blue", parent_position_key: "office_manager" },
  { position_key: "hse_officer", position_title: "HSE OFFICER", employee_id: null, zone: "office", color_scheme: "orange", parent_position_key: "hse_manager" },
  // SITE zone
  { position_key: "site_manager", position_title: "SITE MANAGER", employee_id: null, zone: "site", color_scheme: "blue", parent_position_key: "deputy_director" },
  { position_key: "site_hse", position_title: "SITE HSE", employee_id: null, zone: "site", color_scheme: "orange", parent_position_key: "site_manager" },
  { position_key: "qs_team", position_title: "QS TEAM", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "site_manager" },
  { position_key: "qa_qc", position_title: "QA/QC", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "site_manager" },
  { position_key: "mep_leader", position_title: "M.E.P LEADER", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "site_manager" },
  { position_key: "dc_team", position_title: "D.C TEAM", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "site_manager" },
  { position_key: "foreman_1", position_title: "FOREMAN", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "mep_leader" },
  { position_key: "foreman_2", position_title: "FOREMAN", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "mep_leader" },
  { position_key: "workers", position_title: "WORKERS", employee_id: null, zone: "site", color_scheme: "green", parent_position_key: "foreman_1" },
];

const colorSchemes = {
  blue: {
    header: "bg-blue-600 text-white",
    border: "border-blue-600",
  },
  orange: {
    header: "bg-orange-500 text-white",
    border: "border-orange-500",
  },
  green: {
    header: "bg-emerald-600 text-white",
    border: "border-emerald-600",
  },
};

interface PositionCardProps {
  position: PositionAssignment;
  employee: Employee | null;
  employees: Employee[];
  onEmployeeChange: (positionKey: string, employeeId: string | null) => void;
  isEditing: boolean;
}

const PositionCard = ({ position, employee, employees, onEmployeeChange, isEditing }: PositionCardProps) => {
  const scheme = colorSchemes[position.color_scheme as keyof typeof colorSchemes] || colorSchemes.blue;

  return (
    <div className={`w-48 border-2 rounded-lg overflow-hidden shadow-sm bg-card ${scheme.border}`}>
      <div className={`px-3 py-1.5 text-center text-xs font-semibold ${scheme.header}`}>
        {position.position_title}
      </div>
      <div className="p-3 space-y-2">
        {isEditing ? (
          <Select
            value={position.employee_id || "__none__"}
            onValueChange={(value) => onEmployeeChange(position.position_key, value === "__none__" ? null : value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Chọn nhân viên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Không chọn</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarImage src={employee?.employee_card_photo_url || ""} />
                <AvatarFallback className="text-xs">
                  {employee?.full_name?.charAt(0) || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {employee?.full_name || "—"}
                </p>
              </div>
            </div>
            {employee && (
              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{employee.department || "—"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{employee.phone || "—"}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const OrganizationChart = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [owner, setOwner] = useState("");
  const [investor, setInvestor] = useState("");
  const [positions, setPositions] = useState<PositionAssignment[]>(defaultPositions);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chartId, setChartId] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    loadProjects();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadOrgChart(selectedProjectId);
    } else {
      resetToDefaults();
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, location, description")
      .order("name");
    
    if (data) setProjects(data);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, position, department, phone, employee_card_photo_url")
      .order("full_name");
    
    if (data) setEmployees(data);
  };

  const loadOrgChart = async (projectId: string) => {
    setLoading(true);
    try {
      // Load org chart for this project
      const { data: chartData } = await supabase
        .from("organization_charts")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (chartData) {
        setChartId(chartData.id);
        setOwner(chartData.owner || "");
        setInvestor(chartData.investor || "");

        // Load positions
        const { data: posData } = await supabase
          .from("org_chart_positions")
          .select("*")
          .eq("org_chart_id", chartData.id);

        if (posData && posData.length > 0) {
          const mergedPositions = defaultPositions.map(defPos => {
            const saved = posData.find(p => p.position_key === defPos.position_key);
            return saved ? {
              ...defPos,
              employee_id: saved.employee_id,
            } : defPos;
          });
          setPositions(mergedPositions);
        } else {
          setPositions(defaultPositions);
        }
      } else {
        resetToDefaults();
      }
    } catch (error) {
      console.error("Error loading org chart:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setChartId(null);
    setOwner("");
    setInvestor("");
    setPositions(defaultPositions);
  };

  const handleEmployeeChange = (positionKey: string, employeeId: string | null) => {
    setPositions(prev => prev.map(p => 
      p.position_key === positionKey ? { ...p, employee_id: employeeId } : p
    ));
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast.error("Vui lòng chọn dự án!");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let orgChartId = chartId;

      if (!orgChartId) {
        // Create new org chart
        const { data: newChart, error: chartError } = await supabase
          .from("organization_charts")
          .insert({
            project_id: selectedProjectId,
            owner,
            investor,
            location: selectedProject?.location,
            created_by: user.id,
          })
          .select()
          .single();

        if (chartError) throw chartError;
        orgChartId = newChart.id;
        setChartId(orgChartId);
      } else {
        // Update existing
        const { error: updateError } = await supabase
          .from("organization_charts")
          .update({
            owner,
            investor,
            location: selectedProject?.location,
          })
          .eq("id", orgChartId);

        if (updateError) throw updateError;
      }

      // Upsert positions
      const positionsToSave = positions.map((pos, index) => ({
        org_chart_id: orgChartId,
        position_key: pos.position_key,
        position_title: pos.position_title,
        employee_id: pos.employee_id,
        zone: pos.zone,
        color_scheme: pos.color_scheme,
        display_order: index,
        parent_position_key: pos.parent_position_key,
      }));

      // Delete existing positions and insert new ones
      await supabase
        .from("org_chart_positions")
        .delete()
        .eq("org_chart_id", orgChartId);

      const { error: posError } = await supabase
        .from("org_chart_positions")
        .insert(positionsToSave);

      if (posError) throw posError;

      toast.success("Lưu sơ đồ tổ chức thành công!");
      setIsEditing(false);
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeById = (id: string | null) => {
    if (!id) return null;
    return employees.find(e => e.id === id) || null;
  };

  const officePositions = positions.filter(p => p.zone === "office");
  const sitePositions = positions.filter(p => p.zone === "site");

  return (
    <div className="space-y-6">
      {/* Project Selection Header */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Thông tin Dự án
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Chọn Dự án</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn dự án..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Nhập tên chủ đầu tư"
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label>Investor</Label>
              <Input
                value={investor}
                onChange={(e) => setInvestor(e.target.value)}
                placeholder="Nhập tên nhà đầu tư"
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={selectedProject?.location || ""}
                disabled
                placeholder="Địa điểm dự án"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Đang lưu..." : "Lưu"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Hủy
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)} disabled={!selectedProjectId}>
                  Chỉnh sửa
                </Button>
                <Button variant="outline" onClick={() => loadOrgChart(selectedProjectId)} disabled={!selectedProjectId}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Tải lại
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization Chart */}
      <Card className="overflow-auto">
        <CardContent className="p-6">
          <div className="min-w-[1200px] space-y-8">
            {/* OFFICE Zone */}
            <div>
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-md font-semibold mb-4 inline-block">
                OFFICE
              </div>
              
              {/* Project Director */}
              <div className="flex flex-col items-center space-y-4">
                <PositionCard
                  position={positions.find(p => p.position_key === "project_director")!}
                  employee={getEmployeeById(positions.find(p => p.position_key === "project_director")?.employee_id || null)}
                  employees={employees}
                  onEmployeeChange={handleEmployeeChange}
                  isEditing={isEditing}
                />
                
                {/* Connector line */}
                <div className="w-px h-6 bg-border" />
                
                {/* Deputy Director */}
                <PositionCard
                  position={positions.find(p => p.position_key === "deputy_director")!}
                  employee={getEmployeeById(positions.find(p => p.position_key === "deputy_director")?.employee_id || null)}
                  employees={employees}
                  onEmployeeChange={handleEmployeeChange}
                  isEditing={isEditing}
                />
                
                {/* Connector to branches */}
                <div className="w-px h-6 bg-border" />
                <div className="w-[800px] h-px bg-border" />
                
                {/* Second level - HSE Manager, Office Manager */}
                <div className="flex justify-center gap-16">
                  {/* HSE Branch */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "hse_manager")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "hse_manager")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "hse_officer")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "hse_officer")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                  </div>
                  
                  {/* Office Manager Branch */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "office_manager")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "office_manager")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                    <div className="w-px h-6 bg-border" />
                    <div className="w-[400px] h-px bg-border" />
                    <div className="flex gap-4">
                      {["administration", "hr", "accountant", "translator"].map(key => (
                        <div key={key} className="flex flex-col items-center">
                          <div className="w-px h-6 bg-border" />
                          <PositionCard
                            position={positions.find(p => p.position_key === key)!}
                            employee={getEmployeeById(positions.find(p => p.position_key === key)?.employee_id || null)}
                            employees={employees}
                            onEmployeeChange={handleEmployeeChange}
                            isEditing={isEditing}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed border-muted-foreground/30" />

            {/* SITE Zone */}
            <div>
              <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 px-4 py-2 rounded-md font-semibold mb-4 inline-block">
                SITE
              </div>
              
              <div className="flex flex-col items-center space-y-4">
                {/* Site Manager */}
                <PositionCard
                  position={positions.find(p => p.position_key === "site_manager")!}
                  employee={getEmployeeById(positions.find(p => p.position_key === "site_manager")?.employee_id || null)}
                  employees={employees}
                  onEmployeeChange={handleEmployeeChange}
                  isEditing={isEditing}
                />
                
                <div className="w-px h-6 bg-border" />
                <div className="w-[900px] h-px bg-border" />
                
                {/* Site level 2 */}
                <div className="flex justify-center gap-6">
                  {/* Site HSE */}
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "site_hse")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "site_hse")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                  </div>
                  
                  {/* QS Team */}
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "qs_team")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "qs_team")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                  </div>
                  
                  {/* QA/QC */}
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "qa_qc")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "qa_qc")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                  </div>
                  
                  {/* MEP Leader with sub-positions */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "mep_leader")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "mep_leader")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                    <div className="w-px h-6 bg-border" />
                    <div className="w-[200px] h-px bg-border" />
                    <div className="flex gap-4">
                      {["foreman_1", "foreman_2"].map(key => (
                        <div key={key} className="flex flex-col items-center">
                          <div className="w-px h-6 bg-border" />
                          <PositionCard
                            position={positions.find(p => p.position_key === key)!}
                            employee={getEmployeeById(positions.find(p => p.position_key === key)?.employee_id || null)}
                            employees={employees}
                            onEmployeeChange={handleEmployeeChange}
                            isEditing={isEditing}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "workers")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "workers")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                  </div>
                  
                  {/* DC Team */}
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <PositionCard
                      position={positions.find(p => p.position_key === "dc_team")!}
                      employee={getEmployeeById(positions.find(p => p.position_key === "dc_team")?.employee_id || null)}
                      employees={employees}
                      onEmployeeChange={handleEmployeeChange}
                      isEditing={isEditing}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
