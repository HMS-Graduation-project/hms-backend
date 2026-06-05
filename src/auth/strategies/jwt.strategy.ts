import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  hospitalId: string | null;
  cityId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  hospitalId: string | null;
  cityId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest: (req: Request) => {
        // 1. Try HttpOnly cookie first
        if (req?.cookies?.hms_access) {
          return req.cookies.hms_access;
        }
        // 2. Fallback to Authorization: Bearer header
        return bearerExtractor(req);
      },
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      hospitalId: payload.hospitalId ?? null,
      cityId: payload.cityId ?? null,
    };
  }
}
