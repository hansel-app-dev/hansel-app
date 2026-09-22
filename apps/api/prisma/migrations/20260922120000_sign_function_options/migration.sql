-- sign-function-options REQ-004: preserve every other Sign attribute and timestamp.
UPDATE "Sign" SET "function" = 'Directional' WHERE "function" = 'Wayfinder';
ALTER TABLE "Sign" ALTER COLUMN "function" SET DEFAULT 'Directional';
