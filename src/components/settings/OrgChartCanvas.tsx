import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Save, 
  Plus, 
  Trash2, 
  Building2, 
  Download, 
  Edit3, 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  User,
  Mail,
  Phone,
  Briefcase,
  Circle,
  LayoutTemplate
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import jsPDF from "jspdf";

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
  user_id: string | null;
}

interface ChartNode {
  id: string;
  position_key: string;
  position_title: string;
  employee_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color_scheme: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: "hierarchy" | "equal";
}

interface ConnectionPoint {
  nodeId: string;
  side: "top" | "bottom" | "left" | "right";
  x: number;
  y: number;
}

const colorSchemes = {
  blue: { header: "#2563eb", border: "#3b82f6", bg: "#eff6ff" },
  orange: { header: "#ea580c", border: "#f97316", bg: "#fff7ed" },
  green: { header: "#059669", border: "#10b981", bg: "#ecfdf5" },
  purple: { header: "#7c3aed", border: "#8b5cf6", bg: "#f5f3ff" },
  red: { header: "#dc2626", border: "#ef4444", bg: "#fef2f2" },
  teal: { header: "#0d9488", border: "#14b8a6", bg: "#f0fdfa" },
};

// Standard template based on the IPC E&C organization chart
interface TemplateNode {
  position_key: string;
  position_title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color_scheme: string;
}

interface TemplateConnection {
  sourceKey: string;
  targetKey: string;
  type: "hierarchy" | "equal";
}

const standardTemplate: { nodes: TemplateNode[]; connections: TemplateConnection[] } = {
  nodes: [
    // Level 0 - Board of Directors
    { position_key: "board_directors", position_title: "IPC E&C\nBOARD OF DIRECTORS", x: 550, y: 20, width: 180, height: 60, color_scheme: "blue" },
    
    // Level 1 - Director of Rooftop
    { position_key: "director_rooftop", position_title: "DIRECTOR OF ROOFTOP", x: 350, y: 120, width: 200, height: 130, color_scheme: "blue" },
    
    // Level 1 - HSE Manager (Office - right side)
    { position_key: "hse_manager_office", position_title: "HSE MANAGER", x: 850, y: 120, width: 200, height: 130, color_scheme: "teal" },
    
    // Level 2 - Project Director
    { position_key: "project_director", position_title: "PROJECT DIRECTOR", x: 450, y: 280, width: 200, height: 130, color_scheme: "blue" },
    
    // Level 2 - Legal Manager (Office zone)
    { position_key: "legal_manager", position_title: "LEGAL MANAGER", x: 150, y: 320, width: 200, height: 130, color_scheme: "blue" },
    
    // Level 2 - DC Team (Office zone)
    { position_key: "dc_team_office", position_title: "DC TEAM", x: 750, y: 320, width: 200, height: 130, color_scheme: "teal" },
    
    // Level 3 - Project Manager (Site zone)
    { position_key: "project_manager", position_title: "PROJECT MANAGER", x: 350, y: 450, width: 200, height: 130, color_scheme: "blue" },
    
    // Level 3 - HSE Team (Site zone - group)
    { position_key: "hse_team", position_title: "HSE TEAM", x: 850, y: 420, width: 180, height: 50, color_scheme: "teal" },
    { position_key: "hse_manager_site", position_title: "HSE MANAGER", x: 800, y: 490, width: 180, height: 130, color_scheme: "teal" },
    { position_key: "hse_engineer_1", position_title: "HSE ENGINEER", x: 680, y: 650, width: 160, height: 130, color_scheme: "teal" },
    { position_key: "hse_engineer_2", position_title: "HSE ENGINEER", x: 860, y: 650, width: 160, height: 130, color_scheme: "teal" },
    { position_key: "hse_engineer_3", position_title: "HSE ENGINEER", x: 1040, y: 720, width: 160, height: 130, color_scheme: "teal" },
    
    // Level 4 - Site Managers
    { position_key: "site_manager_1", position_title: "SITE MANAGER", x: 200, y: 600, width: 180, height: 130, color_scheme: "blue" },
    { position_key: "site_manager_2", position_title: "SITE MANAGER", x: 400, y: 600, width: 180, height: 130, color_scheme: "blue" },
    
    // Level 5 - Lower positions
    { position_key: "store_keeper", position_title: "STORE KEEPER", x: 30, y: 780, width: 160, height: 130, color_scheme: "blue" },
    { position_key: "designer_manager", position_title: "DESIGNER MANAGER", x: 210, y: 780, width: 180, height: 130, color_scheme: "blue" },
    { position_key: "supervisor_1", position_title: "SUPERVISOR", x: 580, y: 780, width: 160, height: 130, color_scheme: "blue" },
    
    // T&C Team
    { position_key: "tc_team_1", position_title: "T&C TEAM", x: 1050, y: 520, width: 160, height: 130, color_scheme: "green" },
    { position_key: "tc_team_2", position_title: "T&C TEAM", x: 1050, y: 680, width: 160, height: 130, color_scheme: "green" },
    
    // Security Team
    { position_key: "security_team", position_title: "SECURITY TEAM", x: 1220, y: 450, width: 160, height: 130, color_scheme: "green" },
    
    // Designer
    { position_key: "designer", position_title: "DESIGNER", x: 210, y: 940, width: 160, height: 130, color_scheme: "blue" },
    
    // Supervisors
    { position_key: "supervisor_2", position_title: "SUPERVISOR", x: 390, y: 940, width: 160, height: 130, color_scheme: "blue" },
    { position_key: "supervisor_3", position_title: "SUPERVISOR", x: 570, y: 940, width: 160, height: 130, color_scheme: "blue" },
    
    // Constructions Team
    { position_key: "constructions_team", position_title: "CONTRUCTIONS TEAM", x: 480, y: 1100, width: 180, height: 50, color_scheme: "blue" },
  ],
  connections: [
    // Board to Director
    { sourceKey: "board_directors", targetKey: "director_rooftop", type: "hierarchy" },
    
    // Director connections
    { sourceKey: "director_rooftop", targetKey: "project_director", type: "hierarchy" },
    { sourceKey: "director_rooftop", targetKey: "hse_manager_office", type: "hierarchy" },
    
    // Project Director connections
    { sourceKey: "project_director", targetKey: "legal_manager", type: "hierarchy" },
    { sourceKey: "project_director", targetKey: "dc_team_office", type: "hierarchy" },
    { sourceKey: "project_director", targetKey: "project_manager", type: "hierarchy" },
    
    // Project Manager connections
    { sourceKey: "project_manager", targetKey: "site_manager_1", type: "hierarchy" },
    { sourceKey: "project_manager", targetKey: "site_manager_2", type: "hierarchy" },
    { sourceKey: "project_manager", targetKey: "hse_team", type: "hierarchy" },
    
    // HSE Team connections
    { sourceKey: "hse_team", targetKey: "hse_manager_site", type: "hierarchy" },
    { sourceKey: "hse_manager_site", targetKey: "hse_engineer_1", type: "hierarchy" },
    { sourceKey: "hse_manager_site", targetKey: "hse_engineer_2", type: "hierarchy" },
    { sourceKey: "hse_engineer_2", targetKey: "hse_engineer_3", type: "hierarchy" },
    
    // Site Manager 1 connections
    { sourceKey: "site_manager_1", targetKey: "store_keeper", type: "hierarchy" },
    { sourceKey: "site_manager_1", targetKey: "designer_manager", type: "hierarchy" },
    
    // Site Manager 2 connections
    { sourceKey: "site_manager_2", targetKey: "supervisor_1", type: "hierarchy" },
    
    // Designer Manager connections
    { sourceKey: "designer_manager", targetKey: "designer", type: "hierarchy" },
    
    // Supervisor connections
    { sourceKey: "supervisor_1", targetKey: "supervisor_2", type: "hierarchy" },
    { sourceKey: "supervisor_1", targetKey: "supervisor_3", type: "hierarchy" },
    
    // T&C connections
    { sourceKey: "project_manager", targetKey: "tc_team_1", type: "hierarchy" },
    { sourceKey: "tc_team_1", targetKey: "tc_team_2", type: "hierarchy" },
    
    // Security connection
    { sourceKey: "project_manager", targetKey: "security_team", type: "hierarchy" },
    
    // Constructions Team
    { sourceKey: "supervisor_2", targetKey: "constructions_team", type: "hierarchy" },
    { sourceKey: "supervisor_3", targetKey: "constructions_team", type: "hierarchy" },
    
    // Equal connections (dashed lines)
    { sourceKey: "hse_manager_office", targetKey: "hse_team", type: "equal" },
    { sourceKey: "dc_team_office", targetKey: "hse_team", type: "equal" },
  ],
};

