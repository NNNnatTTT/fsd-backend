import { dbPool } from "./pool.js";
import * as reminderQuery from "./query.js";
import * as reminderException from "../utils/exceptions.js";

const pool = dbPool;

async function isElligible({userID, id}) {
  console.log(userID, id);
  try {
    const {rows } = await pool.query(reminderQuery.isEligiblequery, [id, userID]);
    if (rows.length === 0) throw new reminderException.NotFoundError();
    return !!rows[0].eligible;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw new reminderException.ForbiddenError();
  }
}

async function createReminder({userID, name, notes, isActive, dueAt, dueDay, isProxy, proxy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const values = [userID, name, notes, isActive, dueAt, dueDay, isProxy, proxy];
    const result = await client.query(reminderQuery.insertReminderQuery, values);

    const reminderID = result.rows[0].id;
    
    await client.query("COMMIT");
    return reminderID;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
      throw e;
  } finally {
    client.release();
  }
}

// NOT FOR PROD
async function getProfileByID({ id }) {
  const client = await pool.connect();
  try {
    const result = await client.query(reminderQuery.devSelectByIDQuery, [id]);
    if (result.rowCount === 0) {
      throw new reminderException.NotFoundError();
    }
    
    return result.rows[0] || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}
// NOT FOR PROD
async function getAllProfiles() {
  const client = await pool.connect();
  try {
    const {rows} = await client.query(reminderQuery.devSelectAllQuery);
    
    return rows || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getReminderByID({id, userID}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ userID, id});
    if (!ok) throw new reminderException.ForbiddenError();

    const result = await client.query(reminderQuery.selectByIDuserIDQuery, [id, userID]);
    
    return result.rows[0] || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getRemindersByUserID({userID}) {
  const client = await pool.connect();
  try {
    const {rows} = await client.query(reminderQuery.getByUserIDQuery, [userID]);
    return rows || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getRemindersDueSoon({ windowSec }) {
  const client = await pool.connect();
  try {
    console.log("🕒 Now:", new Date().toISOString(), "windowSec:", windowSec);

    const { rows: allRows } = await client.query(`
      SELECT id, name, due_at, due_day,
             EXTRACT(EPOCH FROM (due_at - NOW())) AS diff_sec
      FROM reminders.reminder_list
      ORDER BY due_at ASC
    `);
    console.log("📋 All reminders:", allRows.length);
    console.table(allRows.map(r => ({
      id: r.id, name: r.name, due_at: r.due_at, due_day: r.due_day, diffSec: r.diff_sec
    })));

    const { rows } = await client.query(reminderQuery.getDueSoonQuery, [windowSec]);
    console.log("✅ getDueSoon rows:", rows.length);
    return rows || [];
  } catch (e) {
    console.error("❌ Error fetching due reminders:", e);
    throw e;
  } finally {
    client.release();
  }
}

async function updateReminder({ id, userID, name, notes, isActive, dueAt, dueDay, isProxy, proxy }) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ userID, id});
    if (!ok) throw new reminderException.ForbiddenError();
    
    const fields = [];
    const values = [];
    let i = 1;

    const push = (sqlFragment, value) => {
      fields.push(`${sqlFragment} $${++i}`);
      values.push(value);
    };

    if (name !== undefined) push('name =', name);
    if (notes  !== undefined) push('notes =',  notes);
    if (isActive  !== undefined) push('is_active =',  isActive);
    if (isActive  !== undefined) push('is_active =',  isActive);
    if (dueAt  !== undefined) push('due_at =',  dueAt);
    if (dueDay  !== undefined) push('due_day =',  dueDay);
    if (isProxy  !== undefined) push('is_proxy =',  isProxy);
    if (proxy  !== undefined) push('proxy =',  proxy);

    if (fields.length === 0) {
      // nothing to update
      return null;
    } 

    const params = [id, ...values];

    await client.query('BEGIN');

    const result = await client.query(await reminderQuery.dynamicUpdate(fields), params);
    if (result.rowCount === 0) {
      throw new reminderException.NoAffectedRowError();
    }
    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
      throw e;
  } finally {
    client.release();
  }
}

async function deleteReminder({id, userID}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ id, userID, client});
    if (!ok) throw new Error('Not Elligible');

    await client.query('BEGIN');
    const result = await client.query(reminderQuery.deleteQuery, [id]);

    if (result.rowCount === 0) {
      throw new Error('Soft delete failed, not found ');
    }
    await client.query("COMMIT");
    return result.rows[0];
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
      throw e;
  } finally {
    client.release();
  }
}

export { createReminder,
          getReminderByID, getRemindersByUserID, getRemindersDueSoon,
          updateReminder,
          deleteReminder
      };
