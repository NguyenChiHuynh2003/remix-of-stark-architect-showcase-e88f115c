import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  employee_card_photos: string[] | null;
  id_card_photos: string[] | null;
  certificate_photos: string[] | null;
  // Legacy single URL fields for backward compatibility
  employee_card_photo_url: string | null;
  id_card_photo_url: string | null;
  certificate_photo_url: string | null;
}

interface EmployeePhotosViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

const PhotoGrid = ({ photos, label }: { photos: string[]; label: string }) => {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="w-12 h-12 mb-2" />
        <p>Chưa có {label.toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((url, index) => (
        <div key={index} className="relative group">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt={`${label} ${index + 1}`}
              className="w-full h-48 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"
            />
          </a>
          <Badge 
            variant="secondary" 
            className="absolute bottom-2 left-2 text-xs"
          >
            {index + 1}/{photos.length}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const getPhotosArray = (
  photosArray: string[] | null, 
  legacyUrl: string | null
): string[] => {
  // First try to use the new array field
  if (photosArray && photosArray.length > 0) {
    return photosArray;
  }
  // Fall back to legacy single URL
  if (legacyUrl) {
    return [legacyUrl];
  }
  return [];
};

export const EmployeePhotosViewer = ({
  open,
  onOpenChange,
  employee,
}: EmployeePhotosViewerProps) => {
  if (!employee) return null;

  const employeeCardPhotos = getPhotosArray(
    employee.employee_card_photos,
    employee.employee_card_photo_url
  );
  const idCardPhotos = getPhotosArray(
    employee.id_card_photos,
    employee.id_card_photo_url
  );
  const certificatePhotos = getPhotosArray(
    employee.certificate_photos,
    employee.certificate_photo_url
  );

  const totalPhotos = employeeCardPhotos.length + idCardPhotos.length + certificatePhotos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ảnh nhân viên - {employee.full_name}
            <Badge variant="outline">{totalPhotos} ảnh</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="id_card" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="id_card" className="flex items-center gap-1">
              CMND/CCCD
              {idCardPhotos.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {idCardPhotos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="employee_card" className="flex items-center gap-1">
              Thẻ NV
              {employeeCardPhotos.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {employeeCardPhotos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificate" className="flex items-center gap-1">
              Bằng cấp
              {certificatePhotos.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {certificatePhotos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="id_card" className="mt-4">
            <PhotoGrid photos={idCardPhotos} label="Ảnh CMND/CCCD" />
          </TabsContent>

          <TabsContent value="employee_card" className="mt-4">
            <PhotoGrid photos={employeeCardPhotos} label="Ảnh thẻ nhân viên" />
          </TabsContent>

          <TabsContent value="certificate" className="mt-4">
            <PhotoGrid photos={certificatePhotos} label="Ảnh bằng cấp" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};