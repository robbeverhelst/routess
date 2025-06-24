import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUserRoutes, useDeleteRoute } from "@/lib/api-queries";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Library,
  Search,
  Calendar,
  Route,
  MoreVertical,
  Play,
  Trash2,
  Edit,
  Loader2,
} from "lucide-react";
import { type ApiRoute } from "@/lib/api";
import { t, type SupportedLanguage } from "@/lib/i18n";

interface RouteLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: SupportedLanguage;
  onLoadRoute: (route: ApiRoute) => void;
  onEditRoute?: (route: ApiRoute) => void;
}

export function RouteLibraryModal({
  isOpen,
  onClose,
  currentLanguage,
  onLoadRoute,
  onEditRoute,
}: RouteLibraryModalProps) {
  const [filteredRoutes, setFilteredRoutes] = useState<ApiRoute[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: routes = [], isLoading, error: queryError, refetch } = useUserRoutes();
  const deleteRouteMutation = useDeleteRoute();

  // Update filtered routes when routes data or search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = routes.filter(
        (route) =>
          route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          route.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredRoutes(filtered);
    } else {
      setFilteredRoutes(routes);
    }
  }, [searchQuery, routes]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      setError(t("routeLibrary.error.loadFailed", currentLanguage));
    } else {
      setError(null);
    }
  }, [queryError, currentLanguage]);

  const handleDeleteRoute = (routeId: number) => {
    deleteRouteMutation.mutate(routeId, {
      onError: () => {
        setError(t("routeLibrary.error.deleteFailed", currentLanguage));
      },
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(currentLanguage, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return "";
    return `${distance.toFixed(1)} km`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library size={20} />
            {t("routeLibrary.title", currentLanguage)}
          </DialogTitle>
          <DialogDescription>{t("routeLibrary.description", currentLanguage)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              placeholder={t("routeLibrary.searchPlaceholder", currentLanguage)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Routes List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <Button variant="outline" onClick={() => refetch()} className="mt-2">
                  {t("common.retry", currentLanguage)}
                </Button>
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="text-center py-8">
                <Library className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? t("routeLibrary.noResults", currentLanguage)
                    : t("routeLibrary.noRoutes", currentLanguage)}
                </p>
              </div>
            ) : (
              filteredRoutes.map((route) => (
                <div
                  key={route.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium truncate">{route.name}</h3>
                        {route.distance && (
                          <Badge variant="secondary" className="text-xs">
                            <Route size={12} className="mr-1" />
                            {formatDistance(route.distance)}
                          </Badge>
                        )}
                      </div>

                      {route.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {route.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(route.createdAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Route size={12} />
                          {route.waypoints.length} {t("routeLibrary.waypoints", currentLanguage)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => {
                          onLoadRoute(route);
                          onClose();
                        }}
                        className="h-8"
                      >
                        <Play size={12} className="mr-1" />
                        {t("routeLibrary.load", currentLanguage)}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical size={12} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEditRoute && (
                            <DropdownMenuItem onClick={() => onEditRoute(route)}>
                              <Edit size={12} className="mr-2" />
                              {t("common.edit", currentLanguage)}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteRoute(route.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 size={12} className="mr-2" />
                            {t("common.delete", currentLanguage)}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
