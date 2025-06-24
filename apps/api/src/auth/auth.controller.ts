import { Controller, Post, Get, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { GoogleAuthDto, AuthResponseDto } from "./dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { User } from "../entities/user.entity";
import { ThrottleAuth, ThrottleModerate } from "../common/decorators/throttle.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: "Google OAuth authentication",
    description: "Authenticates user using Google OAuth2 credential token",
  })
  @ApiBody({ type: GoogleAuthDto })
  @ApiResponse({ status: 200, description: "Authentication successful", type: AuthResponseDto })
  @ApiResponse({ status: 400, description: "Invalid Google credential" })
  @ApiResponse({ status: 401, description: "Authentication failed" })
  @ThrottleAuth() // Stricter rate limiting for authentication
  @Post("google")
  async googleAuth(@Body() googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    return this.authService.googleAuth(googleAuthDto);
  }

  @ApiOperation({
    summary: "Get current user profile",
    description: "Retrieves the profile of the currently authenticated user",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate() // Moderate rate limiting for profile access
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Request() req: { user: User }): Promise<User> {
    return this.authService.getProfile(req.user.id);
  }
}
