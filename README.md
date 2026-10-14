# Rent or Buy (AU)

An Australian rent-vs-buy calculator that compares **net worth**, not monthly costs. Both households start with the same savings and spend the same each month; whichever option is cheaper invests the difference. It accounts for stamp duty, selling costs, capital gains tax on shares, franking credits, offset accounts and variable rates.

- **Simple view**: your situation as one editable sentence, a plain-language answer, and what would flip it
- **Ledger view**: every line item, buy vs rent, at the year you'd sell
- **Risk**: 5,000 simulated market futures (Monte Carlo)
- **AI Squeeze**: a speculative scenario where AI flattens wages, including job-loss risk and forced sales
- City presets, investment portfolio presets, shareable links and PDF export

**This tool was built and researched with frontier AI models. I made it to explore and inform. It is not financial advice.**

## Development

```
npm install
npm run dev      # local dev server
npm test         # engine tests
npm run build    # type-check and build to dist/
```

Deploys to Cloudflare Workers as static assets (`wrangler.jsonc`). See `CLAUDE.md` for how the model works.
