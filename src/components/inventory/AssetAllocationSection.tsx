import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, FileOutput, Info } from "lucide-react";
import { AssetAllocationList } from "./AssetAllocationList";
import { GINList } from "./GINList";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AssetAllocationSection() {
  const [activeTab, setActiveTab] = useState("allocation");

  return (
    <div className="space-y-4">
      <Alert className="bg-muted/50 border-muted-foreground/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Phân bổ</strong> áp dụng cho <span className="text-blue-600 font-medium">Thiết bị</span> và <span className="text-green-600 font-medium">Công cụ dụng cụ</span> (có hoàn trả). 
          <strong className="ml-2">Xuất kho</strong> áp dụng cho <span className="text-orange-600 font-medium">Vật tư</span> (có thể hoàn trả).
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="allocation" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Phân Bổ (TB & CC)
          </TabsTrigger>
          <TabsTrigger value="gin" className="flex items-center gap-2">
            <FileOutput className="h-4 w-4" />
            Xuất Kho (Vật tư)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="mt-4">
          <AssetAllocationList />
        </TabsContent>

        <TabsContent value="gin" className="mt-4">
          <GINList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
