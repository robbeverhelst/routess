import { Controller, Post, Get, Body, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { GoogleAuthDto, AuthResponseDto } from "./dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { User } from "../entities/user.entity";
import { ThrottleAuth, ThrottleModerate } from "../common/decorators/throttle.decorator";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @ThrottleAuth() // Stricter rate limiting for authentication
  @Post("google")
  async googleAuth(@Body() googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    return this.authService.googleAuth(googleAuthDto);
  }

  @ThrottleModerate() // Moderate rate limiting for profile access
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Request() req: { user: User }): Promise<User> {
    return this.authService.getProfile(req.user.id);
  }
}
