import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (e) {
    console.log(e);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// (TEST ONLY)
export function requireAuthTEST(req, _res, next) {
  req.user = {id : "24988448-20a1-7025-59a4-e27cbfdd22ef", role: "gardener"};
  next();
}

