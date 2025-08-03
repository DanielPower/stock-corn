import { Html } from "@elysiajs/html";

// Just forward the string as-is.
// This is just a trick to allow syntax highlighting in some editors.
const css = (s: TemplateStringsArray, ...v: unknown[]) =>
  s.reduce((acc, str, i) => acc + str + (v[i] ?? ""), "");

const style = css`
  body {
    background-color: #121212;
    color: #f0f0f0;
  }
`;

export const Layout = (
  props: Html.PropsWithChildren<{ head: string; title?: string }>,
) => (
  <html lang="en">
    <head>
      <title>Stock Corn</title>
      <style>{style}</style>
    </head>
    <body>
      <nav>
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/leaderboard">Leaderboard</a>
          </li>
        </ul>
      </nav>
      {props.children}
    </body>
  </html>
);
