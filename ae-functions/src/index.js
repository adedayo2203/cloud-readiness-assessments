const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function getClient() {
  return BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION);
}

// ── validate-token ──────────────────────────────────────────
app.http('validate-token', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'validate-token',
  handler: async (request) => {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return { status: 400, jsonBody: { valid: false, reason: 'No token provided' } };
    try {
      const container = getClient().getContainerClient('tokens');
      const blob = container.getBlobClient(token + '.json');
      const download = await blob.download();
      const data = JSON.parse(await streamToText(download.readableStreamBody));
      if (new Date(data.expiresAt) < new Date())
        return { jsonBody: { valid: false, reason: 'This assessment link has expired.' } };
      if (data.status === 'submitted')
        return { jsonBody: { valid: false, reason: 'This link has already been submitted.' } };
      return { jsonBody: { valid: true, assessmentType: data.type, company: data.company } };
    } catch (e) {
      return { jsonBody: { valid: false, reason: 'Invalid or unrecognised link.' } };
    }
  }
});

// ── create-token ─────────────────────────────────────────────
app.http('create-token', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'create-token',
  handler: async (request) => {
    const body = await request.json();
    if (!body || !body.token) return { status: 400, jsonBody: { success: false } };
    try {
      const container = getClient().getContainerClient('tokens');
      await container.createIfNotExists();
      const blob = container.getBlockBlobClient(body.token + '.json');
      const data = JSON.stringify({
        token: body.token, company: body.company, email: body.email,
        type: body.type, notes: body.notes, expiresAt: body.expiresAt,
        status: 'pending', createdAt: new Date().toISOString()
      });
      await blob.upload(data, Buffer.byteLength(data), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });
      return { jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, jsonBody: { success: false, error: e.message } };
    }
  }
});

// ── submit-assessment ────────────────────────────────────────
app.http('submit-assessment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'submit-assessment',
  handler: async (request) => {
    const payload = await request.json();
    if (!payload) return { status: 400, jsonBody: { success: false } };
    try {
      const client = getClient();
      const submissionsContainer = client.getContainerClient('submissions');
      await submissionsContainer.createIfNotExists();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const company = (payload.clientCompany || 'unknown').replace(/\s+/g, '-').slice(0, 30);
      const filename = `${ts}_${company}_${payload.type || 'assessment'}.json`;
      payload.filename = filename;
      const submissionBlob = submissionsContainer.getBlockBlobClient(filename);
      const data = JSON.stringify(payload, null, 2);
      await submissionBlob.upload(data, Buffer.byteLength(data), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });
      if (payload.token) {
        try {
          const tokensContainer = client.getContainerClient('tokens');
          const tokenBlob = tokensContainer.getBlockBlobClient(payload.token + '.json');
          const dl = await tokenBlob.download();
          const tokenData = JSON.parse(await streamToText(dl.readableStreamBody));
          tokenData.status = 'submitted';
          tokenData.submittedAt = new Date().toISOString();
          const updated = JSON.stringify(tokenData);
          await tokenBlob.upload(updated, Buffer.byteLength(updated), {
            blobHTTPHeaders: { blobContentType: 'application/json' }
          });
        } catch (e) {}
      }
      return { jsonBody: { success: true, filename } };
    } catch (e) {
      return { status: 500, jsonBody: { success: false, error: e.message } };
    }
  }
});

// ── list-submissions ─────────────────────────────────────────
app.http('list-submissions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'list-submissions',
  handler: async (request) => {
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.AE_ADMIN_KEY)
      return { status: 401, jsonBody: { error: 'Unauthorised' } };
    try {
      const container = getClient().getContainerClient('submissions');
      const submissions = [];
      for await (const blob of container.listBlobsFlat()) {
        const blobClient = container.getBlobClient(blob.name);
        const dl = await blobClient.download();
        const txt = await streamToText(dl.readableStreamBody);
        try {
          const submission = JSON.parse(txt);
          submission.__filename = blob.name;
          submissions.push(submission);
        } catch (e) {}
      }
      submissions.sort((a, b) =>
        new Date(b.submittedAt || b.timestamp) - new Date(a.submittedAt || a.timestamp)
      );
      return { jsonBody: { submissions } };
    } catch (e) {
      return { status: 500, jsonBody: { error: e.message } };
    }
  }
});

// ── delete-submission ────────────────────────────────────────
app.http('delete-submission', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'delete-submission',
  handler: async (request) => {
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.AE_ADMIN_KEY)
      return { status: 401, jsonBody: { error: 'Unauthorised' } };
    const { filename } = await request.json();
    if (!filename) return { status: 400, jsonBody: { error: 'No filename provided' } };
    try {
      const container = getClient().getContainerClient('submissions');
      await container.deleteBlob(filename);
      return { jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, jsonBody: { error: e.message } };
    }
  }
});

// ── delete-token ─────────────────────────────────────────────
app.http('delete-token', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'delete-token',
  handler: async (request) => {
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.AE_ADMIN_KEY)
      return { status: 401, jsonBody: { error: 'Unauthorised' } };
    const { token } = await request.json();
    if (!token) return { status: 400, jsonBody: { error: 'No token provided' } };
    try {
      const container = getClient().getContainerClient('tokens');
      await container.deleteBlob(token + '.json');
      return { jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, jsonBody: { error: e.message } };
    }
  }
});