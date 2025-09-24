const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  user.password = 'toomanysecrets';
  return user;
}

async function createFranchise(authToken, user) {
    return await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: randomName(), admins: [user] });
}

async function createStore(franchiseId, storeName, authToken) {
    return await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ franchiseId: franchiseId, name: storeName });
}

module.exports = { randomName, expectValidJwt, createAdminUser, createFranchise, createStore };