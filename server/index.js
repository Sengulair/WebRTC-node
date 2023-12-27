import knex from 'knex';
import createFastify from 'fastify';
import oauthPlugin from '@fastify/oauth2';
import fastifyJWT from '@fastify/jwt';
import fastifyAuth from '@fastify/auth';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';

import config from './config.js';
import user from './api/user.js';
import device from './api/device.js';
import { concatUserId } from './utils/id.js';

const qb = await knex({
  client: 'pg',
  connection: config.db,
});

const UserModule = user(qb);
const DeviceModule = device(qb);

const fastify = createFastify();

const userConnections = new Map();
const deviceConnections = new Map();

await fastify.register(fastifyWebsocket);

await fastify.register(cors, {
  origin: '*',
});

await fastify.register(fastifyJWT, {
  secret: 'supersecret',
});

await fastify.register(fastifyAuth);

fastify.decorate('authenticateUser', async (request, reply) => {
  try {
    console.log('authenticateUser', request);
    const decodedToken = await request.jwtVerify();
    const user = await UserModule.getUser(decodedToken.sub);
    request.user = user;
  } catch (err) {
    reply.send(err);
  }
});

fastify.decorate('authorizeAdmin', async (request, reply) => {
  try {
    const decodedToken = await request.jwtVerify();
    const user = await UserModule.getUser(decodedToken.sub);
    console.log('USER', user);
    request.user = user;
    if (user.role !== 'admin') {
      reply.code(403).send({ error: 'Forbidden: User is not an admin' });
    }
  } catch (err) {
    reply.send(err);
  }
});

await fastify.register(async function (fastify) {
  fastify.get('/user', {
    websocket: true,
    handler: (connection, req) => {
      connection.socket.on('message', async (rawMessage) => {
        const message = JSON.parse(rawMessage);
        
        if (!connection.user && message.type === 'token') {
          try {
            const token = message.token;
            const decodedToken = await fastify.jwt.verify(token);
            const user = await UserModule.getUser(decodedToken.sub);
            connection.user = user;
            userConnections.set(user.id, connection);
          } catch (err) {
            console.error(err);
            connection.socket.close();
          }
          return;
        }

        const deviceId = message?.deviceId;
        console.log('message', message);
        console.log('from', connection.user.id);
        console.log('to', deviceId);

        const deviceConnection = deviceConnections.get(deviceId);
        if (deviceConnection) {
          console.log('sending to device', deviceId);
          deviceConnection.socket.send(JSON.stringify(message));
          console.log('after sending to device', deviceId);
        }
      });

      connection.socket.on('close', () => {
        userConnections.delete(connection?.user?.id);
      });
    },
  });

  fastify.get('/device', {
    websocket: true,
    handler: async (connection, req) => {
      connection.socket.on('message', async (rawMessage) => {
        const message = JSON.parse(rawMessage);
        
        if (message.type === 'token') {
          try {
            const token = message.token;
            console.log('message', message);
            const decodedToken = await fastify.jwt.verify(token);
            const device = await DeviceModule.getDevice(decodedToken.sub);
            connection.device = device;
            deviceConnections.set(device.id, connection);
          } catch (err) {
            console.error(err);
            connection.socket.close();
          }
          return;
        }

        if (!connection.device) return;

        const deviceId = connection.device.id;
        const userId = (await DeviceModule.getDevice(deviceId)).user_id;

        console.log('message', message);
        console.log('to', userId);
        console.log('from', deviceId)

        const userConnection = userConnections.get(userId);
        if (userConnection) {
          userConnection.socket.send(JSON.stringify(message));
          console.log('after sending to user', userId);
        }
      });

      connection.socket.on('close', () => {
        deviceConnections.delete(connection?.device?.id);
      });
    },
  });
});

await fastify.register(oauthPlugin, {
  name: 'googleOAuth2',
  scope: ['profile', 'email'],
  credentials: {
    client: {
      id: config.googleAuth.clientId,
      secret: config.googleAuth.secret,
    },
    auth: oauthPlugin.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: '/login/google',
  callbackUri: config.googleAuth.callbackUri,
});

const googlePathnameCallback = new URL(config.googleAuth.callbackUri).pathname;

fastify.get(googlePathnameCallback, function (request, reply) {
  this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
    request,
    (err, result) => {
      if (err) {
        reply.send(err);
        return;
      }
      console.log('result', result.token.access_token);

      fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + result.token.access_token,
        },
      })
        .then(async (response) => {
          const data = await response.json();
          let user = await UserModule.getUser(concatUserId('google', data.id));
          console.log('found user', user);
          let user_id = user?.id;

          if (!user_id) {
            user = await UserModule.addAdminUser({
              id: data.id,
              provider: 'google',
              email: data.email,
            });
            console.log('newUser', user);
            user_id = user.id;
          }

          const token = fastify.jwt.sign(
            { sub: user_id },
            // { expiresIn: '15min' }
            { expiresIn: '30 days' }
          );

          console.log('data', { data, token });
          reply.send({ accessToken: token });
        })
        .catch((err) => {
          console.log(err);
          reply.send(err);
        });
    }
  );
});

fastify.route({
  method: 'POST',
  url: '/api/device',
  preHandler: fastify.auth([fastify.authorizeAdmin]),
  handler: async (request, reply) => {
    const userId = request.user.id;
    console.log('userId', userId);
    const addedDevice = await DeviceModule.addDevice(userId);

    const token = fastify.jwt.sign(
      { sub: addedDevice.id },
      { expiresIn: '30 days' }
    );

    reply.send({ token, device: addedDevice });
  },
});

fastify.listen({ port: config.api.port, host: '0.0.0.0' });
