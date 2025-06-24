import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logger } from "@/lib/logger";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Loader2 } from "lucide-react";
import { apiService, type Waypoint } from "@/lib/api";
import { t, type SupportedLanguage } from "@/lib/i18n";

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  distance?: number;
  currentLanguage: SupportedLanguage;
  onSuccess?: () => void;
}

export function SaveRouteModal({
  isOpen,
  onClose,
  waypoints,
  distance,
  currentLanguage,
  onSuccess,
}: SaveRouteModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("saveRoute.error.nameRequired", currentLanguage));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiService.createRoute({
        name: name.trim(),
        description: description.trim() || undefined,
        waypoints,
        distance,
      });

      setName("");
      setDescription("");
      onSuccess?.();
      onClose();
    } catch (err) {
      Logger.error("Failed to save route:", err);
      setError(t("saveRoute.error.saveFailed", currentLanguage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName("");
      setDescription("");
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save size={20} />
            {t("saveRoute.title", currentLanguage)}
          </DialogTitle>
          <DialogDescription>{t("saveRoute.description", currentLanguage)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="route-name">{t("saveRoute.fields.name", currentLanguage)} *</Label>
            <Input
              id="route-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("saveRoute.placeholders.name", currentLanguage)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="route-description">
              {t("saveRoute.fields.description", currentLanguage)}
            </Label>
            <Textarea
              id="route-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("saveRoute.placeholders.description", currentLanguage)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {distance && (
            <div className="text-sm text-muted-foreground">
              {t("saveRoute.info.distance", currentLanguage, {
                distance: distance.toFixed(1),
              })}
            </div>
          )}

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t("common.cancel", currentLanguage)}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("saveRoute.saving", currentLanguage)}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t("saveRoute.save", currentLanguage)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
