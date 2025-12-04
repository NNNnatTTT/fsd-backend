// import pool from "./pool.js";
import { dbPool } from "./pool.js";
import * as upQuery from "./query.js";
import * as upException from "../utils/exceptions.js";
import axios from "axios";
import axiosRetry from "axios-retry";
import FormData from "form-data";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const pool = dbPool;

async function isElligible({userID, id}) {
  console.log(userID, id);
  try {
    const {rows } = await pool.query(upQuery.isEligiblequery, [id, userID]);
    if (rows.length === 0) throw new upException.NotFoundError();
    return !!rows[0].eligible;
  } catch (e) {
    console.error('Error reading user: ', e)
      // throw e;
      throw new upException.ForbiddenError();
  }
}

const PHOTO_SERVICE_URL = process.env.PHOTO_URL;

export async function getS3ID({file}) {
  try {
    const formData = new FormData();
    formData.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });
    const response = await axios.post(`${PHOTO_SERVICE_URL}/upload`, formData,  {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 2000,
    });
    return response.data.url;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.error("photo-service POST error:", err.message);
    throw err;
  }
}

async function createUserPlant({userID, file, name, notes}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const s3ID = await getS3ID({file});

    const values = [userID, s3ID, name, notes];
    const result = await client.query(upQuery.insertupQuery, values);

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


    const result = await client.query(upQuery.devSelectByIDQuery, [id]);
    if (result.rowCount === 0) {
      throw new upException.NotFoundError();
    }
    
    return result.rows[0] || null;
  } catch (e) {
    console.error('Error reading user: ', e)
      throw e;
  } finally {
    client.release();
  }
}
// NOT FOR PROD
async function getAllProfiles() {
  const client = await pool.connect();
  try {


    const {rows} = await client.query(upQuery.devSelectAllQuery);
    
    return rows || null;
  } catch (e) {
    console.error('Error reading user: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getUserPlantByID({id, userID}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ userID, id});
    if (!ok) throw new upException.ForbiddenError();

    const result = await client.query(upQuery.selectByIDuserIDQuery, [id, userID]);
    
    return result.rows[0] || null;
  } catch (e) {
    console.error('Error reading user: ', e)
      throw e;
  } finally {
    client.release();
  }
}

async function getUserPlantsByUserID({userID}) {
  const client = await pool.connect();
  try {
    const {rows} = await client.query(upQuery.getByUserIDQuery, [userID]);
    return rows || null;
  } catch (e) {
    console.error('Error reading user: ', e)
      throw e;
  } finally {
    client.release();
  }
}


async function searchUserPlants ({userID, searchValue, limit, offset}) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(upQuery.searchQuery, [
      searchValue ? `%${searchValue}%` : null,
      userID, limit, offset
    ]);
    if (rows.length === 0) {
      throw new upException.NotFoundError();
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

async function updateUserPlants({id, userID, s3ID, name, notes}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ userID, id});
    if (!ok) throw new upException.ForbiddenError();
    
    const fields = [];
    const values = [];
    let i = 1;

    const push = (sqlFragment, value) => {
      fields.push(`${sqlFragment} $${++i}`);
      values.push(value);
    };

    if (s3ID !== undefined) push('s3_id =', s3ID);
    if (name  !== undefined) push('name =',  name);
    if (notes  !== undefined) push('notes =',  notes);

    if (fields.length === 0) {
      // nothing to update
      return null;
    } 

    const params = [id, ...values];

    await client.query('BEGIN');

    const result = await client.query(await upQuery.dynamicUpdate(fields), params);
    if (result.rowCount === 0) {
      throw new upException.NoAffectedRowError();
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

async function deleteUserPlant({id, userID}) {
  const client = await pool.connect();
  try {
    const ok = await isElligible({ id, userID, client});
    if (!ok) throw new Error('Not Elligible');

    await client.query('BEGIN');
    const result = await client.query(upQuery.deleteQuery, [id]);

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

export { createUserPlant,
          getUserPlantByID, getUserPlantsByUserID,
          searchUserPlants,
          updateUserPlants,
          deleteUserPlant
      };
