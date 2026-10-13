import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Collection } from "../entities/collection.entity";
import { CollectionRoute } from "../entities/collection-route.entity";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
	imports: [MikroOrmModule.forFeature([Collection, CollectionRoute, Route, User]), EntitlementsModule],
	controllers: [CollectionsController],
	providers: [CollectionsService],
})
export class CollectionsModule {}
