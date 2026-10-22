const login = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
const { token } = await login.json();

const res = await fetch('http://localhost:3000/api/whatsapp-instances', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    idInstance: '710722775456',
    apiTokenInstance: 'd7b2bfe251c54037925e1af7a98aa403287d0801e2134eb1bd',
    apiUrl: 'https://7107.api.greenapi.com',
    label: 'Main line',
  }),
});

console.log('status', res.status);
console.log(await res.text());
