/**
 * @param { import("knex").Knex } knex
 */
export default (knex) => ({
  async getDevice(id) {
    return (await knex.select('*').from('devices').where('id', id)).at(0);
  },

  async addDevice(userId) {
    return (
      await knex.insert({ user_id: userId }).into('devices').returning('*')
    ).at(0);
  },

  async removeDevice() {
    return (await knex.delete().from('devices').where('id', id)).at(0);
  },

  async listOfDevices() {
    return await knex.select('*').from('devices');
  },
});
