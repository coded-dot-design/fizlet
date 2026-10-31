// CSS imported as text (`with { type: "text" }`, esbuild's text loader): the sheet's source.
declare module "*.css" {
  const text: string;
  export default text;
}
