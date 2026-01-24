lua << EOF
require("mason-lspconfig").setup({
  automatic_enable = {
    "ruff",
    "pyrefly",
    "dprint",
    "biome",
    "typescript-language-server",
  }
})
EOF
