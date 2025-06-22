import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "../auth.service";

export interface JwtPayload {
  sub: number;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    console.log("[JwtStrategy] Initializing with secret:", secret.substring(0, 10) + "...");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    console.log("[JwtStrategy] Validating JWT payload:", payload);
    const user = await this.authService.validateUserById(payload.sub);
    console.log("[JwtStrategy] User found:", user ? "Yes" : "No");
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }
}
