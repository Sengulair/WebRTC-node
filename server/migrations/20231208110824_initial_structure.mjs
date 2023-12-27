/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable('users', table => {
    table.string('id').notNullable().primary();
    table.enum('role', ['admin', 'user']).notNullable().defaultTo('user');
    table.string('email').notNullable();
    table.uuid('tenantId').defaultTo(knex.fn.uuid());
    table.timestamps(true, true);
  });

  await knex.schema.createTable('devices', table => {
    table.uuid('id').defaultTo(knex.fn.uuid()).primary();
    table.string('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('users');
  await knex.schema.dropTable('devices');
};
