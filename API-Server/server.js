const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto'); // CommonJS


const app = express();
app.use(bodyParser.json());

const cors = require('cors');

// Allow all origins (not recommended for prod)
app.use(cors());

// Or, allow only your dashboard domain:
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.0.105:3000','http://172.20.144.1:3000'],
  methods: ['GET','POST','DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


/* ----------------------------------------------------
   Environment / Proxy
---------------------------------------------------- */

const SKYDEPLOY_ENV = process.env.SKYDEPLOY_ENV || 'local';
const { addApp, removeApp } = require('../reverse-proxy-http/server');

const CADDY_CONTAINER = 'skydeploy-caddy';
const CADDYFILE_PATH = '../reverse-proxy/Caddyfile';

/* ----------------------------------------------------
   MongoDB
---------------------------------------------------- */

const MONGO_URI = 'mongodb://localhost:27017/MJ';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(console.error);

/* ----------------------------------------------------
   Constants
---------------------------------------------------- */

const API_PORT = 4000;
let GLOBAL_APP_PORT = 5000;

const FRAMEWORKS = [
  'react', 'next', 'react-vite', 'nuxt',
  'nest', 'angular', 'svelte','express',
  'flask', 'fastapi', 'django', 'streamlit'
];

/* ----------------------------------------------------
   Helpers
---------------------------------------------------- */

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

function getNextPort() {
  while (GLOBAL_APP_PORT === API_PORT) {
    GLOBAL_APP_PORT++;
  }
  return GLOBAL_APP_PORT++;
}

function isPythonFramework(framework) {
  return ['flask', 'fastapi', 'django', 'streamlit'].includes(framework);
}

function addAppToCaddy(appName, port) {
  const block = `
${appName}.tauqeer.site {
  reverse_proxy localhost:${port}
}
`;
  fs.appendFileSync(CADDYFILE_PATH, block);
  exec(`docker exec ${CADDY_CONTAINER} caddy reload --config /etc/caddy/Caddyfile`);
}

function removeAppFromCaddy(appName) {
  const content = fs.readFileSync(CADDYFILE_PATH, 'utf8');
  const regex = new RegExp(`${appName}\\.tauqeer\\.site[\\s\\S]*?\\n}`, 'g');
  fs.writeFileSync(CADDYFILE_PATH, content.replace(regex, ''));
  return execPromise(`docker exec ${CADDY_CONTAINER} caddy reload --config /etc/caddy/Caddyfile`);
}

/* ----------------------------------------------------
   Schema
---------------------------------------------------- */

const appSchema = new mongoose.Schema({
  app_name: { type: String, unique: true, required: true },
  git_repo_url: { type: String, required: true },
  app_type: { type: String, required: true },
  framework: { type: String, enum: FRAMEWORKS, required: true },
  project_root: { type: String, default: '' },
  port: Number,
  container_id: String,
  access_url: String,
  status: { type: String, default: 'running' }
}, { timestamps: true });

const AppModel = mongoose.model('App', appSchema);

/* ----------------------------------------------------
    User model
---------------------------------------------------- */
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin','dev'], default: 'admin' }
});

userSchema.pre('save', async function() {
  if (this.isModified('password')) {
    const bcrypt = require('bcryptjs');
    this.password = await bcrypt.hash(this.password, 10);
  }
});

const UserModel = mongoose.model('User', userSchema);

/* ----------------------------------------------------
    DB model
---------------------------------------------------- */
const dbSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  type: { type: String, default: 'postgres' },
  connection_uri: { type: String, required: true },
  container_id: String,
  volume: String,
  status: { type: String, default: 'running' }
}, { timestamps: true });

const DBModel = mongoose.model('Database', dbSchema);

// register
app.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'admin' } = req.body;
     console.log("BODY:", req.body);
    
    // Check if user exists
    const exists = await UserModel.findOne({ username });
    if (exists) return res.status(400).json({ success: false, error: 'Username already taken' });

    // Create user
    const user = await UserModel.create({ username, password, role });

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      // process.env.JWT_SECRET,
      "skedeploy",
      { expiresIn: '12h' }
    );

    res.json({ success: true, token });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// auth route 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await UserModel.findOne({ username });
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user._id, username: user.username, role: user.role },
    // process.env.JWT_SECRET,
    "skedeploy",
    { expiresIn: '12h' }
  );

  res.json({ success: true, token });
});

// middleware 
function authMiddleware(requiredRole) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const decoded = jwt.verify(token, "skedeploy");
      req.user = decoded;

      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  };
}


/* ----------------------------------------------------
   Docker Deploy Functions (NO DB HERE)
---------------------------------------------------- */

async function deployApp({ app_name, git_repo_url, project_root, ENV_KEYS, port,app_type }) {
  const cmd = `
docker run -d \
--name skydeploy-${app_name} \
-p ${port}:3000 \
-e GIT_REPOSITORY__URL="${git_repo_url}" \
-e PROJECT_ROOT="${project_root}" \
-e PORT=3000 \
-e APP_TYPE="${app_type}" \
${ENV_KEYS ? `-e ENV_KEYS="${ENV_KEYS}"` : ''} \
skydeploy-build-server
`.trim();

  return execPromise(cmd);
}

async function deployPython({ app_name, git_repo_url, project_root, ENV_KEYS, port }) {
  const cmd = `
docker run -d \
--name skydeploy-${app_name} \
-p ${port}:3000 \
-e GIT_REPOSITORY__URL="${git_repo_url}" \
-e PROJECT_ROOT="${project_root}" \
-e PORT=3000 \
${ENV_KEYS ? `-e ENV_KEYS="${ENV_KEYS}"` : ''} \
skydeploy-build-python
`.trim();

  return execPromise(cmd);
}

