import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository, EntityManager } from "@mikro-orm/core";
import { User } from "../entities/user.entity";
import { GoogleAuthDto, AuthResponseDto } from "./dto";
import { JwtPayload } from "./strategies/jwt.strategy";
import { MetricsService } from "../telemetry/metrics.service";

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @InjectRepository(User)
    private userRepository: EntityRepository<User>,
    private entityManager: EntityManager,
    private jwtService: JwtService,
    private metricsService: MetricsService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    try {
      console.log("Google Auth - Received credential:", !!googleAuthDto.credential);
      console.log("Google Auth - Client ID configured:", !!process.env.GOOGLE_CLIENT_ID);

      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleAuthDto.credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        console.log("Google Auth - No payload from token");
        throw new UnauthorizedException("Invalid Google token");
      }

      console.log("Google Auth - Token verified successfully");

      const { sub: googleId, email, name, picture } = payload;

      if (!email) {
        throw new UnauthorizedException("Email not provided by Google");
      }

      let user = await this.userRepository.findOne({
        $or: [{ googleId }, { email }],
        deletedAt: null,
      });

      if (!user) {
        user = this.userRepository.create({
          email,
          name: name || email,
          googleId,
          avatar: picture,
          isEmailVerified: true,
        });
        await this.entityManager.persistAndFlush(user);

        // Record new user registration metric
        this.metricsService.recordUserRegistration("google");
      } else {
        if (!user.googleId) {
          user.googleId = googleId;
          user.avatar = picture;
          user.isEmailVerified = true;
          await this.entityManager.persistAndFlush(user);
        }
      }

      const jwtPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
      };

      console.log("Google Auth - About to return success response");

      // Increment active users
      this.metricsService.incrementActiveUsers();

      return {
        accessToken: this.jwtService.sign(jwtPayload),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
        },
      };
    } catch (error) {
      console.log("Google Auth - Error occurred:", error.message);
      throw new UnauthorizedException("Failed to authenticate with Google");
    }
  }

  async validateUserById(userId: number): Promise<User | null> {
    return this.userRepository.findOne({ id: userId, deletedAt: null });
  }

  async getProfile(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ id: userId, deletedAt: null });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }
}
