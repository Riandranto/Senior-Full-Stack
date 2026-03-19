const { exec } = require('child_process');
const https = require('https');
const dns = require('dns');
const net = require('net');

console.log('🔍 Test de connectivité vers Neon.tech...\n');

// Test ping vers l'IP
const host = 'ep-curly-frost-ajlhj510-pooler.c-3.us-east-2.aws.neon.tech';
console.log(`📡 Testing connection to ${host}...`);

// Test avec node:http
const req = https.get(`https://${host}`, (res) => {
  console.log(`✅ HTTPS Status: ${res.statusCode}`);
  console.log(`✅ Connexion HTTPS réussie`);
}).on('error', (err) => {
  console.error(`❌ HTTPS Error:`, err.message);
});

req.end();

// Test de résolution DNS
dns.lookup(host, (err, address, family) => {
  if (err) {
    console.error(`❌ DNS Error:`, err.message);
  } else {
    console.log(`✅ DNS Resolution: ${address} (IPv${family})`);
    
    // Test ping basique
    console.log(`\n📡 Test ping vers ${address}...`);
    const isWindows = process.platform === 'win32';
    const pingCmd = isWindows ? `ping -n 4 ${address}` : `ping -c 4 ${address}`;
    
    exec(pingCmd, (error, stdout, stderr) => {
      if (error) {
        console.log(`⚠️ Ping pas disponible (peut être bloqué)`);
      } else {
        console.log(stdout);
      }
    });
  }
});

// Test avec telnet-like (socket)
console.log(`\n📡 Test connexion directe sur port 5432...`);
const socket = net.createConnection(5432, host, () => {
  console.log(`✅ Socket connection successful on port 5432`);
  socket.end();
});
socket.on('error', (err) => {
  console.error(`❌ Socket Error on port 5432:`, err.message);
  console.log(`💡 C'est probablement la cause du problème - le port 5432 est bloqué`);
});

// Test traceroute (optionnel)
console.log(`\n📡 Test traceroute...`);
const isWindows = process.platform === 'win32';
const traceCmd = isWindows ? `tracert -h 10 ${host}` : `traceroute -m 10 ${host}`;

exec(traceCmd, (error, stdout, stderr) => {
  if (error) {
    console.log(`⚠️ Traceroute pas disponible`);
  } else {
    console.log(stdout);
  }
});