const http = require("node:http");

const port = Number(process.env.PORT || 4173);
const regression = process.env.DEMO_REGRESSION === "1";

function page(title, content) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>
<style>body{font:16px system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#1f2937}label{display:block;margin-top:16px;font-weight:600}input{display:block;padding:10px;width:100%;box-sizing:border-box;margin-top:6px}button{margin-top:20px;padding:10px 16px;background:#1d4ed8;color:white;border:0;border-radius:6px}nav{display:flex;gap:16px;margin-bottom:40px}</style></head>
<body><nav><a href="/signup">Sign up</a><a href="/checkout">Checkout</a></nav>${content}</body></html>`;
}

function render(path) {
  if (path === "/checkout") return page("Checkout", `<h1 id="checkout-heading">Checkout</h1><p>Review your order before paying.</p><label for="card">Card number</label><input id="card" autocomplete="cc-number"><button id="pay">Pay securely</button>`);
  const brokenField = regression ? `<label for="promo">Promo code</label><input id="promo" placeholder="Promo code"><button id="promo-button" type="button"></button>` : `<label for="promo">Promo code</label><input id="promo" placeholder="Promo code">`;
  return page("Create your account", `<h1>Create your account</h1><p>Start with the critical path used in this demo.</p><form><label for="email">Email address</label><input id="email" type="email" autocomplete="email"><label for="password">Password</label><input id="password" type="password" autocomplete="new-password">${brokenField}<button id="continue" type="button" onclick="location.href='/checkout'">Continue to checkout</button></form>`);
}

http.createServer((request, response) => {
  const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(render(path));
}).listen(port, "127.0.0.1", () => console.log(`AccessPath demo listening on http://127.0.0.1:${port} (regression=${regression})`));
