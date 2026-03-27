import { Menu } from "lucide-react";
import React, { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { SidebarProps } from "./sidebar.types";

const SidebarContent = React.lazy(() =>
	import("./sidebar-content").then((module) => ({
		default: module.SidebarContent,
	})),
);

function SidebarLoadingState() {
	return (
		<div className="flex flex-1 flex-col">
			<div className="border-b border-gray-200 px-3 py-3 dark:border-gray-800">
				<div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			</div>
			<div className="flex-1 space-y-3 px-3 py-4">
				<div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/60" />
				<div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/60" />
				<div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/60" />
			</div>
		</div>
	);
}

export function Sidebar(props: SidebarProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="bg-white/90 dark:bg-black/80 hover:bg-white/70 dark:hover:bg-black/60 shadow-sm h-9 w-9"
				>
					<Menu size={18} />
				</Button>
			</SheetTrigger>

			{isOpen && (
				<SheetContent className="p-0 w-[280px] border-l flex flex-col" hideCloseButton>
					<Suspense fallback={<SidebarLoadingState />}>
						<SidebarContent {...props} onCloseMenu={() => setIsOpen(false)} />
					</Suspense>
				</SheetContent>
			)}
		</Sheet>
	);
}
