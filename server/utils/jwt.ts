import { SignJWT, jwtVerify } from 'jose'

const encoder = new TextEncoder()

export interface JwtPayload {
  userId: number
}

export async function signToken(userId: number, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(encoder.encode(secret))
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, encoder.encode(secret))
  const userId = Number(payload.sub)
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('invalid token subject')
  }
  return { userId }
}
