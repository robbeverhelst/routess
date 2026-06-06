import { EntityManager, EntityRepository, wrap } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Collection } from "../entities/collection.entity";
import { CollectionRoute } from "../entities/collection-route.entity";
import { Route } from "../entities/route.entity";
import type { User } from "../entities/user.entity";
import { toRouteResponseDto } from "../routes/route.mapper";
import { toPublicUserDto } from "../users/user.mapper";
import type { CollectionDetailResponseDto, CollectionResponseDto } from "./dto/collection-response.dto";
import type { CreateCollectionDto } from "./dto/create-collection.dto";
import type { SetCollectionRoutesDto } from "./dto/set-collection-routes.dto";
import type { UpdateCollectionDto } from "./dto/update-collection.dto";

@Injectable()
export class CollectionsService {
	constructor(
		@InjectRepository(Collection)
		private readonly collectionRepository: EntityRepository<Collection>,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		private readonly em: EntityManager,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	// Pivot rows ordered by position; non-owners never see private routes,
	// even inside a public collection.
	private visibleRoutes(collection: Collection, isOwner: boolean): Route[] {
		const ordered = collection.routes
			.getItems()
			.sort((a, b) => a.position - b.position)
			.map((cr) => cr.route);
		return isOwner ? ordered : ordered.filter((r) => r.visibility !== "private");
	}

	private toResponseDto(collection: Collection, isOwner: boolean): CollectionResponseDto {
		const routes = this.visibleRoutes(collection, isOwner);
		const owner = wrap(collection.user).toJSON() as User;
		return {
			id: collection.id,
			name: collection.name,
			description: collection.description,
			visibility: collection.visibility,
			routeIds: routes.map((r) => r.id),
			routeCount: routes.length,
			shareToken: collection.shareToken,
			user: toPublicUserDto(owner, this.config.analytics.salt),
			createdAt: collection.createdAt.toISOString(),
			updatedAt: collection.updatedAt.toISOString(),
		};
	}

	private toDetailResponseDto(collection: Collection, isOwner: boolean): CollectionDetailResponseDto {
		const routes = this.visibleRoutes(collection, isOwner);
		return {
			...this.toResponseDto(collection, isOwner),
			routes: routes.map((r) => toRouteResponseDto(r, this.config.analytics.salt)),
		};
	}

	async findAll(userId: number): Promise<CollectionResponseDto[]> {
		const collections = await this.collectionRepository.find(
			{ user: userId },
			{ populate: ["user", "routes", "routes.route"], orderBy: { createdAt: "DESC" } },
		);
		return collections.map((c) => this.toResponseDto(c, true));
	}

	async create(dto: CreateCollectionDto, userId: number): Promise<CollectionResponseDto> {
		const collection = this.collectionRepository.create({
			name: dto.name,
			description: dto.description,
			visibility: dto.visibility ?? "private",
			user: userId,
		});
		await this.em.persistAndFlush(collection);
		await this.em.populate(collection, ["user"]);
		return this.toResponseDto(collection, true);
	}

	// Same visibility semantics as routes: ids serve owners and public
	// collections only (unlisted would be enumerable via sequential ids);
	// unlisted access goes through findOneByShareToken. 404, never 403, to
	// avoid leaking existence.
	async findOne(id: number, viewerId: number | null): Promise<CollectionDetailResponseDto> {
		const collection = await this.collectionRepository.findOne(
			{ id },
			{ populate: ["user", "routes", "routes.route", "routes.route.user"] },
		);
		if (!collection) {
			throw new NotFoundException(`Collection with ID ${id} not found`);
		}
		const isOwner = viewerId !== null && collection.user.id === viewerId;
		if (!isOwner && collection.visibility !== "public") {
			throw new NotFoundException(`Collection with ID ${id} not found`);
		}
		return this.toDetailResponseDto(collection, isOwner);
	}

	// Share-link lookup: serves public and unlisted collections to anyone
	// holding the unguessable token; private 404s even with the token.
	async findOneByShareToken(shareToken: string, viewerId: number | null): Promise<CollectionDetailResponseDto> {
		const collection = await this.collectionRepository.findOne(
			{ shareToken },
			{ populate: ["user", "routes", "routes.route", "routes.route.user"] },
		);
		if (!collection || collection.visibility === "private") {
			throw new NotFoundException("Collection not found");
		}
		const isOwner = viewerId !== null && collection.user.id === viewerId;
		return this.toDetailResponseDto(collection, isOwner);
	}

	async update(id: number, dto: UpdateCollectionDto, userId: number): Promise<CollectionResponseDto> {
		const collection = await this.findOwnedOrFail(id, userId);
		this.collectionRepository.assign(collection, dto);
		await this.em.persistAndFlush(collection);
		return this.toResponseDto(collection, true);
	}

	async remove(id: number, userId: number): Promise<void> {
		const collection = await this.findOwnedOrFail(id, userId);
		collection.deletedAt = new Date();
		await this.em.persistAndFlush(collection);
	}

	// Replaces the full membership; the array order defines positions. All
	// referenced routes must exist and belong to the caller.
	async setRoutes(id: number, dto: SetCollectionRoutesDto, userId: number): Promise<CollectionDetailResponseDto> {
		const uniqueIds = new Set(dto.routeIds);
		if (uniqueIds.size !== dto.routeIds.length) {
			throw new BadRequestException("routeIds must not contain duplicates");
		}
		const collection = await this.findOwnedOrFail(id, userId);
		const owned = await this.routeRepository.find({ id: { $in: dto.routeIds }, user: userId });
		if (owned.length !== uniqueIds.size) {
			throw new BadRequestException("routeIds must reference your own routes");
		}
		// Diff in place rather than remove-all + re-add: recreating a pivot row
		// for a kept route would insert before the orphan delete flushes and
		// trip the (collection, route) unique constraint.
		const existingByRouteId = new Map(collection.routes.getItems().map((cr) => [cr.route.id, cr]));
		const keep = new Set(dto.routeIds);
		for (const cr of collection.routes.getItems()) {
			if (!keep.has(cr.route.id)) collection.routes.remove(cr);
		}
		dto.routeIds.forEach((routeId, index) => {
			const existing = existingByRouteId.get(routeId);
			if (existing) {
				existing.position = index;
			} else {
				collection.routes.add(this.em.create(CollectionRoute, { collection, route: routeId, position: index }));
			}
		});
		await this.em.persistAndFlush(collection);
		await this.em.populate(collection, ["routes.route.user"]);
		return this.toDetailResponseDto(collection, true);
	}

	private async findOwnedOrFail(id: number, userId: number): Promise<Collection> {
		const collection = await this.collectionRepository.findOne(
			{ id, user: userId },
			{ populate: ["user", "routes", "routes.route"] },
		);
		if (!collection) {
			throw new NotFoundException(`Collection with ID ${id} not found`);
		}
		return collection;
	}
}
