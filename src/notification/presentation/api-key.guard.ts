import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.API_KEY;
    if (!expected || req.header('x-api-key') !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
