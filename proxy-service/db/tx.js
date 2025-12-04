import { dbPool } from "./pool.js";
import * as proxyQuery from "./query.js";
import * as proxyException from "../utils/exceptions.js";

const pool = dbPool;

async function isElligible({userID, id}) {
  console.log(userID, id);
  try {
    const {rows } = await pool.query(proxyQuery.isEligiblequery, [id, userID]);
    if (rows.length === 0) throw new proxyException.NotFoundError();
    return !!rows[0].eligible;
  } catch (e) {
    console.error('Error reading user: ', e)
      // throw e;
      throw new proxyException.ForbiddenError();
  }
}

async function createProxy({userID, name, startDate, endDate, phoneNumber}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const values = [userID, name, startDate, endDate, phoneNumber];
    const result = await client.query(proxyQuery.insertQuery, values);

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

    const result = await client.query(proxyQuery.devSelectByIDQuery, [id]);
    if (result.rowCount === 0) {
      throw new proxyException.NotFoundError();
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

    const {rows} = await client.query(proxyQuery.devSelectAllQuery);
    
    return rows || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getProxyByID({id, userID}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ userID, id});
    if (!ok) throw new proxyException.ForbiddenError();

    const result = await client.query(proxyQuery.selectByIDuserIDQuery, [id, userID]);
    
    return result.rows[0] || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getProxysByUserID({userID}) {
  const client = await pool.connect();
  try {
    const {rows} = await client.query(proxyQuery.getByUserIDQuery, [userID]);
    return rows || null;
  } catch (e) {
    console.error('Error reading agent: ', e)
      throw e;
  } finally {
    client.release();
  }
}


async function searchProxys ({userID, searchValue, limit, offset}) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(proxyQuery.searchQuery, [
      searchValue ? `%${searchValue}%` : null,
      userID, limit, offset
    ]);
    if (rows.length === 0) {
      throw new proxyException.NotFoundError();
    }
    console.log(rows);
    return rows || null;
  } catch (e) {
    console.error('Error reading plants: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function updateProxys({id, userID, name, startDate, endDate, phoneNumber}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ userID, id});
    if (!ok) throw new proxyException.ForbiddenError();
    
    const fields = [];
    const values = [];
    let i = 1;

    const push = (sqlFragment, value) => {
      fields.push(`${sqlFragment} $${++i}`);
      values.push(value);
    };

    if (name !== undefined) push('name =', name);
    if (startDate  !== undefined) push('start_date =',  startDate);
    if (endDate  !== undefined) push('end_date =',  endDate);
    if (phoneNumber  !== undefined) push('phone_number =',  phoneNumber);

    if (fields.length === 0) {
      // nothing to update
      return null;
    } 

    const params = [id, ...values];

    await client.query('BEGIN');

    const result = await client.query(await proxyQuery.dynamicUpdate(fields), params);
    if (result.rowCount === 0) {
      throw new proxyException.NoAffectedRowError();
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

async function deleteProxy({id, userID}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ id, userID, client});
    if (!ok) throw new Error('Not Elligible');

    await client.query('BEGIN');
    const result = await client.query(proxyQuery.deleteQuery, [id]);

    if (result.rowCount === 0) {
      throw new Error('Delete failed, not found ');
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

export { createProxy,
          getProxyByID, getProxysByUserID,
          searchProxys,
          updateProxys,
          deleteProxy
      };
