import dotenv from 'dotenv';

dotenv.config();

export default {
  api: {
    port: process.env.API_PORT,
  },
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  googleAuth: {
    clientId: process.env.GOOGLE_OAUTH_ID,
    secret: process.env.GOOGLE_OAUTH_SECRET,
    callbackUri: process.env.GOOGLE_OAUTH_CALLBACK_URI,
  },
};