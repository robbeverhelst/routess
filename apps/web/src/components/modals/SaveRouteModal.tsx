import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSaveRoute } from "@/lib/api-queries";
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
import { type Waypoint } from "@/lib/api";
import { t, type SupportedLanguage } from "@/lib/i18n";

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  distance?: number;
  elevation?: number;
  currentLanguage: SupportedLanguage;
  onSuccess?: () => void;
}

export function SaveRouteModal({
  isOpen,
  onClose,
  waypoints,
  distance,
  elevation,
  currentLanguage,
  onSuccess,
}: SaveRouteModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saveRouteMutation = useSaveRoute();

  const handleSave = () => {
    if (!name.trim()) {
      setError(t("saveRoute.error.nameRequired", currentLanguage));
      return;
    }

    setError(null);

    saveRouteMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        waypoints,
        distance: distance || 0,
        elevationGain: elevation || 0,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          onSuccess?.();
          onClose();
        },
        onError: () => {
          setError(t("saveRoute.error.saveFailed", currentLanguage));
        },
      },
    );
  };

  const handleClose = () => {
    if (!saveRouteMutation.isPending) {
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
              disabled={saveRouteMutation.isPending}
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
              disabled={saveRouteMutation.isPending}
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
          <Button variant="outline" onClick={handleClose} disabled={saveRouteMutation.isPending}>
            {t("common.cancel", currentLanguage)}
          </Button>
          <Button onClick={handleSave} disabled={saveRouteMutation.isPending || !name.trim()}>
            {saveRouteMutation.isPending ? (
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
