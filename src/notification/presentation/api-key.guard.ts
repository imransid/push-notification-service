import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The caller's x-api-key against API_KEY, in constant time. A plain !== stops
 * at the first different character, and how long it took says how much of
 * a guess was right. Both are hashed first so the comparison is the same
 * length whatever was sent. No API_KEY refuses everyone.
 */
export function apiKeyMatches(
  presented: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || presented === undefined) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!apiKeyMatches(req.header('x-api-key'), process.env.API_KEY)) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
