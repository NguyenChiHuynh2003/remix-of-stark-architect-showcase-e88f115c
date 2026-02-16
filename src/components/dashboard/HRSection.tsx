import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeList } from "@/components/hr/EmployeeList";
import { UserAccountsManager } from "@/components/hr/UserAccountsManager";
import { EmployeeContractsManager } from "@/components/hr/EmployeeContractsManager";

export const HRSection = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="employees" className="w-full">
        <TabsList>
          <TabsTrigger value="employees">Thông tin nhân viên</TabsTrigger>
          <TabsTrigger value="contracts">Thông tin hợp đồng</TabsTrigger>
          <TabsTrigger value="accounts">Tài khoản</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="space-y-4">
          <EmployeeList />
        </TabsContent>
        <TabsContent value="accounts" className="space-y-4">
          <UserAccountsManager />
        </TabsContent>
        <TabsContent value="contracts" className="space-y-4">
          <EmployeeContractsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
