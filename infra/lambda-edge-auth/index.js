"use strict";

const crypto = require("crypto");
const AWS = require("aws-sdk");

const REGION = "us-east-1";
const PARAM_PREFIX = "/proj123zap/docs/auth";
const SESSION_COOKIE = "pz_docs_session";
const STATE_COOKIE = "pz_docs_oauth_state";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ssm = new AWS.SSM({ region: REGION });
let cachedConfig = null;

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function sign(payloadB64, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createToken(payloadObj, secret) {
  const payloadB64 = b64urlJson(payloadObj);
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  const expected = sign(payloadB64, secret);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  if (!payload || typeof payload !== "object") return null;
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

function getHeader(headers, name) {
  const k = name.toLowerCase();
  const entry = headers[k];
  return entry && entry[0] ? entry[0].value : "";
}

function parseCookies(headers) {
  const raw = getHeader(headers, "cookie");
  if (!raw) return {};
  return raw.split(";").reduce((acc, pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    acc[key] = val;
    return acc;
  }, {});
}

function resp(status, headers, body) {
  return {
    status: String(status),
    statusDescription: status === 302 ? "Found" : "OK",
    headers,
    body,
  };
}

function noCacheHeaders(extra = {}) {
  return {
    "cache-control": [{ key: "Cache-Control", value: "no-store" }],
    ...extra,
  };
}

function redirect(location, setCookies = []) {
  const headers = noCacheHeaders({ location: [{ key: "Location", value: location }] });
  if (setCookies.length) {
    headers["set-cookie"] = setCookies.map((v) => ({ key: "Set-Cookie", value: v }));
  }
  return resp(302, headers, "");
}

function getHost(request) {
  return getHeader(request.headers, "host");
}

function currentUrl(request) {
  const q = request.querystring ? `?${request.querystring}` : "";
  return `${request.uri}${q}`;
}

function cookieString(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text || "{}");
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.data = data;
    throw err;
  }
  return data;
}

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const names = [
    `${PARAM_PREFIX}/github_client_id`,
    `${PARAM_PREFIX}/github_client_secret`,
    `${PARAM_PREFIX}/org_name`,
    `${PARAM_PREFIX}/cookie_secret`,
  ];

  const out = await ssm.getParameters({ Names: names, WithDecryption: true }).promise();
  const map = new Map((out.Parameters || []).map((p) => [p.Name, p.Value]));

  const cfg = {
    githubClientId: map.get(`${PARAM_PREFIX}/github_client_id`) || "",
    githubClientSecret: map.get(`${PARAM_PREFIX}/github_client_secret`) || "",
    orgName: map.get(`${PARAM_PREFIX}/org_name`) || "briotecnologia",
    cookieSecret: map.get(`${PARAM_PREFIX}/cookie_secret`) || "",
  };

  if (!cfg.githubClientId || !cfg.githubClientSecret || !cfg.cookieSecret) {
    throw new Error("Missing required SSM parameters for edge auth");
  }

  cachedConfig = cfg;
  return cfg;
}

async function handleLogin(request, cfg) {
  const host = getHost(request);
  const qs = new URLSearchParams(request.querystring || "");
  const next = qs.get("next") || "/";

  const statePayload = {
    n: b64url(crypto.randomBytes(24)),
    next,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const stateToken = createToken(statePayload, cfg.cookieSecret);

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", cfg.githubClientId);
  authUrl.searchParams.set("redirect_uri", `https://${host}/_auth/callback`);
  authUrl.searchParams.set("scope", "read:org user:email");
  authUrl.searchParams.set("state", stateToken);

  return redirect(authUrl.toString(), [cookieString(STATE_COOKIE, stateToken, 10 * 60)]);
}

async function exchangeCodeForToken(code, host, cfg) {
  const data = await fetchJson("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "proj123zap-docs-auth",
    },
    body: JSON.stringify({
      client_id: cfg.githubClientId,
      client_secret: cfg.githubClientSecret,
      code,
      redirect_uri: `https://${host}/_auth/callback`,
    }),
  });

  if (!data.access_token) {
    throw new Error("No access token returned from GitHub");
  }
  return data.access_token;
}

async function assertOrgMembership(token, orgName) {
  const me = await fetchJson("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "proj123zap-docs-auth",
    },
  });

  const membership = await fetchJson(`https://api.github.com/user/memberships/orgs/${orgName}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "proj123zap-docs-auth",
    },
  });

  if (membership.state !== "active") {
    throw new Error("User is not active in organization");
  }

  return {
    login: me.login,
    id: me.id,
    avatar: me.avatar_url,
    org: orgName,
  };
}

async function handleCallback(request, cfg) {
  const host = getHost(request);
  const qs = new URLSearchParams(request.querystring || "");
  const code = qs.get("code");
  const state = qs.get("state");

  const cookies = parseCookies(request.headers);
  const stateCookie = cookies[STATE_COOKIE] || "";
  const parsedState = verifyToken(state || "", cfg.cookieSecret);
  const parsedStateCookie = verifyToken(stateCookie, cfg.cookieSecret);

  if (!code || !state || !parsedState || !parsedStateCookie || state !== stateCookie) {
    return resp(401, noCacheHeaders({ "content-type": [{ key: "Content-Type", value: "text/plain; charset=utf-8" }] }), "Falha de autenticação (state inválido).");
  }

  const token = await exchangeCodeForToken(code, host, cfg);
  const user = await assertOrgMembership(token, cfg.orgName);

  const now = Math.floor(Date.now() / 1000);
  const sessionPayload = {
    sub: user.login,
    uid: user.id,
    org: user.org,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const sessionToken = createToken(sessionPayload, cfg.cookieSecret);
  const next = parsedState.next || "/";

  return redirect(next, [
    cookieString(SESSION_COOKIE, sessionToken, SESSION_TTL_SECONDS),
    cookieString(STATE_COOKIE, "", 0),
  ]);
}

function handleLogout() {
  return redirect("/", [cookieString(SESSION_COOKIE, "", 0), cookieString(STATE_COOKIE, "", 0)]);
}

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri || "/";

  try {
    const cfg = await loadConfig();

    if (uri === "/_auth/login") return handleLogin(request, cfg);
    if (uri === "/_auth/callback") return handleCallback(request, cfg);
    if (uri === "/_auth/logout") return handleLogout();

    const cookies = parseCookies(request.headers);
    const session = verifyToken(cookies[SESSION_COOKIE], cfg.cookieSecret);
    if (!session) {
      const next = encodeURIComponent(currentUrl(request));
      return redirect(`/_auth/login?next=${next}`);
    }

    return request;
  } catch (err) {
    return resp(
      500,
      noCacheHeaders({ "content-type": [{ key: "Content-Type", value: "text/plain; charset=utf-8" }] }),
      `Erro interno de autenticação: ${err.message}`
    );
  }
};
