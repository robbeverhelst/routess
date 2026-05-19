import { MikroOrmModule } from "@mikro-orm/nestjs";
import { type DynamicModule, Logger, Module, type OnModuleInit } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "../config/config.module";
import { User } from "../entities/user.entity";
import { UserAuthMethod } from "../entities/user-auth-method.entity";
import { TestLoginController } from "./test-login.controller";

const TEST_DB_NAME_PATTERN = /(_e2e|_test)$/;

@Module({})
export class TestSupportModule implements OnModuleInit {
	static forRootIfSafe(): DynamicModule {
		if (process.env.NODE_ENV === "production") {
			throw new Error("TestSupportModule cannot be loaded in production");
		}
		if (!process.env.E2E_TEST_LOGIN_SECRET) {
			throw new Error("TestSupportModule requires E2E_TEST_LOGIN_SECRET to be set");
		}
		const dbName = process.env.DB_NAME ?? "";
		if (!TEST_DB_NAME_PATTERN.test(dbName)) {
			throw new Error(`TestSupportModule refuses to load against DB '${dbName}' (name must end in _e2e or _test)`);
		}
		return {
			module: TestSupportModule,
			imports: [ConfigModule, AuthModule, MikroOrmModule.forFeature([User, UserAuthMethod])],
			controllers: [TestLoginController],
		};
	}

	onModuleInit() {
		Logger.warn(
			"TestSupportModule loaded — POST /test/login is exposed. Must not run in production.",
			"TestSupportModule",
		);
	}
}
