import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Request,
	UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ThrottleModerate, ThrottlePublic, ThrottleStrict } from "../common/decorators/throttle.decorator";
import type { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import type { UsersService } from "./users.service";

interface AuthenticatedRequest extends Request {
	user: {
		id: number;
		email: string;
		name: string;
	};
}

@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@ThrottleStrict() // Strict rate limiting for user creation
	@Post()
	async create(@Body() createUserDto: CreateUserDto) {
		return this.usersService.create(createUserDto);
	}

	@ThrottlePublic() // Public endpoint for admin/testing - TODO: Add admin guard in production
	@Get()
	async findAll() {
		// TODO: In production, this should require admin authentication
		return this.usersService.findAll();
	}

	@ThrottleModerate() // Moderate rate limiting for profile access
	@Get("profile")
	@UseGuards(JwtAuthGuard)
	async getProfile(@Request() req: AuthenticatedRequest) {
		return this.usersService.findOne(req.user.id);
	}

	@ThrottlePublic() // Public endpoint for testing - TODO: Add proper authorization in production
	@Get(":id")
	async findOne(@Param("id") id: string) {
		const userId = parseInt(id, 10);
		if (Number.isNaN(userId)) {
			throw new BadRequestException("Invalid user ID");
		}
		// TODO: In production, add proper user authorization checks
		return this.usersService.findOne(userId);
	}

	@ThrottleModerate() // Moderate rate limiting for updates
	@UseGuards(JwtAuthGuard)
	@Put(":id")
	async update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto, @Request() req: AuthenticatedRequest) {
		const userId = parseInt(id, 10);
		if (Number.isNaN(userId)) {
			throw new BadRequestException("Invalid user ID");
		}
		// Users can only update their own profile
		if (userId !== req.user.id) {
			throw new ForbiddenException("Cannot update other users' profiles");
		}
		return this.usersService.update(userId, updateUserDto);
	}

	@ThrottleModerate() // Moderate rate limiting for partial updates
	@Patch(":id")
	@UseGuards(JwtAuthGuard)
	async partialUpdate(
		@Param("id") id: string,
		@Body() updateUserDto: UpdateUserDto,
		@Request() req: AuthenticatedRequest,
	) {
		const userId = parseInt(id, 10);
		if (Number.isNaN(userId)) {
			throw new BadRequestException("Invalid user ID");
		}
		// Users can only update their own profile
		if (userId !== req.user.id) {
			throw new ForbiddenException("Cannot update other users' profiles");
		}
		return this.usersService.update(userId, updateUserDto);
	}

	@ThrottleStrict() // Strict rate limiting for account deletion
	@Delete(":id")
	@UseGuards(JwtAuthGuard)
	async remove(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
		const userId = parseInt(id, 10);
		if (Number.isNaN(userId)) {
			throw new BadRequestException("Invalid user ID");
		}
		// Users can only delete their own account
		if (userId !== req.user.id) {
			throw new ForbiddenException("Cannot delete other users' accounts");
		}
		return this.usersService.remove(userId);
	}
}
