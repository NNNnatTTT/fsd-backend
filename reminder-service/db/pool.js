import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import 'dotenv/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
// import * as secretsClient from "./secrets";
const { Pool } = pg;
const client = new SecretsManagerClient({
  region: "ap-southeast-1",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const caCert = fs.readFileSync(path.join(__dirname, 'cert', 'global-bundle.pem')).toString();
// const atsRoot = fs.readFileSync(path.join(__dirname, 'cert', 'AmazonRootCA1.pem')).toString(); // disable "ca: caCert", enable "require:true" for proxy connection
const secret_name = process.env.DB_SECRET;
const db_name = process.env.DB_NAME;

async function initPool() {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );

    const secret = JSON.parse(response.SecretString);

    const pool = new Pool({
      host: secret.host,
      port: secret.port,
      user: secret.username,
      password: secret.password,
      database: db_name, //'reminder_db',
      max: 10,
      idleTimeoutMillis: 3000,
      connectionTimeoutMillis: 5000,
      // ssl: { rejectUnauthorized: false }, // quick fix
      ssl: {
        require: true,
        rejectUnauthorized: false,
        ca: caCert,
        // servername: secret.host, // for connecting to proxy but no proxy on AWS Free account
      },
    });
    return pool;
  } catch (error) {
    throw error;
  }
}

export const dbPool = await initPool();