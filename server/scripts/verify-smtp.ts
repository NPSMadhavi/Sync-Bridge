import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { verifySmtpConnection } from "../email";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const result = await verifySmtpConnection();
console.log(JSON.stringify(result, null, 2));
process.exit(result.verified ? 0 : 1);
