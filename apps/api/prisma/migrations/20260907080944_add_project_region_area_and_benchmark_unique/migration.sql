-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "areaM2" DECIMAL(65,30),
ADD COLUMN     "region" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkStat_region_stageCategory_key" ON "BenchmarkStat"("region", "stageCategory");

