import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // e.g. payload = { id: "...", role: "admin" }
    // req.user = payload;
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
  // req.user.id = req.user.sub;
  // req.user = { id: "11111111-1111-1111-1111-111111111111", role: "gardener" };
  req.user = {id : "24988448-20a1-7025-59a4-e27cbfdd22ef", role: "gardener"};
  next();
}