function execPromised(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

/**
 * Deploy a PostgreSQL container
 * @param {Object} options
 * @param {string} options.name - DB name
 * @param {boolean} options.demoMode - If true, expose to localhost for PgAdmin
 * @returns {Object} { container_id, volume, connection_uri }
 */
async function deployPostgres({ name, demoMode = false }) {
  const user = `user_${name}`;
  const password = crypto.randomBytes(12).toString('hex');
  const database = name;
  const volume = `skydeploy-pg-${name}`;

  const portMapping = demoMode ? '-p 5433:5432' : '';

  const cmd = `
docker run -d \
--name skydeploy-db-${name} \
--network skydeploy-net \
-e POSTGRES_USER=${user} \
-e POSTGRES_PASSWORD=${password} \
-e POSTGRES_DB=${database} \
-v ${volume}:/var/lib/postgresql/data \
${portMapping} \
postgres:16
`.trim();

  const container_id = await execPromised(cmd);

  const connection_uri = demoMode
    ? `postgresql://${user}:${password}@localhost:5433/${database}`
    : `postgresql://${user}:${password}@skydeploy-db-${name}:5432/${database}`;

  return { container_id, volume, connection_uri };
}


/* ----------------------------------------------------
   Routes
---------------------------------------------------- */

app.get('/health', (_, res) => res.send('OK'));

/* ---------- Deploy ---------- */

app.post('/deploy',authMiddleware('admin'), async (req, res) => {
  try {
    const { app_name, git_repo_url, framework, project_root = '', ENV_KEYS = '' } = req.body;

    if (!FRAMEWORKS.includes(framework)) {
      throw new Error('Invalid framework');
    }

    const exists = await AppModel.findOne({ app_name });
    if (exists) throw new Error('App already exists');

    const port = getNextPort();

    const app_type = isPythonFramework(framework)
      ? 'python'
      : ['react', 'react-vite', 'nuxt', 'svelte', 'angular'].includes(framework)
        ? 'static'
        : 'server'; // Node backend apps

    const deployFn = isPythonFramework(framework) ? deployPython : deployApp;
    const container_id = await deployFn({ app_name, git_repo_url, project_root, ENV_KEYS, port,app_type });

    const access_url =
      SKYDEPLOY_ENV === 'local'
        ? `http://${app_name}.127.0.0.1.nip.io:8080`
        : `https://${app_name}.tauqeer.site`;

    if (SKYDEPLOY_ENV === 'local') addApp(app_name, port);
    else addAppToCaddy(app_name, port);

    const appDoc = await AppModel.create({
      app_name,
      git_repo_url,
      framework,
      project_root,
      port,
      container_id,
      access_url,
      app_type,
      status: "running"
    });

    res.json({ success: true, app: appDoc });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ---------- Redeploy ---------- */

app.post('/apps/:app_name/redeploy',authMiddleware('admin') ,async (req, res) => {
  try {
    const { app_name } = req.params;
    const { ENV_KEYS = '' } = req.body;

    const appDoc = await AppModel.findOne({ app_name });
    if (!appDoc) throw new Error('App not found');

    if (appDoc.container_id) {
      await execPromise(`docker rm -f ${appDoc.container_id}`);
    }

    const deployFn = appDoc.app_type === 'python' ? deployPython : deployApp;
    const container_id = await deployFn({
      app_name,
      git_repo_url: appDoc.git_repo_url,
      project_root: appDoc.project_root,
      ENV_KEYS,
      port: appDoc.port,
      app_type: appDoc.app_type,
    });

    appDoc.container_id = container_id;
    appDoc.status = 'running';
    await appDoc.save();

    res.json({ success: true, app: appDoc });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- Delete ---------- */

app.delete('/apps/:app_name', authMiddleware('admin'),async (req, res) => {
  try {
    const appDoc = await AppModel.findOne({ app_name: req.params.app_name });
    if (!appDoc) throw new Error('App not found');

    if (appDoc.container_id) {
      await execPromise(`docker rm -f ${appDoc.container_id}`);
    }

    if (SKYDEPLOY_ENV === 'local') removeApp(appDoc.app_name);
    else await removeAppFromCaddy(appDoc.app_name);

    await AppModel.deleteOne({ app_name: appDoc.app_name });

    res.json({ success: true, message: 'App deleted' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- List ---------- */

app.get('/apps', async (_, res) => {
  res.json(await AppModel.find());
});

app.get('/apps/:app_name', async (req, res) => {
  const app = await AppModel.findOne({ app_name: req.params.app_name });
  if (!app) return res.status(404).json({ error: 'Not found' });
  res.json(app);
});

// DB route
// POST /databases — create DB
app.post('/databases', async (req, res) => {
  try {
    const { name, demoMode = false } = req.body;

    // Check if DB already exists
    if (await DBModel.findOne({ name })) {
      throw new Error('Database already exists');
    }

    // Deploy Postgres
    const result = await deployPostgres({ name, demoMode });

    // Save DB in Mongo
    const db = await DBModel.create({
      name,
      type: 'postgres',
      container_id: result.container_id,
      volume: result.volume,
      connection_uri: result.connection_uri,
      status: 'running'
    });

    res.json({
      success: true,
      database: {
        name: db.name,
        connection_uri: db.connection_uri
      }
    });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ----------------------------------------------------
   Start
---------------------------------------------------- */

app.listen(API_PORT, () => {
  console.log(`🚀 SkyDeploy API running on http://localhost:${API_PORT}`);
});
