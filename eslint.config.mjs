import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".open-next/**", ".vercel/**", ".next/**"],
  },
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
