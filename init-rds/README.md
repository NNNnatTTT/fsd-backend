## init-rds – RDS bootstrap task

`init-rds` is a small Node.js utility that runs as a **one-shot container** to bootstrap our PostgreSQL RDS instance. It creates the application databases, schemas, roles, and tables required by the backend microservices.

### What it does

- Reads the RDS master credentials from **AWS Secrets Manager** (`fsd-rds-master-user`).
- Connects to the `postgres` database and:
  - Ensures the `service_user` role exists.
  - Creates (if missing) the databases:
    - `user_db`
    - `reminder_db`
    - `user_plant_db`
    - `proxy_db`
- For each database, connects as the master user and:
  - Creates the service schema and extensions (`citext`, `pgcrypto`).
  - Creates the main tables and indexes:
    - `users.user_list`
    - `reminders.reminder_list`
    - `user_plants.user_plant_list`
    - `proxys.proxy_list`
  - Grants `service_user` only the privileges needed by the corresponding service (CONNECT, USAGE, SELECT/INSERT/UPDATE/DELETE).
- Uses simple advisory locks and idempotent `IF NOT EXISTS` checks so it can be **safely re-run** without breaking existing data.

### How to run

Locally (for testing against a dev RDS):

1. Ensure the `fsd-rds-master-user` secret exists in Secrets Manager and points to your RDS instance.
2. Build the image:

  
   docker build -t init-rds ./init-rds
   3. Run the container in the same network as your RDS (for example, from an EC2 instance in the VPC):

  
   docker run --rm \
     -e AWS_REGION=ap-southeast-1 \
     init-rds

In production, this image is intended to be run as a **one-off ECS task** inside the VPC during initial environment setup or migrations.
It can be deployed by the workflow `init-rds-deploy.yml`.

### Why this pattern?

- Keeps the RDS instance **private** – no need to open a public port or run SQL manually from a laptop.
- Encapsulates all schema/bootstrap logic in versioned code.
- Idempotent: We can re-run it when deploying a fresh environment or after changes to the schema logic.
- Isolated: We can wipe the DB inbetween testing for manual isolated end-to-end tests.