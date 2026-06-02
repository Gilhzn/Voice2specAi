import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '@voice2spec/shared-types';

/** Central error handler that returns the shared {@link ApiError} shape. */
export function errorHandler(
  error: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  req.log.error({ err: error }, 'request failed');
  const body: ApiError = {
    error: error.name ?? 'InternalServerError',
    message: statusCode >= 500 ? 'Internal server error' : error.message,
    statusCode,
  };
  void reply.status(statusCode).send(body);
}
