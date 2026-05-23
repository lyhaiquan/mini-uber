import { Role } from "../../users/dto/role.enum";

export enum ActorType {
  CUSTOMER = "CUSTOMER",
  DRIVER = "DRIVER",
  ADMIN = "ADMIN",
  SYSTEM = "SYSTEM"
}

export const ALL_ACTOR_TYPES: readonly ActorType[] = [
  ActorType.CUSTOMER,
  ActorType.DRIVER,
  ActorType.ADMIN,
  ActorType.SYSTEM
];

export interface TransitionActor {
  type: ActorType;
  userId: string | null;
}

export function actorFromRole(role: Role, userId: string): TransitionActor {
  switch (role) {
    case Role.CUSTOMER:
      return { type: ActorType.CUSTOMER, userId };
    case Role.DRIVER:
      return { type: ActorType.DRIVER, userId };
    case Role.ADMIN:
      return { type: ActorType.ADMIN, userId };
    default:
      throw new Error(`Unknown role: ${role as string}`);
  }
}

export function systemActor(): TransitionActor {
  return { type: ActorType.SYSTEM, userId: null };
}
