import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { RoutesService } from "./routes.service";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    name: string;
  };
}

@Controller("routes")
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  create(@Body() createRouteDto: CreateRouteDto, @Request() req: AuthenticatedRequest) {
    console.log("[RoutesController] Create route - User:", req.user);
    return this.routesService.create(createRouteDto, req.user.id);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.routesService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.routesService.findOne(id, req.user.id);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRouteDto: UpdateRouteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.routesService.update(id, updateRouteDto, req.user.id);
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    await this.routesService.remove(id, req.user.id);
    return { success: true, message: "Route deleted successfully" };
  }
}
