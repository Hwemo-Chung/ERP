import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext): JwtPayload[keyof JwtPayload] | JwtPayload | undefined => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
