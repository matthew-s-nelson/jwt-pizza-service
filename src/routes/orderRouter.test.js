const request = require('supertest');
const app = require('../service');
const { randomName, expectValidJwt, createAdminUser, createFranchise, createStore } = require('../test/testUtils');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testAdminAuthToken;
let testAdminUser;

async function addMenuItem (token, title = randomName()) {
    const newItem = { title, image: 'pizza.jpg', price: 9.99, description: 'A test pizza' };
    const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${token}`)
        .send(newItem);
    return res;
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

test('Get pizza menu', async () => {
    const addItemRes = await addMenuItem(testAdminAuthToken);
    expect(addItemRes.status).toBe(200);

    const res = await request(app)
        .get('/api/order/menu')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
        id: expect.any(Number),
        title: expect.any(String),
        image: expect.any(String),
        price: expect.any(Number),
        description: expect.any(String),
    });
});

test('Add an item to the menu without auth user', async () => {
    const res = await addMenuItem(testUserAuthToken);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to add menu item');
});

test('Add an item to the menu with auth user', async () => {
    const title = randomName();
    const res = await addMenuItem(testAdminAuthToken, title);
    expect(res.status).toBe(200);
    expect(res.body.find((item) => item.title === title)).toBeDefined();
});

test('Get the orders for the authenticated user', async () => {
    await addMenuItem(testAdminAuthToken);
    const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        dinerId: expect.any(Number),
        orders: expect.any(Array),
        page: 1,
    });
});

test('Create a order for the authenticated user', async () => {
    const franchiseRes = await createFranchise(testAdminAuthToken, testAdminUser);
    expect(franchiseRes.status).toBe(200);
    const franchiseId = franchiseRes.body.id;

    const addMenuRes = await addMenuItem(testAdminAuthToken);
    expect(addMenuRes.status).toBe(200);
    const menuItem = addMenuRes.body[0];

    const storeRes = await createStore(franchiseId, randomName(),testAdminAuthToken);
    expect(storeRes.status).toBe(200);
    const storeId = storeRes.body.id;

    const orderReq = {
        franchiseId: franchiseId,
        storeId: storeId,
        items: [{ menuId: menuItem.id, description: menuItem.description, price: menuItem.price }],
    };
    const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(orderReq);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        order: {
            franchiseId: orderReq.franchiseId,
            storeId: orderReq.storeId,
            items: orderReq.items.map(item => ({
                menuId: item.menuId,
                description: item.description,
                price: item.price,
            })),
            id: expect.any(Number),
        },
        jwt: expect.any(String),
    });
    expectValidJwt(res.body.jwt);
});
