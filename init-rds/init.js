import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import pg from "pg";
import format from 'pg-format';

const { Pool } = pg;

const client = new SecretsManagerClient({
    region: "ap-southeast-1",
});
const secret_name = "fsd-rds-master-user";

async function getSecretValue() {
    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name,
                VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
            })
        );
        // const secret = response.SecretString;
        const secret = JSON.parse(response.SecretString);

        return secret;
    } catch (error) {
        // For a list of exceptions thrown, see
        // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        throw error;
    }
}

async function bootstrapPool(secret, dbName){
    const pool = new Pool({
            host: secret.host,
            port: secret.port,
            user: secret.username,
            password: secret.password,
            database: dbName,
            max: 10,
            idleTimeoutMillis: 30000,
            ssl: { rejectUnauthorized: false } // quick fix
            // options: '-c search_path=profiles,public',
        });
    return pool;
}

function logPgError(e, ctx = "") {
  console.error(`error?: ${ctx}`);
  console.error("message:", e.message);
  console.error("code:", e.code);
  console.error("detail:", e.detail);
  console.error("hint:", e.hint);
  console.error("position:", e.position);
  console.error("where:", e.where);
  console.error("schema:", e.schema, "table:", e.table, "column:", e.column);
  console.error("stack:", e.stack);
}

process.on("unhandledRejection", (e) => logPgError(e, "UnhandledRejection"));
process.on("uncaughtException", (e) => logPgError(e, "UncaughtException"));

async function assertTrue(client, sql, ctx) {
  const { rows } = await client.query(sql);
  const ok = rows?.[0]?.ok === true;
  if (!ok) throw new Error(`Assertion failed: ${ctx}`);
  console.log(`✅ ${ctx}`);
}

async function createDB(dbName, masterClient) {
    try {
        await masterClient.query('SELECT pg_advisory_lock(hashtext($1))', [dbName]);

        const { rows } = await masterClient.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [dbName]
        );
        if (rows.length === 0) {
            console.log("Creating database ", dbName);
            const sql = format('CREATE DATABASE %I', dbName);
            await masterClient.query(sql);
            console.log("Created database ", dbName);
        } else {
            console.log("Database exists: ", dbName);
        }
    } catch (e) {
        if (e.code !== '42P04') throw e;
    } finally {
        // Release advisory lock if taken
        try { await masterClient.query('SELECT pg_advisory_unlock(hashtext($1))', [dbName]); } catch (_) {}
    }
}

// async function initAdminsDB(adminsClient) {
//     try {
//         await adminsClient.query(`DROP SCHEMA IF EXISTS admins CASCADE;`);
//         await adminsClient.query(`CREATE SCHEMA IF NOT EXISTS admins;`);
//         await assertTrue(adminsClient,
//             `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='admins') AS ok`,
//             "admins schema exists");
//         await adminsClient.query(`SET search_path TO admins, public;`);
//     } catch(e) {
//         console.log("initAdminsDB error: ", e);
//     }
// }

