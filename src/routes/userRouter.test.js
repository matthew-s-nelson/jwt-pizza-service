const request = require('supertest');
const app = require('../service');
const { randomName, expectValidJwt, createAdminUser } = require('../test/testUtils');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let userId;
let testAdminAuthToken;
let testAdminUser;

beforeAll(async () => {
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    userId = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);

    // Create an admin user
    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminAuthToken = loginRes.body.token;
    expect(loginRes.status).toBe(200);
    expectValidJwt(testAdminAuthToken);
})

test('Get authenticated user', async () => {
    const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        id: expect.any(Number),
        name: testUser.name,
        email: testUser.email,
        roles: [{ role: 'diner' }],
    });
})

test('Update user', async () => {
    const newName = randomName();
    const newEmail = newName + '@test.com';
    const res = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${testAdminAuthToken}`)
        .send({ name: newName, email: newEmail, password: 'newpassword' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        user: {
            id: expect.any(Number),
            name: newName,
            email: newEmail,
            roles: [{ role: 'diner' }],
        },
        token: expect.any(String),
    });
    expectValidJwt(res.body.token);
})

test('Update user without admin', async () => {
    const newName = randomName();
    const newEmail = newName + '@test.com';
    const res = await request(app)
        .put(`/api/user/${userId+1}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send({ name: newName, email: newEmail, password: 'newpassword' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unauthorized');
})

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}