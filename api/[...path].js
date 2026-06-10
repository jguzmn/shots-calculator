const app = require("../server");

function normalizePathValue(value) {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join("/");
  }

  return String(value);
}

function getCatchAllPath(req, url) {
  const queryValue = normalizePathValue(req.query?.["...path"] || req.query?.path);

  if (queryValue) {
    return queryValue;
  }

  return (
    url.searchParams.get("...path") ||
    url.searchParams.get("path") ||
    url.searchParams.get("[...path]") ||
    ""
  );
}

module.exports = (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const catchAllPath = getCatchAllPath(req, url);

  if (catchAllPath) {
    url.pathname = `/api/${catchAllPath.replace(/^\/+/, "")}`;
    url.searchParams.delete("...path");
    url.searchParams.delete("path");
    url.searchParams.delete("[...path]");
    req.url = `${url.pathname}${url.search}`;
  }

  return app(req, res);
};
