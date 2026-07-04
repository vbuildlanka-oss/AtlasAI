import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async Express handler so rejected promises are forwarded to the error
 * middleware instead of crashing the process. Express 4 does not await handlers,
 * so any unhandled rejection (e.g. the database being unreachable) would
 * otherwise take down the whole server.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
