import { z } from "zod";

// CREATE (POST /userPlant)
export const createUserPlantSchema = z.object({
  s3ID: z.string().optional(),
  name: z.string().trim().min(1, "A name must be provided!"),
  notes: z.string(),
});

// UPDATE (PUT /userPlant/:id)
export const updateUserPlantSchema = z.object({
  s3ID: z.string().optional(),
  name: z.string().trim().optional(),
  notes: z.string().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: "Provide at least one field to update",
});

// PARAMS (/:id)
export const paramID = z.object({
  id: z.coerce.string().uuid(),
});

// QUERY (/?searchValue=...)
export const searchSchema = z.object({
  searchValue: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(20),
  offset: z.coerce.number().int().min(0).default(0)
}).refine(
  d => d.searchValue,
  { message: "No search was entered" }
);