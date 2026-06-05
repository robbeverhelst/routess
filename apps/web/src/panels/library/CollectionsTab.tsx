import type { ApiCollection, ApiRoute } from "@routess/api-client";
import type { RouteVisibility } from "@routess/core";
import { useState } from "react";
import { useCollections, useCreateCollection } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { I, type IconKey } from "../../components/icons";
import { Btn, RDS_COLORS } from "../../components/primitives";
import { RouteThumb } from "./RouteThumb";

const VISIBILITY_ICON: Record<RouteVisibility, IconKey> = { private: "lock", unlisted: "share", public: "globe" };

function CollectionCard({
	collection,
	cover,
	onOpen,
}: {
	collection: ApiCollection;
	cover: ApiRoute | null;
	onOpen: () => void;
}) {
	const t = useT();
	const [hover, setHover] = useState(false);
	const VisIcon = I[VISIBILITY_ICON[collection.visibility]];
	return (
		<button
			type="button"
			onClick={onOpen}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				width: "100%",
				padding: 12,
				borderRadius: 14,
				border: `1px solid ${hover ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
				background: hover ? RDS_COLORS.bgHover : RDS_COLORS.bgPanel,
				cursor: "pointer",
				marginBottom: 8,
				textAlign: "left",
				transition: "background 120ms, border-color 120ms",
			}}
		>
			<div
				style={{
					width: 56,
					height: 56,
					borderRadius: 12,
					background: RDS_COLORS.bgInput,
					border: `1px solid ${RDS_COLORS.border}`,
					flexShrink: 0,
					overflow: "hidden",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: RDS_COLORS.fgSubtle,
				}}
			>
				{cover ? <RouteThumb route={cover} width={56} height={56} /> : <I.folder size={22} />}
			</div>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 4 }}>
				<div
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: RDS_COLORS.fg,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{collection.name}
				</div>
				<div
					className="rds-mono"
					style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: RDS_COLORS.fgSubtle }}
				>
					<VisIcon size={11} />
					<span>
						{collection.routeCount}{" "}
						{collection.routeCount === 1 ? t("library.routeSingular") : t("library.routePlural")}
					</span>
				</div>
			</div>
			<I.chevronR size={16} style={{ color: RDS_COLORS.fgSubtle, flexShrink: 0 }} />
		</button>
	);
}

export function CollectionsTab({
	routes,
	query,
	onOpenCollection,
}: {
	routes: ApiRoute[];
	query: string;
	onOpenCollection: (id: number) => void;
}) {
	const t = useT();
	const { data: collections = [], isLoading } = useCollections();
	const createCollection = useCreateCollection();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");

	const routeById = new Map(routes.map((r) => [r.id, r]));
	const visible = query.trim()
		? collections.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
		: collections;

	const submitCreate = () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setCreating(false);
			return;
		}
		createCollection.mutate(
			{ name: trimmed },
			{
				onSuccess: (collection) => {
					setName("");
					setCreating(false);
					onOpenCollection(collection.id);
				},
			},
		);
	};

	return (
		<div style={{ padding: "10px 14px", overflow: "auto", flex: 1 }}>
			{creating ? (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "10px 12px",
						borderRadius: 14,
						border: `1px dashed ${RDS_COLORS.borderStrong}`,
						marginBottom: 8,
					}}
				>
					<I.folderPlus size={16} style={{ color: RDS_COLORS.fgSubtle, flexShrink: 0 }} />
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submitCreate();
							if (e.key === "Escape") {
								setName("");
								setCreating(false);
							}
						}}
						onBlur={submitCreate}
						// biome-ignore lint/a11y/noAutofocus: input only mounts on explicit create action
						autoFocus
						placeholder={t("library.collections.namePlaceholder")}
						style={{
							flex: 1,
							background: "transparent",
							border: 0,
							outline: "none",
							fontSize: 13.5,
							color: "inherit",
						}}
					/>
				</div>
			) : (
				<Btn
					variant="ghost"
					style={{ width: "100%", marginBottom: 8, justifyContent: "flex-start" }}
					onClick={() => setCreating(true)}
				>
					<I.folderPlus size={14} /> {t("library.collections.new")}
				</Btn>
			)}

			{isLoading && (
				<div style={{ padding: 20, textAlign: "center", fontSize: 13, color: RDS_COLORS.fgSubtle }}>
					{t("library.loading")}
				</div>
			)}
			{!isLoading && visible.length === 0 && (
				<div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: RDS_COLORS.fgSubtle }}>
					{collections.length === 0 ? t("library.collections.empty") : t("library.noMatch")}
				</div>
			)}
			{visible.map((c) => (
				<CollectionCard
					key={c.id}
					collection={c}
					cover={c.routeIds.length > 0 ? (routeById.get(c.routeIds[0]) ?? null) : null}
					onOpen={() => onOpenCollection(c.id)}
				/>
			))}
		</div>
	);
}
