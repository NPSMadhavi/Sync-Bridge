-- Add nationality enum type
CREATE TYPE "nationality" AS ENUM ('singaporean_pr', 'foreigner');

-- Add new columns to employees table
ALTER TABLE "employees" ADD COLUMN "nationality" "nationality";
ALTER TABLE "employees" ADD COLUMN "nric_number" text;
ALTER TABLE "employees" ADD COLUMN "fin_number" text; 