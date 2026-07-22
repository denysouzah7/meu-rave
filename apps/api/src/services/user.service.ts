import { and, count, eq, ne } from "drizzle-orm";
import { db } from "../database/client.js";
import { administrators, roomParticipants, users, type User } from "../database/schema.js";
import { forbidden, notFound } from "../utils/http.js";
import { now } from "../utils/dates.js";

export function getUserById(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function listUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      isBlocked: users.isBlocked,
      blockedReason: users.blockedReason,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(users.createdAt)
    .all();
}

export function ensureFirstAdmin(userId: string) {
  const admin = db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1).get();
  if (admin) {
    return;
  }

  const timestamp = now();
  db.update(users)
    .set({ role: "admin", updatedAt: timestamp })
    .where(eq(users.id, userId))
    .run();
  db.insert(administrators)
    .values({ userId, grantedByUserId: null, createdAt: timestamp })
    .onConflictDoNothing()
    .run();
}

export function updateProfile(
  userId: string,
  input: {
    name?: string | undefined;
    image?: string | null | undefined;
    profileTheme?: string | null | undefined;
  }
) {
  const timestamp = now();
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: timestamp };

  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.image !== undefined) {
    patch.image = input.image;
  }
  if (input.profileTheme !== undefined) {
    patch.profileTheme = input.profileTheme;
  }

  const updated = db.update(users).set(patch).where(eq(users.id, userId)).returning().get();
  if (!updated) {
    throw notFound("Usuario nao encontrado");
  }
  return updated;
}

export function setUserRole(targetUserId: string, role: "admin" | "participant", actorId: string) {
  const target = getUserById(targetUserId);
  if (!target) {
    throw notFound("Usuario nao encontrado");
  }

  if (target.role === "admin" && role === "participant") {
    const row = db
      .select({ value: count() })
      .from(users)
      .where(eq(users.role, "admin"))
      .get();
    if ((row?.value ?? 0) <= 1) {
      throw forbidden("Mantenha pelo menos um administrador ativo");
    }
  }

  const timestamp = now();
  const updated = db
    .update(users)
    .set({ role, updatedAt: timestamp })
    .where(eq(users.id, targetUserId))
    .returning()
    .get();

  if (role === "admin") {
    db.insert(administrators)
      .values({ userId: targetUserId, grantedByUserId: actorId, createdAt: timestamp })
      .onConflictDoUpdate({
        target: administrators.userId,
        set: { grantedByUserId: actorId, createdAt: timestamp }
      })
      .run();
  } else {
    db.delete(administrators).where(eq(administrators.userId, targetUserId)).run();
  }

  return updated;
}

export function blockUser(userId: string, isBlocked: boolean, blockedReason?: string) {
  const updated = db
    .update(users)
    .set({ isBlocked, blockedReason: isBlocked ? blockedReason ?? "Bloqueado pelo admin" : null, updatedAt: now() })
    .where(eq(users.id, userId))
    .returning()
    .get();
  if (!updated) {
    throw notFound("Usuario nao encontrado");
  }
  return updated;
}

export function removeUser(targetUserId: string, actorId: string) {
  if (targetUserId === actorId) {
    throw forbidden("Voce nao pode remover a si mesmo");
  }

  const target = getUserById(targetUserId);
  if (!target) {
    throw notFound("Usuario nao encontrado");
  }

  if (target.role === "admin") {
    const row = db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, targetUserId)))
      .get();
    if ((row?.value ?? 0) < 1) {
      throw forbidden("Mantenha pelo menos um administrador ativo");
    }
  }

  db.delete(roomParticipants).where(eq(roomParticipants.userId, targetUserId)).run();
  db.delete(users).where(eq(users.id, targetUserId)).run();
  return { ok: true };
}
