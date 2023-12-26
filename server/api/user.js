import { concatUserId } from "../utils/id.js";

/**
 * @param { import("knex").Knex } knex
 */
export default (knex) => ({
  getUser: async (id) => {
    return (await knex.select('*').from('users').where('id', id)).at(0);
  },

  addAdminUser: async ({id, provider, email}) => {
    return (await knex.insert({ id: concatUserId(provider, id), role: 'admin', email }).into('users').returning('*')).at(0);
  },

  addUser: async () => {
    return (await knex.insert({ id: concatUserId(provider, id), role: 'user' }).into('users').returning('*')).at(0);
  },

  changeRole: async () => {

  },

  logout: async () => {

  },
});
