import { Router } from "express";
import * as reminderTX from "../db/tx.js"
import { validate, validateParams, validateQuery } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/auth.js";
import * as schema from "../schemas/reminders.schema.js";

const router = Router();

// router.post ("/v1/reminder", requireAuth, validate(schema.createReminderSchema), async(req, res, next) => {
router.post ("/v1/reminder/create", requireAuth, validate(schema.createReminderSchema), async(req, res, next) => {
  try {
      const userID = await req.user?.id;

      if (!userID) {
        return res.status(403).json({ error: "Forbidden", message: "Missing userID" });
      }

      const reminderID = await reminderTX.createReminder({
        ...req.validated, 
        userID,
      });

      return res.status(201).json({ reminderID });
    } catch (e) {
      next(e)
    }
});

router.get ("/v1/reminder/:id", requireAuth, validateParams(schema.paramID), async(req, res, next) => {
  try {
      const userID = await req.user?.id;
      const id = await req.validatedParams.id;

      if (!userID) {
        return res.status(403).json({ error: "Forbidden", message: "Missing userID" });
      }

      const client = await reminderTX.getReminderByID({
        userID, 
        id,
      });

      if (!client) return res.status(404).json({ error: "NotFound" });
      return res.status(201).json({ client });
    } catch (e) {
      next(e)
    }
});

router.get ("/v1/reminders", requireAuth, async(req, res, next) => {
  try {
      const userID = await req.user?.id;

      if (!userID) {
        return res.status(403).json({ error: "Forbidden", message: "Missing userID" });
      }

      const clients = await reminderTX.getRemindersByUserID({
        userID,
      });

      if (!clients || clients.length === 0) return res.status(404).json({ error: "NotFound" });
      return res.status(201).json({ clients });
    } catch (e) {
      next(e)
    }
});

// Scheduler-only endpoint: Get reminders due soon
router.get("/v1/reminders/due", async (req, res, next) => {
  try {
      const raw = req.query.windowSec;
      const windowSec = Number.isFinite(+raw) && +raw > 0 ? +raw : 60; // default 60s

      console.log("➡️ /reminders/due windowSec:", windowSec);

    // // Optional internal key to protect this route
    // const key = req.header("x-internal-key");
    // if (!key || key !== process.env.INTERNAL_SCHEDULER_KEY) {
    //   return res.status(403).json({ error: "Forbidden", message: "Missing or invalid internal key" });
    // }

    const reminders = await reminderTX.getRemindersDueSoon({ windowSec });

    return res.status(200).json({ reminders });
  } catch (e) {
    next(e);
  }
});

router.get ("/testAdminID/:adminID", requireAuth, validateParams(schema.getAllAgentByAdminID), async(req, res, next) => {
  try {
      const adminID = req.user?.id;

      if (!adminID) {
        return res.status(403).json({ error: "Forbidden", message: "Missing adminID" });
      }

      const agents = await agentTX.getAllAgent({});

      if (!agents || agents.length === 0) return res.status(404).json({ error: "NotFound" });
      return res.status(201).json({ agents });
    } catch (e) {
      next(e)
    }
});

router.put ("/v1/reminder/:id", requireAuth, validateParams(schema.paramID), validate(schema.updateReminderSchema), async(req, res, next) => {
  try {
      const userID = await req.user?.id;
      const id = await req.validatedParams.id;

      if (!userID) {
        return res.status(403).json({ error: "Forbidden", message: "Missing userID" });
      }

      const client = await reminderTX.updateReminder({
        ...req.validated, 
        userID,
        id
      });

      return res.status(201).json({ client });
    } catch (e) {
      next(e)
    }
});

router.delete ("/v1/reminder/:id", requireAuth, validateParams(schema.paramID), async(req, res, next) => {
  try {
      const userID = await req.user?.id;
      const id = await req.validatedParams.id;

      if (!userID) {
        return res.status(403).json({ error: "Forbidden", message: "Missing userID" });
      }

      const reminderIDRes = await reminderTX.deleteReminder({
        ...req.validated, 
        userID,
        id
      });

      return res.status(201).json({ reminderIDRes });
    } catch (e) {
      next(e)
    }
});

export default router;