async function initUserDB(userClient) {
    try {
        await userClient.query(`DROP SCHEMA IF EXISTS users CASCADE;`);
        await userClient.query(`CREATE SCHEMA IF NOT EXISTS users;`);
        await assertTrue(userClient,
            `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='users') AS ok`,
            "users schema exists");
        await userClient.query(`SET search_path TO users, public;`);
        await userClient.query(`
            CREATE EXTENSION IF NOT EXISTS citext;
            CREATE EXTENSION IF NOT EXISTS pgcrypto;

            CREATE TABLE IF NOT EXISTS users.user_list (
                id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
                email           text        NOT NULL UNIQUE,
                username        text        NOT NULL UNIQUE,
                phone_number     text        NOT NULL UNIQUE,
                password_hash    text        NOT NULL,
                role            text        NOT NULL,
                created_at timestamptz      NOT NULL DEFAULT now(),
                deleted_at timestamptz      NULL
            );

            GRANT CONNECT ON DATABASE user_db TO service_user;
            GRANT USAGE ON SCHEMA users TO service_user;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA users TO service_user;
            ALTER DEFAULT PRIVILEGES IN SCHEMA users GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_user;
        `);
        await userClient.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_list_username_active     ON users.user_list (username, created_at DESC) WHERE deleted_at IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ux_user_list_email_ci_active      ON users.user_list (email)        WHERE deleted_at IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ux_user_list_phoneNumber_active  ON users.user_list (phone_number) WHERE deleted_at IS NULL;
            `);

        await assertTrue(userClient,
            `SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema='users' AND table_name='user_list'
            ) AS ok`,
            "users.user_list exists");
            

    } catch(e) {
        console.log("initUserDB error: ", e);
    }
}

async function initRemindersDB(serviceClient) {
    try {
        await serviceClient.query(`DROP SCHEMA IF EXISTS reminders CASCADE;`)
        await serviceClient.query(`CREATE SCHEMA IF NOT EXISTS reminders;`);
        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='reminders') AS ok`,
            "reminders schema exists");

        await serviceClient.query(`SET search_path TO reminders, public;`);
        await serviceClient.query(`
            CREATE EXTENSION IF NOT EXISTS citext;
            CREATE EXTENSION IF NOT EXISTS "pgcrypto";

            CREATE TABLE IF NOT EXISTS reminder_list (
                id                  uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id             text                NOT NULL,
                name                text               NOT NULL,
                notes               text               NULL,
                is_active           boolean            NOT NULL DEFAULT true,
                due_at              timestamptz        NOT NULL,
                due_day             INTEGER[]          NOT NULL DEFAULT ARRAY[]::integer[],
                is_proxy            boolean            NOT NULL DEFAULT false,
                proxy               text               NULL,
                created_at          timestamptz        NOT NULL DEFAULT now(),
                updated_at          timestamptz        NOT NULL DEFAULT now()
            );
            GRANT CONNECT ON DATABASE reminder_db TO service_user;
            GRANT USAGE ON SCHEMA reminders TO service_user;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA reminders TO service_user;
            ALTER DEFAULT PRIVILEGES IN SCHEMA reminders GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_user;
            `);

        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citext') AS ok`,
            "citext ext exists");
        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS ok`,
            "pgcrypto ext exists");
        await assertTrue(serviceClient,
            `SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema='reminders' AND table_name='reminder_list'
            ) AS ok`,
            "reminders.reminder_list exists");

        await serviceClient.query(`
            CREATE  INDEX IF NOT EXISTS idx_reminder_list_user_id  ON reminders.reminder_list (user_id);
            `);
    } catch(e) {
        console.log("initRemindersDB error: ", e);
    }
}

async function initUserPlantDB(serviceClient) {
    try {
        await serviceClient.query(`DROP SCHEMA IF EXISTS user_plants CASCADE;`)
        await serviceClient.query(`CREATE SCHEMA IF NOT EXISTS user_plants;`);
        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='user_plants') AS ok`,
            "user_plants schema exists");

        await serviceClient.query(`SET search_path TO user_plants, public;`);
        await serviceClient.query(`
            CREATE EXTENSION IF NOT EXISTS citext;
            CREATE EXTENSION IF NOT EXISTS "pgcrypto";

            CREATE TABLE IF NOT EXISTS user_plant_list (
                id                  uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id             text               NOT NULL,
                s3_id               text               NOT NULL,
                name                text               NOT NULL,
                notes               text               NULL,
                created_at          timestamptz        NOT NULL DEFAULT now(),
                updated_at          timestamptz        NOT NULL DEFAULT now()
            );
            GRANT CONNECT ON DATABASE user_plant_db TO service_user;
            GRANT USAGE ON SCHEMA user_plants TO service_user;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA user_plants TO service_user;
            ALTER DEFAULT PRIVILEGES IN SCHEMA user_plants GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_user;
            `);

        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citext') AS ok`,
            "citext ext exists");
        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS ok`,
            "pgcrypto ext exists");
        await assertTrue(serviceClient,
            `SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema='user_plants' AND table_name='user_plant_list'
            ) AS ok`,
            "user_plants.user_plant_list exists");

        await serviceClient.query(`
            CREATE  INDEX IF NOT EXISTS idx_user_plant_list_user_id  ON user_plants.user_plant_list (user_id);
            `);
    } catch(e) {
        console.log("inituser_plantsDB error: ", e);
    }
}

async function initProxyDB(serviceClient) {
    try {
        // await serviceClient.query(`
        //     DO $$
        //     BEGIN
        //         IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'profiles_user') THEN
        //             CREATE ROLE profiles_user WITH LOGIN PASSWORD 'profiles_user_password';
        //         END IF;
        //     END $$ LANGUAGE plpgsql;
        //     `);
        await serviceClient.query(`DROP SCHEMA IF EXISTS proxys CASCADE;`)
        await serviceClient.query(`CREATE SCHEMA IF NOT EXISTS proxys;`);
        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='proxys') AS ok`,
            "proxys schema exists");

        await serviceClient.query(`SET search_path TO proxys, public;`);
        await serviceClient.query(`
            CREATE EXTENSION IF NOT EXISTS citext;
            CREATE EXTENSION IF NOT EXISTS "pgcrypto";

            CREATE TABLE IF NOT EXISTS proxy_list (
                id                  uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id             text               NOT NULL,
                name                text               NOT NULL,
                start_date          text               NOT NULL,
                end_date            date               NOT NULL,
                phone_number        text               NOT NULL,
                created_at          timestamptz        NOT NULL DEFAULT now(),
                updated_at          timestamptz        NOT NULL DEFAULT now()
            );
            GRANT CONNECT ON DATABASE proxy_db TO service_user;
            GRANT USAGE ON SCHEMA proxys TO service_user;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA proxys TO service_user;
            ALTER DEFAULT PRIVILEGES IN SCHEMA proxys GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_user;
            `);

        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citext') AS ok`,
            "citext ext exists");
        await assertTrue(serviceClient,
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS ok`,
            "pgcrypto ext exists");
        await assertTrue(serviceClient,
            `SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema='proxys' AND table_name='proxy_list'
            ) AS ok`,
            "proxys.proxy_list exists");

        await serviceClient.query(`
            CREATE        INDEX IF NOT EXISTS idx_proxy_list_user_id  ON proxys.proxy_list (user_id);
            `);
    } catch(e) {
        console.log("initproxysDB error: ", e);
    }
}

async function main() {
    try {
        const secret = await getSecretValue();
        const masterPool = await bootstrapPool(secret, 'postgres');
        const masterClient = await masterPool.connect();
        await masterClient.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_user') THEN
                    CREATE ROLE service_user WITH LOGIN PASSWORD 'service_user_password';
                END IF;
            END $$ LANGUAGE plpgsql;
            `);
        await createDB('user_db', masterClient);
        await createDB('reminder_db', masterClient);
        await createDB('user_plant_db', masterClient);
        await createDB('proxy_db', masterClient);
        await masterClient.release();
        
        const userPool = await bootstrapPool(secret, 'user_db');
        const userClient = await userPool.connect();
        await initUserDB(userClient);
        const reminderPool = await bootstrapPool(secret, 'reminder_db');
        const reminderClient = await reminderPool.connect();
        await initRemindersDB(reminderClient);
        const upPool = await bootstrapPool(secret, 'user_plant_db');
        const upClient = await upPool.connect();
        await initUserPlantDB(upClient);
        const proxyPool = await bootstrapPool(secret, 'proxy_db');
        const proxyClient = await proxyPool.connect();
        await initProxyDB(proxyClient);


        
        


        await userClient.release();
        await reminderClient.release();
        await upClient.release();
        await proxyClient.release();
        await userPool.end();
        await reminderPool.end();
        await upPool.end();
        await proxyPool.end();
        await masterPool.end();
    } catch (e) {
        if (e.code === "42P04"){
            console.log("main error: ", e);
        } else {
            throw e; // ignore duplicate_database
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
