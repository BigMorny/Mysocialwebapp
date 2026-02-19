import type { AuthorizedDevice, Session, Subscription, User, Shop } from "@prisma/client";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
      device?: AuthorizedDevice | null;
      shop?: Shop;
      subscription?: Subscription | null;
    }
  }
}


