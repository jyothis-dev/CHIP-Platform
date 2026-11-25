-- Staff refresh tokens. Only the SHA-256 hash is stored.
CREATE TABLE "chip"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "chip"."refresh_tokens"("tokenHash");

CREATE INDEX "refresh_tokens_userId_idx" ON "chip"."refresh_tokens"("userId");

ALTER TABLE "chip"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chip"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
