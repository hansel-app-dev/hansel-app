DROP INDEX "Activity_siteId_createdAt_id_idx";
CREATE INDEX "Activity_siteId_createdAt_id_idx" ON "Activity"("siteId", "createdAt" DESC, "id" DESC);
