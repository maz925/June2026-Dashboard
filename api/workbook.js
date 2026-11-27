const { authoriseRead } = require("./access");
const workbook = require("./workbook-data.json");

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "GET") {
    response.status(405).json({ error: "Only GET is supported" });
    return;
  }
  if (!(await authoriseRead(request, response))) return;
  response.status(200).json(workbook);
};
