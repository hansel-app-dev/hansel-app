-- allocation-plan-add-linear REQ-004,010: additive geometry; existing placements remain points.
ALTER TABLE "SignPlacement"
 ADD COLUMN "placementKind" VARCHAR(8) NOT NULL DEFAULT 'point',
 ADD COLUMN "endX" DOUBLE PRECISION,
 ADD COLUMN "endY" DOUBLE PRECISION;
ALTER TABLE "SignPlacement" ADD CONSTRAINT "SignPlacement_geometry_check" CHECK (
 ("placementKind" = 'point' AND "endX" IS NULL AND "endY" IS NULL) OR
 ("placementKind" = 'linear' AND "endX" IS NOT NULL AND "endY" IS NOT NULL
 AND "endX" BETWEEN 0 AND 1 AND "endY" BETWEEN 0 AND 1
 AND ("x" <> "endX" OR "y" <> "endY"))
);
