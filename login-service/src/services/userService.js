/**
 * This service module encapsulates all HTTP communication between the login-service
 * and the user-service. It demonstrates **orchestration**, a core microservice
 * communication pattern where one service coordinates work by calling another.
 *
 * Axios is used for synchronous orchestration because authentication and registration
 * require immediate feedback to the user (JWT issuance, validation results).
 */

import axios from "axios";
import axiosRetry from "axios-retry";

// ----------------------------------------------------------
// Axios Configuration: Resilience and Retry Handling
// ----------------------------------------------------------
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// ----------------------------------------------------------
// Environment Configuration (DevOps Best Practice)
// ----------------------------------------------------------
// const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3001";
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || "my-super-secret-key";

// Centralized header configuration for internal authentication
const INTERNAL_HEADERS = {
  "x-internal-secret": INTERNAL_API_SECRET,
};

// ----------------------------------------------------------
// Read Orchestration: Get user by email
// ----------------------------------------------------------
export async function getUserByEmail(email) {
  try {
    
    const response = await axios.get(`${USER_SERVICE_URL}/users`, {
      params: { email },
      headers: INTERNAL_HEADERS,
      timeout: 2000,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.error("User-service GET error:", err.message);
    throw err;
  }
}

// ----------------------------------------------------------
// Write Orchestration: Create new user
// ----------------------------------------------------------
export async function createUser(data) {
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users`, data, {
      headers: INTERNAL_HEADERS,
      timeout: 2000,
    });
    return response.data;
  } catch (err) {
    console.error("User-service POST error:", err.message);
    throw err;
  }
}
