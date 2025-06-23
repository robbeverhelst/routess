import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Put,
  Patch,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return this.usersService.findOne(req.user.id);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      throw new BadRequestException("Invalid user ID");
    }
    return this.usersService.findOne(userId);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async partialUpdate(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      throw new BadRequestException("Invalid user ID");
    }
    // Users can only update their own profile
    if (userId !== req.user.id) {
      throw new ForbiddenException("Cannot update other users' profiles");
    }
    return this.usersService.update(userId, updateUserDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string, @Request() req: any) {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      throw new BadRequestException("Invalid user ID");
    }
    // Users can only delete their own account
    if (userId !== req.user.id) {
      throw new ForbiddenException("Cannot delete other users' accounts");
    }
    return this.usersService.remove(userId);
  }
}
