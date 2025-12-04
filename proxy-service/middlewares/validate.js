export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ValidationError", details: parsed.error.issues });
  }
  req.validated = parsed.data;
  next();
};

export const validateParams = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "ValidationError", details: parsed.error.issues });
  }
  req.validatedParams = parsed.data;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "ValidationError", details: parsed.error.issues });
  }
  req.validatedQuery = parsed.data;
  next();
};