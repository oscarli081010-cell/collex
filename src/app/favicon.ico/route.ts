// Browsers and crawlers still ask for /favicon.ico by habit; point them at the site's icon instead of a 404.
export function GET(request: Request) {
  return Response.redirect(new URL("/icon", request.url), 308);
}
