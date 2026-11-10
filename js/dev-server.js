// 로컬 확인용 정적 파일 서버 (npm start)
// 프로젝트 폴더의 파일을 주소 그대로 꺼내줍니다. 배포(Cloudflare Pages)에는 쓰이지 않습니다.
const http = require("http");
const fs = require("fs");
const path = require("path");

// 이 파일은 js/ 안에 있으므로 한 단계 위(프로젝트 폴더)를 기준으로 삼습니다.
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 3000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    // 첫 화면(/)은 html/index.html 로 보냅니다.
    if (urlPath === "/") {
      res.writeHead(302, { Location: "/html/index.html" }).end();
      return;
    }
    let file = path.resolve(root, `.${urlPath}`);
    // 프로젝트 폴더 밖의 파일은 내주지 않습니다.
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (urlPath.endsWith("/")) file = path.join(file, "index.html");
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`http://localhost:${port} 에서 실행 중 (종료: Ctrl + C)`);
  });