export const OrgChartCanvas = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [owner, setOwner] = useState("");
  const [investor, setInvestor] = useState("");
  const [chartId, setChartId] = useState<string | null>(null);
  
  const [nodes, setNodes] = useState<ChartNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Connection dragging state
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<ConnectionPoint | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [pendingConnectionType, setPendingConnectionType] = useState<"hierarchy" | "equal">("hierarchy");
  const [showConnectionTypeDialog, setShowConnectionTypeDialog] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{sourceId: string; targetId: string} | null>(null);
  const [hoveredConnectionPoint, setHoveredConnectionPoint] = useState<ConnectionPoint | null>(null);
  
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeColor, setNewNodeColor] = useState("blue");

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    loadProjects();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadOrgChart(selectedProjectId);
    } else {
      resetChart();
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
      .select("id, full_name, position, department, phone, employee_card_photo_url, user_id")
      .order("full_name");
    if (data) setEmployees(data);
  };

  const loadOrgChart = async (projectId: string) => {
    setLoading(true);
    try {
      const { data: chartData } = await supabase
        .from("organization_charts")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (chartData) {
        setChartId(chartData.id);
        setOwner(chartData.owner || "");
        setInvestor(chartData.investor || "");

        const { data: posData } = await supabase
          .from("org_chart_positions")
          .select("*")
          .eq("org_chart_id", chartData.id);

        if (posData && posData.length > 0) {
          const loadedNodes: ChartNode[] = posData.map((p: any) => ({
            id: p.id,
            position_key: p.position_key,
            position_title: p.position_title,
            employee_id: p.employee_id,
            x: p.x_position || 400,
            y: p.y_position || 100,
            width: p.width || 200,
            height: p.height || 120,
            color_scheme: p.color_scheme || "blue",
          }));
          setNodes(loadedNodes);

          const { data: connData } = await supabase
            .from("org_chart_connections")
            .select("*")
            .eq("org_chart_id", chartData.id);

          if (connData) {
            const loadedConnections: Connection[] = connData.map((c: any) => ({
              id: c.id,
              sourceId: c.source_position_id,
              targetId: c.target_position_id,
              connectionType: c.connection_type,
            }));
            setConnections(loadedConnections);
          }
        } else {
          setNodes([]);
          setConnections([]);
        }
      } else {
        resetChart();
      }
    } catch (error) {
      console.error("Error loading org chart:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetChart = () => {
    setChartId(null);
    setOwner("");
    setInvestor("");
    setNodes([]);
    setConnections([]);
  };

  const handleAddNode = () => {
    if (!newNodeTitle.trim()) {
      toast.error("Vui lòng nhập tên chức vụ!");
      return;
    }

    const newNode: ChartNode = {
      id: `temp-${Date.now()}`,
      position_key: `pos_${Date.now()}`,
      position_title: newNodeTitle.trim().toUpperCase(),
      employee_id: null,
      x: 400 - pan.x / zoom,
      y: 200 - pan.y / zoom,
      width: 200,
      height: 130,
      color_scheme: newNodeColor,
    };

    setNodes(prev => [...prev, newNode]);
    setNewNodeTitle("");
    setShowAddDialog(false);
    toast.success("Đã thêm vị trí mới!");
  };

  // Apply standard template
  const applyTemplate = () => {
    if (nodes.length > 0) {
      const confirmApply = window.confirm(
        "Áp dụng template sẽ xóa tất cả các node hiện tại. Bạn có chắc chắn muốn tiếp tục?"
      );
      if (!confirmApply) return;
    }

    // Create nodes from template
    const newNodes: ChartNode[] = standardTemplate.nodes.map((tNode, index) => ({
      id: `temp-${Date.now()}-${index}`,
      position_key: tNode.position_key,
      position_title: tNode.position_title,
      employee_id: null,
      x: tNode.x,
      y: tNode.y,
      width: tNode.width,
      height: tNode.height,
      color_scheme: tNode.color_scheme,
    }));

    // Create connections from template
    const nodeKeyToId = new Map<string, string>();
    newNodes.forEach(node => {
      nodeKeyToId.set(node.position_key, node.id);
    });

    const newConnections: Connection[] = standardTemplate.connections
      .map((tConn, index) => {
        const sourceId = nodeKeyToId.get(tConn.sourceKey);
        const targetId = nodeKeyToId.get(tConn.targetKey);
        if (!sourceId || !targetId) return null;
        return {
          id: `conn-${Date.now()}-${index}`,
          sourceId,
          targetId,
          connectionType: tConn.type,
        };
      })
      .filter((c): c is Connection => c !== null);

    setNodes(newNodes);
    setConnections(newConnections);
    setSelectedNodeId(null);
    setShowTemplateDialog(false);
    
    // Center the view
    setZoom(0.5);
    setPan({ x: 50, y: 50 });
    
    toast.success("Đã áp dụng template chuẩn!");
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setConnections(prev => prev.filter(c => c.sourceId !== selectedNodeId && c.targetId !== selectedNodeId));
    setSelectedNodeId(null);
    toast.success("Đã xóa vị trí!");
  };

  const handleEmployeeChange = (employeeId: string | null) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => 
      n.id === selectedNodeId ? { ...n, employee_id: employeeId } : n
    ));
  };

  const handleNodeTitleChange = (title: string) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => 
      n.id === selectedNodeId ? { ...n, position_title: title.toUpperCase() } : n
    ));
  };

  const handleColorChange = (color: string) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => 
      n.id === selectedNodeId ? { ...n, color_scheme: color } : n
    ));
  };

  // Get connection points for a node
  const getConnectionPoints = (node: ChartNode): ConnectionPoint[] => [
    { nodeId: node.id, side: "top", x: node.x + node.width / 2, y: node.y },
    { nodeId: node.id, side: "bottom", x: node.x + node.width / 2, y: node.y + node.height },
    { nodeId: node.id, side: "left", x: node.x, y: node.y + node.height / 2 },
    { nodeId: node.id, side: "right", x: node.x + node.width, y: node.y + node.height / 2 },
  ];

  // Calculate bezier curve path between two points
  const getBezierPath = (
    x1: number, y1: number, 
    x2: number, y2: number,
    sourceNode?: ChartNode,
    targetNode?: ChartNode
  ): string => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // Determine curve direction based on relative positions
    const isVertical = Math.abs(dy) > Math.abs(dx);
    
    let cx1: number, cy1: number, cx2: number, cy2: number;
    
    if (isVertical) {
      // Vertical connection - control points extend horizontally then vertically
      const offset = Math.min(Math.abs(dy) * 0.5, 80);
      cx1 = x1;
      cy1 = y1 + (dy > 0 ? offset : -offset);
      cx2 = x2;
      cy2 = y2 + (dy > 0 ? -offset : offset);
    } else {
      // Horizontal connection - control points extend horizontally
      const offset = Math.min(Math.abs(dx) * 0.5, 80);
      cx1 = x1 + (dx > 0 ? offset : -offset);
      cy1 = y1;
      cx2 = x2 + (dx > 0 ? -offset : offset);
      cy2 = y2;
    }
    
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  };

  // Find best connection points between two nodes
  const getBestConnectionPoints = (sourceNode: ChartNode, targetNode: ChartNode) => {
    const sourcePoints = getConnectionPoints(sourceNode);
    const targetPoints = getConnectionPoints(targetNode);
    
    let minDist = Infinity;
    let bestSource = sourcePoints[0];
    let bestTarget = targetPoints[0];
    
    for (const sp of sourcePoints) {
      for (const tp of targetPoints) {
        const dist = Math.sqrt((sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          bestSource = sp;
          bestTarget = tp;
        }
      }
    }
    
    return { source: bestSource, target: bestTarget };
  };

  // Handle connection point drag start
  const handleConnectionPointMouseDown = (e: React.MouseEvent, point: ConnectionPoint) => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsDraggingConnection(true);
    setConnectionStart(point);
    setConnectionEnd({ x: point.x, y: point.y });
  };

  // Handle mouse move for connection dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    if (isDraggingConnection) {
      setConnectionEnd({ x: mouseX, y: mouseY });
      
      // Check if hovering over a connection point
      let foundPoint: ConnectionPoint | null = null;
      for (const node of nodes) {
        if (node.id === connectionStart?.nodeId) continue;
        const points = getConnectionPoints(node);
        for (const point of points) {
          const dist = Math.sqrt((point.x - mouseX) ** 2 + (point.y - mouseY) ** 2);
          if (dist < 20) {
            foundPoint = point;
            break;
          }
        }
        if (foundPoint) break;
      }
      setHoveredConnectionPoint(foundPoint);
    } else if (dragging) {
      const newX = mouseX - dragOffset.x;
      const newY = mouseY - dragOffset.y;

      setNodes(prev => prev.map(n => 
        n.id === dragging ? { ...n, x: Math.max(0, newX), y: Math.max(0, newY) } : n
      ));
    } else if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y),
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDraggingConnection, connectionStart, dragging, dragOffset, pan, zoom, isPanning, panStart, nodes]);

  // Handle mouse up - complete connection if valid
  const handleMouseUp = useCallback(() => {
    if (isDraggingConnection && connectionStart && hoveredConnectionPoint) {
      // Check if connection already exists
      const exists = connections.some(
        c => (c.sourceId === connectionStart.nodeId && c.targetId === hoveredConnectionPoint.nodeId) ||
             (c.sourceId === hoveredConnectionPoint.nodeId && c.targetId === connectionStart.nodeId)
      );
      
      if (!exists) {
        // Show dialog to choose connection type
        setPendingConnection({
          sourceId: connectionStart.nodeId,
          targetId: hoveredConnectionPoint.nodeId
        });
        setShowConnectionTypeDialog(true);
      }
    }
    
    setIsDraggingConnection(false);
    setConnectionStart(null);
    setConnectionEnd(null);
    setHoveredConnectionPoint(null);
    setDragging(null);
    setIsPanning(false);
  }, [isDraggingConnection, connectionStart, hoveredConnectionPoint, connections]);

  // Create connection after type is selected
  const createConnectionWithType = (type: "hierarchy" | "equal") => {
    if (pendingConnection) {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        sourceId: pendingConnection.sourceId,
        targetId: pendingConnection.targetId,
        connectionType: type,
      };
      setConnections(prev => [...prev, newConnection]);
      toast.success(type === "hierarchy" ? "Đã tạo kết nối phân cấp!" : "Đã tạo kết nối ngang cấp!");
    }
    setPendingConnection(null);
    setShowConnectionTypeDialog(false);
  };

  // Toggle connection type
  const toggleConnectionType = (connId: string) => {
    setConnections(prev => prev.map(c => 
      c.id === connId 
        ? { ...c, connectionType: c.connectionType === "hierarchy" ? "equal" : "hierarchy" }
        : c
    ));
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDragging(nodeId);
    setDragOffset({ x: mouseX - node.x, y: mouseY - node.y });
    setSelectedNodeId(nodeId);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === canvasRef.current) {
      setSelectedNodeId(null);
    }
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const removeConnection = (sourceId: string, targetId: string) => {
    setConnections(prev => prev.filter(
      c => !(c.sourceId === sourceId && c.targetId === targetId)
    ));
    toast.success("Đã xóa kết nối!");
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
        await supabase
          .from("organization_charts")
          .update({ owner, investor, location: selectedProject?.location })
          .eq("id", orgChartId);
      }

      await supabase.from("org_chart_connections").delete().eq("org_chart_id", orgChartId);
      await supabase.from("org_chart_positions").delete().eq("org_chart_id", orgChartId);

      const positionsToSave = nodes.map((node, index) => ({
        org_chart_id: orgChartId,
        position_key: node.position_key,
        position_title: node.position_title,
        employee_id: node.employee_id,
        zone: "site",
        color_scheme: node.color_scheme,
        display_order: index,
        x_position: node.x,
        y_position: node.y,
        width: node.width,
        height: node.height,
      }));

      const { data: savedPositions, error: posError } = await supabase
        .from("org_chart_positions")
        .insert(positionsToSave)
        .select();

      if (posError) throw posError;

      const idMap = new Map<string, string>();
      nodes.forEach((node, index) => {
        if (savedPositions[index]) {
          idMap.set(node.id, savedPositions[index].id);
        }
      });

      setNodes(prev => prev.map((node, index) => ({
        ...node,
        id: savedPositions[index]?.id || node.id,
      })));

      if (connections.length > 0) {
        const connectionsToSave = connections
          .map(conn => ({
            org_chart_id: orgChartId,
            source_position_id: idMap.get(conn.sourceId) || conn.sourceId,
            target_position_id: idMap.get(conn.targetId) || conn.targetId,
            connection_type: conn.connectionType,
          }))
          .filter(c => c.source_position_id && c.target_position_id);

        if (connectionsToSave.length > 0) {
          const { error: connError } = await supabase
            .from("org_chart_connections")
            .insert(connectionsToSave);

          if (connError) throw connError;
        }
      }

      toast.success("Lưu sơ đồ tổ chức thành công!");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeById = (id: string | null) => {
    if (!id) return null;
    return employees.find(e => e.id === id) || null;
  };

  // Helper function to load image as base64
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const exportToPDF = async () => {
    if (nodes.length === 0) {
      toast.error("Không có dữ liệu để xuất!");
      return;
    }

    try {
      toast.info("Đang tạo PDF, vui lòng đợi...");
      
      // Load Vietnamese font
      const { loadRobotoFont, arrayBufferToBase64 } = await import("@/lib/pdfFonts");
      const fonts = await loadRobotoFont();
      
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      
      // Add Noto Sans font (supports Vietnamese)
      pdf.addFileToVFS("NotoSans-Regular.ttf", arrayBufferToBase64(fonts.normal));
      pdf.addFileToVFS("NotoSans-Bold.ttf", arrayBufferToBase64(fonts.bold));
      pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
      pdf.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

      // Pre-load all employee photos
      const employeePhotos = new Map<string, string>();
      const photoLoadPromises: Promise<void>[] = [];
      
      for (const node of nodes) {
        const employee = getEmployeeById(node.employee_id);
        if (employee?.employee_card_photo_url) {
          photoLoadPromises.push(
            loadImageAsBase64(employee.employee_card_photo_url).then((base64) => {
              if (base64) {
                employeePhotos.set(employee.id, base64);
              }
            })
          );
        }
      }
      
      await Promise.all(photoLoadPromises);

      // Title
      pdf.setFont("NotoSans", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(30, 30, 30);
      pdf.text("SƠ ĐỒ TỔ CHỨC DỰ ÁN", 210, 18, { align: "center" });

      // Header info
      pdf.setFont("NotoSans", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(60, 60, 60);
      
      let yPos = 28;
      const leftInfoX = 15;
      const rightInfoX = 280;
      
      if (selectedProject?.name) {
        pdf.setFont("NotoSans", "bold");
        pdf.text(`Dự án: ${selectedProject.name}`, leftInfoX, yPos);
        pdf.setFont("NotoSans", "normal");
      }
      if (selectedProject?.location) {
        pdf.text(`Địa điểm: ${selectedProject.location}`, rightInfoX, yPos);
      }
      yPos += 6;
      if (owner) {
        pdf.text(`Chủ đầu tư: ${owner}`, leftInfoX, yPos);
      }
      if (investor) {
        pdf.text(`Nhà đầu tư: ${investor}`, rightInfoX, yPos);
      }

      // Calculate chart bounds
      const minX = Math.min(...nodes.map(n => n.x));
      const minY = Math.min(...nodes.map(n => n.y));
      const maxX = Math.max(...nodes.map(n => n.x + n.width));
      const maxY = Math.max(...nodes.map(n => n.y + n.height));

      const chartWidth = maxX - minX + 60;
      const chartHeight = maxY - minY + 60;
      
      // Scale to fit A3 landscape with margins
      const availableWidth = 390;
      const availableHeight = 170;
      const scale = Math.min(availableWidth / chartWidth, availableHeight / chartHeight, 0.5);
      
      const offsetX = (420 - chartWidth * scale) / 2;
      const offsetY = 50;

      // Helper to convert coordinates
      const toX = (x: number) => offsetX + (x - minX + 30) * scale;
      const toY = (y: number) => offsetY + (y - minY + 30) * scale;

      // Draw connections FIRST (so they're behind nodes)
      connections.forEach(conn => {
        const sourceNode = nodes.find(n => n.id === conn.sourceId);
        const targetNode = nodes.find(n => n.id === conn.targetId);
        if (!sourceNode || !targetNode) return;

        const { source, target } = getBestConnectionPoints(sourceNode, targetNode);
        
        const x1 = toX(source.x);
        const y1 = toY(source.y);
        const x2 = toX(target.x);
        const y2 = toY(target.y);
        
        // Set connection style based on type
        if (conn.connectionType === "equal") {
          pdf.setDrawColor(16, 185, 129); // green-500
          pdf.setLineDashPattern([2, 1.5], 0);
        } else {
          pdf.setDrawColor(59, 130, 246); // blue-500
          pdf.setLineDashPattern([], 0);
        }
        pdf.setLineWidth(0.6);
        
        // Draw smooth curved path
        const dx = x2 - x1;
        const dy = y2 - y1;
        const isVertical = Math.abs(dy) > Math.abs(dx);
        
        if (isVertical) {
          const midY1 = y1 + dy * 0.4;
          const midY2 = y1 + dy * 0.6;
          // Vertical: go down, across, down
          pdf.line(x1, y1, x1, midY1);
          pdf.line(x1, midY1, x2, midY2);
          pdf.line(x2, midY2, x2, y2);
        } else {
          const midX1 = x1 + dx * 0.4;
          const midX2 = x1 + dx * 0.6;
          // Horizontal: go right, down, right
          pdf.line(x1, y1, midX1, y1);
          pdf.line(midX1, y1, midX2, y2);
          pdf.line(midX2, y2, x2, y2);
        }
        
        // Draw arrowhead for hierarchy connections
        if (conn.connectionType === "hierarchy") {
          const arrowSize = 2;
          const angle = Math.atan2(y2 - y1, x2 - x1);
          pdf.setFillColor(59, 130, 246);
          pdf.triangle(
            x2, y2,
            x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6),
            x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6),
            "F"
          );
        }
        
        // Draw label for equal connections
        if (conn.connectionType === "equal") {
          const midLabelX = (x1 + x2) / 2;
          const midLabelY = (y1 + y2) / 2 - 2;
          pdf.setFont("NotoSans", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(16, 185, 129);
          pdf.text("⟷", midLabelX, midLabelY, { align: "center" });
        }
      });

      // Reset line dash
      pdf.setLineDashPattern([], 0);

      // Draw nodes
      for (const node of nodes) {
        const x = toX(node.x);
        const y = toY(node.y);
        const w = node.width * scale;
        const h = node.height * scale;
        
        const colors = colorSchemes[node.color_scheme as keyof typeof colorSchemes] || colorSchemes.blue;
        
        // Parse colors
        const parseHex = (hex: string) => ({
          r: parseInt(hex.slice(1, 3), 16),
          g: parseInt(hex.slice(3, 5), 16),
          b: parseInt(hex.slice(5, 7), 16),
        });
        
        const headerClr = parseHex(colors.header);
        const borderClr = parseHex(colors.border);

        // Draw card shadow
        pdf.setFillColor(180, 180, 180);
        pdf.roundedRect(x + 0.5, y + 0.5, w, h, 1.5, 1.5, "F");

        // Draw card background
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(borderClr.r, borderClr.g, borderClr.b);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

        // Draw header
        const headerHeight = h * 0.22;
        pdf.setFillColor(headerClr.r, headerClr.g, headerClr.b);
        
        // Draw header with top rounded corners only
        pdf.roundedRect(x, y, w, headerHeight + 1, 1.5, 1.5, "F");
        pdf.rect(x, y + headerHeight - 0.5, w, 1.5, "F");

        // Header text
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("NotoSans", "bold");
        pdf.setFontSize(Math.max(5.5, 7 * scale));
        
        // Truncate title if too long
        const maxTitleWidth = w - 2;
        let title = node.position_title;
        while (pdf.getTextWidth(title) > maxTitleWidth && title.length > 3) {
          title = title.slice(0, -4) + "...";
        }
        pdf.text(title, x + w / 2, y + headerHeight / 2 + 1.5, { align: "center" });

        // Content area
        const employee = getEmployeeById(node.employee_id);
        const contentY = y + headerHeight + 2;
        const contentH = h - headerHeight - 2;
        
        pdf.setTextColor(40, 40, 40);
        pdf.setFont("NotoSans", "normal");
        pdf.setFontSize(Math.max(5, 6 * scale));
        
        if (employee) {
          // Calculate photo dimensions
          const photoSize = Math.min(contentH * 0.85, w * 0.25);
          const photoPadding = 1.5;
          const photoX = x + photoPadding;
          const photoY = contentY + (contentH - photoSize) / 2;
          
          // Draw employee photo if available
          const photoBase64 = employeePhotos.get(employee.id);
          if (photoBase64) {
            try {
              // Draw photo border/frame
              pdf.setDrawColor(200, 200, 200);
              pdf.setLineWidth(0.2);
              pdf.roundedRect(photoX - 0.3, photoY - 0.3, photoSize + 0.6, photoSize + 0.6, 0.5, 0.5, "S");
              
              // Add photo
              pdf.addImage(photoBase64, "JPEG", photoX, photoY, photoSize, photoSize);
            } catch (imgError) {
              console.error("Error adding image to PDF:", imgError);
              // Draw placeholder circle if image fails
              pdf.setFillColor(230, 230, 230);
              pdf.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, "F");
              pdf.setTextColor(150, 150, 150);
              pdf.setFontSize(Math.max(4, 5 * scale));
              pdf.text("👤", photoX + photoSize / 2, photoY + photoSize / 2 + 1, { align: "center" });
            }
          } else {
            // Draw placeholder for no photo
            pdf.setFillColor(230, 230, 230);
            pdf.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, "F");
            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(Math.max(4, 5 * scale));
            pdf.text("👤", photoX + photoSize / 2, photoY + photoSize / 2 + 1, { align: "center" });
          }
          
          // Text position adjusted for photo
          const textX = photoX + photoSize + 2;
          const textMaxW = w - photoSize - 5;
          
          // Employee name
          pdf.setTextColor(40, 40, 40);
          pdf.setFont("NotoSans", "bold");
          pdf.setFontSize(Math.max(5.5, 6.5 * scale));
          let empName = employee.full_name;
          while (pdf.getTextWidth(empName) > textMaxW && empName.length > 3) {
            empName = empName.slice(0, -4) + "...";
          }
          pdf.text(empName, textX, contentY + contentH * 0.25);
          
          // Department/Email
          pdf.setFont("NotoSans", "normal");
          pdf.setFontSize(Math.max(4.5, 5.5 * scale));
          pdf.setTextColor(100, 100, 100);
          if (employee.department) {
            let dept = employee.department;
            while (pdf.getTextWidth(dept) > textMaxW && dept.length > 3) {
              dept = dept.slice(0, -4) + "...";
            }
            pdf.text(dept, textX, contentY + contentH * 0.5);
          }
          
          // Phone
          if (employee.phone) {
            pdf.text(employee.phone, textX, contentY + contentH * 0.75);
          }
        } else {
          // No employee assigned
          pdf.setTextColor(150, 150, 150);
          pdf.setFont("NotoSans", "normal");
          pdf.setFontSize(Math.max(5, 6 * scale));
          pdf.text("Chưa gán nhân viên", x + w / 2, contentY + contentH / 2, { align: "center" });
        }
      }

      // Footer
      pdf.setFont("NotoSans", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      const today = new Date().toLocaleDateString("vi-VN");
      pdf.text(`Ngày xuất: ${today}`, 15, 290);

      pdf.save(`so-do-to-chuc-${selectedProject?.name || "export"}.pdf`);
      toast.success("Đã xuất PDF thành công!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Lỗi khi xuất PDF!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sơ đồ Tổ chức Dự án
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
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Tên chủ đầu tư" />
            </div>
            <div className="space-y-2">
              <Label>Investor</Label>
              <Input value={investor} onChange={(e) => setInvestor(e.target.value)} placeholder="Tên nhà đầu tư" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={selectedProject?.location || ""} disabled placeholder="Địa điểm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!selectedProjectId}>
                  <Plus className="h-4 w-4 mr-1" /> Thêm vị trí
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm vị trí mới</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tên chức vụ</Label>
                    <Input
                      value={newNodeTitle}
                      onChange={(e) => setNewNodeTitle(e.target.value)}
                      placeholder="VD: HSE MANAGER"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Màu sắc</Label>
                    <Select value={newNodeColor} onValueChange={setNewNodeColor}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">Xanh dương</SelectItem>
                        <SelectItem value="orange">Cam</SelectItem>
                        <SelectItem value="green">Xanh lá</SelectItem>
                        <SelectItem value="purple">Tím</SelectItem>
                        <SelectItem value="red">Đỏ</SelectItem>
                        <SelectItem value="teal">Xanh ngọc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddNode} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Thêm
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!selectedProjectId}>
                  <LayoutTemplate className="h-4 w-4 mr-1" /> Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Áp dụng Template chuẩn</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Template IPC E&C Organization Chart</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Template bao gồm cấu trúc tổ chức tiêu chuẩn với các vị trí:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Board of Directors, Director of Rooftop</li>
                      <li>Project Director, Project Manager</li>
                      <li>HSE Team (Manager, Engineers)</li>
                      <li>Site Managers, Supervisors</li>
                      <li>Legal Manager, DC Team</li>
                      <li>T&C Team, Security Team</li>
                      <li>Store Keeper, Designer, Constructions Team</li>
                    </ul>
                  </div>
                  <div className="flex gap-2 items-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-orange-600 text-sm">⚠️</div>
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      Áp dụng template sẽ thay thế tất cả các node hiện có trên canvas.
                    </p>
                  </div>
                  <Button onClick={applyTemplate} className="w-full">
                    <LayoutTemplate className="h-4 w-4 mr-2" /> Áp dụng Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button size="sm" variant="outline" onClick={handleDeleteNode} disabled={!selectedNodeId}>
              <Trash2 className="h-4 w-4 mr-1" /> Xóa
            </Button>

            <div className="flex-1" />

            <div className="text-xs text-muted-foreground mr-2">
              Kéo từ chấm tròn để tạo kết nối
            </div>

            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(2, z + 0.25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <Button size="sm" onClick={handleSave} disabled={loading || !selectedProjectId}>
              <Save className="h-4 w-4 mr-1" /> {loading ? "Đang lưu..." : "Lưu"}
            </Button>

            <Button size="sm" variant="secondary" onClick={exportToPDF} disabled={nodes.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Xuất PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        {/* Canvas */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0">
            <div
              ref={canvasRef}
              className="relative w-full h-[600px] bg-muted/30 overflow-auto"
              style={{ touchAction: "none", cursor: isPanning ? "grabbing" : "default" }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Large inner container for scrolling */}
              <div className="relative" style={{ width: "3000px", height: "2000px" }}>
                {/* Nodes container */}
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "0 0",
                  }}
                >
                {nodes.map(node => {
                  const colors = colorSchemes[node.color_scheme as keyof typeof colorSchemes] || colorSchemes.blue;
                  const employee = getEmployeeById(node.employee_id);
                  const isSelected = selectedNodeId === node.id;
                  const connectionPoints = getConnectionPoints(node);

                  return (
                    <div
                      key={node.id}
                      className={`absolute select-none group ${
                        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
                      }`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        cursor: dragging === node.id ? "grabbing" : "grab",
                      }}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      {/* Connection points (visible on hover) */}
                      {connectionPoints.map((point, idx) => {
                        const isHovered = hoveredConnectionPoint?.nodeId === node.id && 
                                          hoveredConnectionPoint?.side === point.side;
                        const isStartPoint = connectionStart?.nodeId === node.id && 
                                             connectionStart?.side === point.side;
                        
                        return (
                          <div
                            key={idx}
                            className={`absolute w-4 h-4 rounded-full border-2 cursor-crosshair transition-all duration-200 z-10
                              ${isHovered ? "bg-green-500 border-green-600 scale-125" : 
                                isStartPoint ? "bg-blue-500 border-blue-600 scale-125" :
                                "bg-white border-gray-400 opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:border-blue-500"}`}
                            style={{
                              left: point.x - node.x - 8,
                              top: point.y - node.y - 8,
                            }}
                            onMouseDown={(e) => handleConnectionPointMouseDown(e, point)}
                          >
                            <Circle className="w-full h-full text-transparent" />
                          </div>
                        );
                      })}

                      <div
                        className="rounded-lg overflow-hidden shadow-lg border-2 transition-shadow hover:shadow-xl"
                        style={{ borderColor: colors.border, backgroundColor: colors.bg }}
                      >
                        {/* Header */}
                        <div
                          className="px-3 py-2 text-center text-xs font-bold text-white"
                          style={{ backgroundColor: colors.header }}
                        >
                          {node.position_title}
                        </div>

                        {/* Content */}
                        <div className="p-3 space-y-2 bg-white">
                          {employee ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={employee.employee_card_photo_url || ""} />
                                  <AvatarFallback className="text-xs bg-muted">
                                    {employee.full_name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{employee.full_name}</p>
                                </div>
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{employee.department || "—"}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{employee.phone || "—"}</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-16 text-muted-foreground">
                              <User className="h-5 w-5 mr-2" />
                              <span className="text-xs">Chưa gán nhân viên</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SVG for connections - rendered on top of nodes */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "visible",
                  zIndex: 50,
                }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                  </marker>
                  <marker
                    id="arrowhead-green"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
                  </marker>
                  <marker
                    id="arrowhead-equal"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <circle cx="4" cy="3" r="3" fill="#10b981" />
                  </marker>
                </defs>

                <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
                  {/* Existing connections with bezier curves */}
                  {connections.map(conn => {
                    const sourceNode = nodes.find(n => n.id === conn.sourceId);
                    const targetNode = nodes.find(n => n.id === conn.targetId);
                    if (!sourceNode || !targetNode) return null;

                    const { source, target } = getBestConnectionPoints(sourceNode, targetNode);
                    const path = getBezierPath(source.x, source.y, target.x, target.y, sourceNode, targetNode);

                    return (
                      <g key={conn.id}>
                        <path
                          d={path}
                          fill="none"
                          stroke={conn.connectionType === "hierarchy" ? "#3b82f6" : "#10b981"}
                          strokeWidth={conn.connectionType === "equal" ? 3 : 2.5}
                          strokeDasharray={conn.connectionType === "equal" ? "10,6" : undefined}
                          markerEnd={conn.connectionType === "equal" ? "url(#arrowhead-equal)" : "url(#arrowhead)"}
                          markerStart={conn.connectionType === "equal" ? "url(#arrowhead-equal)" : undefined}
                        />
                        {/* Label for equal connections */}
                        {conn.connectionType === "equal" && (
                          <text
                            x={(source.x + target.x) / 2}
                            y={(source.y + target.y) / 2 - 8}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#10b981"
                            fontWeight="bold"
                          >
                            ⟷
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Connection being drawn */}
                  {isDraggingConnection && connectionStart && connectionEnd && (
                    <path
                      d={getBezierPath(connectionStart.x, connectionStart.y, connectionEnd.x, connectionEnd.y)}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={3}
                      strokeDasharray="8,4"
                      markerEnd="url(#arrowhead-green)"
                      style={{ filter: "drop-shadow(0 0 6px rgba(34, 197, 94, 0.7))" }}
                    />
                  )}
                </g>
              </svg>

              {nodes.length === 0 && selectedProjectId && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nhấn "Thêm vị trí" để bắt đầu tạo sơ đồ</p>
                  </div>
                </div>
              )}

              {!selectedProjectId && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Vui lòng chọn dự án để bắt đầu</p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Properties Panel */}
        {selectedNode && (
          <Card className="w-72 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Thuộc tính
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Tên chức vụ</Label>
                <Input
                  value={selectedNode.position_title}
                  onChange={(e) => handleNodeTitleChange(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Màu sắc</Label>
                <Select value={selectedNode.color_scheme} onValueChange={handleColorChange}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Xanh dương</SelectItem>
                    <SelectItem value="orange">Cam</SelectItem>
                    <SelectItem value="green">Xanh lá</SelectItem>
                    <SelectItem value="purple">Tím</SelectItem>
                    <SelectItem value="red">Đỏ</SelectItem>
                    <SelectItem value="teal">Xanh ngọc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Nhân viên</Label>
                <Select
                  value={selectedNode.employee_id || "__none__"}
                  onValueChange={(v) => handleEmployeeChange(v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Chọn nhân viên..." />
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
              </div>

              {selectedNode.employee_id && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Thông tin nhân viên</Label>
                  {(() => {
                    const emp = getEmployeeById(selectedNode.employee_id);
                    if (!emp) return null;
                    return (
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span>{emp.position || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{emp.department || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{emp.phone || "—"}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Kết nối</Label>
                <div className="mt-2 space-y-1">
                  {connections
                    .filter(c => c.sourceId === selectedNode.id || c.targetId === selectedNode.id)
                    .map(conn => {
                      const otherId = conn.sourceId === selectedNode.id ? conn.targetId : conn.sourceId;
                      const otherNode = nodes.find(n => n.id === otherId);
                      const isSource = conn.sourceId === selectedNode.id;
                      return (
                        <div key={conn.id} className="flex items-center justify-between text-xs py-1 gap-1">
                          <span className={conn.connectionType === "equal" ? "text-green-600" : "text-blue-600"}>
                            {conn.connectionType === "equal" ? "⟷" : (isSource ? "→" : "←")} {otherNode?.position_title || "?"}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => toggleConnectionType(conn.id)}
                              title={conn.connectionType === "hierarchy" ? "Chuyển sang ngang cấp" : "Chuyển sang phân cấp"}
                            >
                              {conn.connectionType === "hierarchy" ? "↓" : "⟷"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => removeConnection(conn.sourceId, conn.targetId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  {connections.filter(c => c.sourceId === selectedNode.id || c.targetId === selectedNode.id).length === 0 && (
                    <p className="text-xs text-muted-foreground">Chưa có kết nối</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Connection Type Selection Dialog */}
      <Dialog open={showConnectionTypeDialog} onOpenChange={setShowConnectionTypeDialog}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Chọn loại kết nối</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              className="w-full justify-start gap-3 h-12"
              variant="outline"
              onClick={() => createConnectionWithType("hierarchy")}
            >
              <div className="w-8 h-0.5 bg-blue-500" />
              <div className="text-left">
                <div className="font-medium">Phân cấp</div>
                <div className="text-xs text-muted-foreground">Quan hệ cấp trên - cấp dưới</div>
              </div>
            </Button>
            <Button
              className="w-full justify-start gap-3 h-12"
              variant="outline"
              onClick={() => createConnectionWithType("equal")}
            >
              <div className="w-8 h-0.5 border-t-2 border-dashed border-green-500" />
              <div className="text-left">
                <div className="font-medium text-green-600">Ngang cấp</div>
                <div className="text-xs text-muted-foreground">Quan hệ đồng cấp, phối hợp</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
