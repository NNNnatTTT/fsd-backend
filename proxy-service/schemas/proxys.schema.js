import { z } from "zod";

// CREATE (POST /proxy)
export const createSchema = z.object({
  name: z.string().trim().min(1, "A name must be provided!"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  phoneNumber: z.string() // Format: + | country code | digits (10–15 digits)
    .trim()
    .optional(),
});

// UPDATE (PUT /proxy/:id)
export const updateSchema = z.object({
  name: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  phoneNumber: z.string() // Format: + | country code | digits (10–15 digits)
    .trim()
    .optional(),
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