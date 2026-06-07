const CONTENT_PATH = 'data/site-content.json';
const DEFAULT_CONTENT = { elements: {}, links: {}, styles: {}, hiddenSections: [] };

function getRepo() {
  return process.env.GITHUB_REPO || 'lolamontesinos/EcolboxAr';
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'EcolBox-Admin',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchContentFromGitHub(repo) {
  const url = `https://api.github.com/repos/${repo}/contents/${CONTENT_PATH}`;
  const response = await fetch(url, { headers: githubHeaders() });

  if (response.status === 404) return { content: DEFAULT_CONTENT, sha: null };
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub read failed (${response.status}): ${error}`);
  }

  const file = await response.json();
  const decoded = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  return { content: decoded, sha: file.sha };
}

async function saveContentToGitHub(repo, data, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
  };
  if (sha) body.sha = sha;

  const url = `https://api.github.com/repos/${repo}/contents/${CONTENT_PATH}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...githubHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub write failed (${response.status}): ${error}`);
  }

  return response.json();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const repo = getRepo();

  try {
    if (req.method === 'GET') {
      const { content } = await fetchContentFromGitHub(repo);
      return res.status(200).json(content);
    }

    if (req.method === 'POST') {
      if (!process.env.GITHUB_TOKEN) {
        return res.status(503).json({
          error: 'GITHUB_TOKEN no configurado en Vercel. Agregá el token en Settings → Environment Variables.',
        });
      }

      const body = parseBody(req);
      const adminPassword = process.env.ADMIN_PASSWORD || 'ecolbox';

      if (body.password !== adminPassword) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      const { content: current, sha } = await fetchContentFromGitHub(repo);

      if (body.action === 'reset') {
        await saveContentToGitHub(repo, DEFAULT_CONTENT, sha, 'Reset site content via admin');
        return res.status(200).json({ ok: true, data: DEFAULT_CONTENT });
      }

      if (!body.data || typeof body.data !== 'object') {
        return res.status(400).json({ error: 'Datos inválidos' });
      }

      await saveContentToGitHub(
        repo,
        body.data,
        sha,
        'Update site content via EcolBox admin'
      );

      return res.status(200).json({ ok: true, data: body.data });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error del servidor' });
  }
};
