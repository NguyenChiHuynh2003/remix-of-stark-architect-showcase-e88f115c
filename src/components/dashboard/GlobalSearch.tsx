import { useState, useEffect, useRef } from "react";
import { Search, FolderKanban, CheckSquare, Users, Package, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface GlobalSearchProps {
  onNavigate: (section: string, itemId?: string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "project" | "task" | "employee" | "inventory" | "contract";
  section: string; // The section this result belongs to
}

// Escape SQL ILIKE special characters to prevent injection
function escapeILikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/%/g, '\\%')    // Escape percent
    .replace(/_/g, '\\_');   // Escape underscore
}

export const GlobalSearch = ({ onNavigate }: GlobalSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { hasAccess, isAdmin } = useUserRole();

  const typeConfig = {
    project: { icon: FolderKanban, label: "Dự án", color: "text-blue-500", section: "projects" },
    task: { icon: CheckSquare, label: "Nhiệm vụ", color: "text-green-500", section: "tasks" },
    employee: { icon: Users, label: "Nhân sự", color: "text-purple-500", section: "hr" },
    inventory: { icon: Package, label: "Kho", color: "text-orange-500", section: "inventory" },
    contract: { icon: FileText, label: "Hợp đồng", color: "text-cyan-500", section: "accounting" },
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchDebounce = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch(searchTerm.trim());
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounce);
  }, [searchTerm]);

  const performSearch = async (term: string) => {
    setLoading(true);
    setShowResults(true);

    try {
      const searchResults: SearchResult[] = [];
      
      // Escape special SQL ILIKE characters to prevent injection
      const safeTerm = escapeILikePattern(term);

      // Only search in modules user has access to
      const canSearchProjects = hasAccess("projects");
      const canSearchTasks = hasAccess("tasks") || hasAccess("task-dashboard");
      const canSearchHR = hasAccess("hr");
      const canSearchInventory = hasAccess("inventory");
      const canSearchAccounting = hasAccess("accounting");

      // Build promises array based on permissions
      // Define search queries based on permissions
      type SearchQuery = {
        type: string;
        promise: ReturnType<typeof supabase.from>;
      };
      
      const queries: SearchQuery[] = [];

      if (canSearchProjects) {
        queries.push({
          type: "projects",
          promise: supabase
            .from("projects")
            .select("id, name, location")
            .or(`name.ilike.%${safeTerm}%,location.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`)
            .limit(5) as any,
        });
      }

      if (canSearchTasks) {
        queries.push({
          type: "tasks",
          promise: supabase
            .from("tasks")
            .select("id, title, description")
            .or(`title.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`)
            .limit(5) as any,
        });
      }

      if (canSearchHR) {
        queries.push({
          type: "employees",
          promise: supabase
            .from("employees")
            .select("id, full_name, position, department")
            .or(`full_name.ilike.%${safeTerm}%,position.ilike.%${safeTerm}%,department.ilike.%${safeTerm}%`)
            .limit(5) as any,
        });
      }

      if (canSearchInventory) {
        queries.push({
          type: "inventory",
          promise: supabase
            .from("inventory_items")
            .select("id, product_name, product_code")
            .or(`product_name.ilike.%${safeTerm}%,product_code.ilike.%${safeTerm}%`)
            .limit(5) as any,
        });
        
        queries.push({
          type: "assets",
          promise: supabase
            .from("asset_master_data")
            .select("id, asset_id, asset_name, sku")
            .or(`asset_name.ilike.%${safeTerm}%,asset_id.ilike.%${safeTerm}%,sku.ilike.%${safeTerm}%`)
            .limit(5) as any,
        });
      }

      if (canSearchAccounting) {
        queries.push({
          type: "contracts",
          promise: supabase
            .from("contracts")
            .select("id, contract_number, client_name")
            .or(`contract_number.ilike.%${safeTerm}%,client_name.ilike.%${safeTerm}%`)
            .limit(5) as any,
        });
      }

      const responses = await Promise.all(queries.map(q => q.promise));

      // Process results based on query types
      responses.forEach((response, idx) => {
        const type = queries[idx].type;
        
        if (response.error) {
          console.error(`${type} search error:`, response.error);
          return;
        }

        if (response.data) {
          response.data.forEach((item: any) => {
            if (type === "projects") {
              searchResults.push({
                id: item.id,
                title: item.name,
                subtitle: item.location || undefined,
                type: "project",
                section: "projects",
              });
            } else if (type === "tasks") {
              searchResults.push({
                id: item.id,
                title: item.title,
                subtitle: item.description || undefined,
                type: "task",
                section: "tasks",
              });
            } else if (type === "employees") {
              searchResults.push({
                id: item.id,
                title: item.full_name,
                subtitle: [item.position, item.department].filter(Boolean).join(" - ") || undefined,
                type: "employee",
                section: "hr",
              });
            } else if (type === "inventory") {
              searchResults.push({
                id: item.id,
                title: item.product_name,
                subtitle: item.product_code,
                type: "inventory",
                section: "inventory",
              });
            } else if (type === "assets") {
              searchResults.push({
                id: item.id,
                title: item.asset_name,
                subtitle: `${item.asset_id} - ${item.sku}`,
                type: "inventory",
                section: "inventory",
              });
            } else if (type === "contracts") {
              searchResults.push({
                id: item.id,
                title: item.contract_number,
                subtitle: item.client_name,
                type: "contract",
                section: "accounting",
              });
            }
          });
        }
      });

      console.log("Search results for term:", term, "in allowed modules:", queries.map(q => q.type), searchResults);
      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    const sectionMap: Record<string, string> = {
      project: "projects",
      task: "tasks",
      employee: "hr",
      inventory: "inventory",
      contract: "accounting",
    };
    
    onNavigate(sectionMap[result.type], result.id);
    setShowResults(false);
    setSearchTerm("");
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Tìm kiếm dự án, nhiệm vụ, nhân sự, kho..."
        className="pl-10 w-full"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setShowResults(true);
        }}
      />

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Đang tìm kiếm...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Không tìm thấy kết quả cho "{searchTerm}"
            </div>
          ) : (
            <div className="py-2">
              {results.map((result) => {
                const config = typeConfig[result.type];
                const Icon = config.icon;

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className={cn("p-2 rounded-lg bg-muted", config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {result.title}
                      </p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
