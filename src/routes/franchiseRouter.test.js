const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testAdminUser;
let testUserAuthToken;

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createFranchise(authToken, user) {
    return await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: randomName(), admins: [user] });
}


async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  user.password = 'toomanysecrets';
  return user;
}

beforeAll(async () => {
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
    
    // Create an admin user
    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminAuthToken = loginRes.body.token;
    expect(loginRes.status).toBe(200);
    expectValidJwt(testAdminAuthToken);
});

test('failed franchise creation', async () => {
  const createRes = await createFranchise(testUserAuthToken, testUser);
  expect(createRes.status).toBe(403);
  expect(createRes.body.message).toBe('unable to create a franchise');
});

test('create franchise with admin user', async () => {
    const createRes = await createFranchise(testAdminAuthToken, testAdminUser);
    expect(createRes.status).toBe(200);
});

test('get franchises', async () => {
    // Create a franchise to make sure there is at least one
    const createRes = await createFranchise(testAdminAuthToken, testAdminUser);
    expect(createRes.status).toBe(200);
    const franchiseName = createRes.body.name;

    const res = await request(app)
      .get('/api/franchise')
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.franchises.length).toBeGreaterThan(0);
});

test('get user franchises', async () => {
    const createRes = await createFranchise(testAdminAuthToken, testAdminUser);
    const franchiseName = createRes.body.name;
    expect(createRes.status).toBe(200);
    const userId = testAdminUser.id;

    const res = await request(app)
      .get(`/api/franchise/${userId}`)
      .set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const found = res.body.find(f => f.name === franchiseName);
    expect(found).toBeDefined();
});

test('delete franchise with admin user', async () => {
    const createRes = await createFranchise(testAdminAuthToken, testAdminUser);
    expect(createRes.status).toBe(200);
    const franchiseId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}`)
      .set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
});

test('create a new store', async () => {
    const createRes = await createFranchise(testAdminAuthToken, testAdminUser);
    expect(createRes.status).toBe(200);
    const franchiseId = createRes.body.id;

    const storeName = randomName();
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${testAdminAuthToken}`)
      .send({ franchiseId: franchiseId, name: storeName });
    expect(storeRes.status).toBe(200);
    expect(storeRes.body.name).toBe(storeName);
});

test('delete a store', async () => {
    const createRes = await createFranchise(testAdminAuthToken, testAdminUser);
    expect(createRes.status).toBe(200);
    const franchiseId = createRes.body.id;
    
    const storeName = randomName();
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${testAdminAuthToken}`)
      .send({ franchiseId: franchiseId, name: storeName });
    expect(storeRes.status).toBe(200);
    
    const storeId = storeRes.body.id;
    const deleteRes = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('store deleted');
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}