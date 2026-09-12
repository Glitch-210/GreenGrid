import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../lib/ApiError";
import type { RegisterInput, LoginInput } from "@wattshare/shared";

const BCRYPT_ROUNDS = 10;

function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

function toAlias(role: string, seq: number) {
  const label = role === "PROSUMER" ? "Solar-Pro" : role.charAt(0) + role.slice(1).toLowerCase();
  return `${label}-${seq}`;
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict("DUPLICATE_REQUEST", "Email already registered");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const count = await prisma.user.count();
  const displayAlias = toAlias(input.role, count + 100);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role,
      displayAlias,
    },
  });

  return { token: signToken(user), user: sanitize(user) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  return { token: signToken(user), user: sanitize(user) };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  return sanitize(user);
}

function sanitize<T extends { passwordHash: string }>(user: T) {
  const { passwordHash, ...rest } = user;
  return rest;
}
