import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GOOGLE_RECAPTCHA_SECRET_KEY = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
const APP_PORT = process.env.APP_PORT;
const EXPIRATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const fastify = Fastify({ logger: false });

// Memory stores
const dataStore = new Map();
const clients = new Map();

fastify.register(rateLimit, {
  max: 5, // limit each IP to 5 requests per windowMs
  timeWindow: '1 minute',
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
});

fastify.get('/api/config', (req, reply) => {
  return { recaptchaSiteKey: process.env.GOOGLE_RECAPTCHA_SITE_KEY };
});

fastify.post('/api/data', async (req, reply) => {
  const { recaptcha, data } = req.body;

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${GOOGLE_RECAPTCHA_SECRET_KEY}&response=${recaptcha}`,
  });
  const responseData = await response.json();

  if (!response.ok || !responseData.success) {
    return reply.status(400).send({ message: 'Invalid reCAPTCHA' });
  }
  const code = data.code;
  dataStore.set(code, data);

  setTimeout(() => {
    dataStore.delete(code);
  }, EXPIRATION_TIMEOUT_MS);
  
  return { message: 'Data added successfully' };
});

fastify.get('/api/data/:code', async (req, reply) => {
  const code = req.params.code;
  const data = dataStore.get(code);

  if (!data) {
    return reply.status(404).send({ message: 'Data not found' });
  }

  // Notify client that device setup is success
  const clientRes = clients.get(code);
  if (clientRes) {
    clientRes.write(`data: ${JSON.stringify({ message: 'Device setup success' })}\n\n`);
    clientRes.end();
    clients.delete(code);
  }

  dataStore.delete(code);
  return data;
});

fastify.get('/events/:code', (req, reply) => {
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  clients.set(req.params.code, reply.raw);

  req.raw.on('close', () => clients.delete(req.params.code));

  // This line is added to keep the connection open
  const interval = setInterval(() => reply.raw.write('\n'), 30000);

  reply.raw.on('close', () => {
    clearInterval(interval);
    clients.delete(req.params.code);
  });
});

fastify.listen({ port: APP_PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  } 
  console.log(`Server is listening on ${address}`)
});